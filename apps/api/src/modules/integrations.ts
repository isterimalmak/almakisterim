import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, type Deps } from "../context.js";
import { HttpError } from "../lib/util.js";
import { FIELDS, GROUPS } from "../services/integrations.js";
import { testAi } from "./ai-admin.js";

type Test = { ok: boolean; message: string };
const msg = (e: unknown) => String((e as Error).message ?? e).slice(0, 300);

// Yönetim → Entegrasyonlar: anahtar girme, silme ve her hizmet için deneme. Gizli değerler hiçbir yanıtta dönmez, loga yazılmaz.
export function integrationRoutes(app: FastifyInstance, deps: Deps) {
  const { config } = deps;
  const integ = () => {
    if (!deps.integrations) throw new HttpError(503, "kapali", "Entegrasyon ayarları şu anda kullanılamıyor.");
    return deps.integrations;
  };

  app.get("/admin/integrations", async (req) => {
    requireAdmin(req);
    const has = (...v: string[]) => v.every((x) => !!x.trim());
    const connected: Record<string, boolean> = {
      ai: has(config.ANTHROPIC_API_KEY), mail: has(config.RESEND_API_KEY), sms: has(config.NETGSM_USERCODE, config.NETGSM_PASSWORD, config.NETGSM_HEADER),
      photos: deps.photos?.enabled ?? (has(config.PIXABAY_API_KEY) || has(config.PEXELS_API_KEY)), google: deps.google.enabled, storage: deps.storage.enabled,
    };
    return { groups: integ().status().map((g) => ({ ...g, connected: !!connected[g.id] })), pay: { name: "Ödeme (iyzico / PayTR)", note: "Kredi satın alma henüz bağlanmadı; kredi şimdilik elle tanımlanıyor." } };
  });

  app.put("/admin/integrations/:key", { config: { rateLimit: { max: 30, timeWindow: "1 hour" } } }, async (req) => {
    const admin = requireAdmin(req);
    const { key } = z.object({ key: z.string().max(40) }).parse(req.params);
    const field = FIELDS.find((f) => f.key === key);
    if (!field) throw new HttpError(404, "bulunamadi", "Bu ayar bulunamadı.");
    const { value } = z.object({ value: z.string().max(4000) }).parse(req.body);
    // Anahtarlarda boşluk olmaz (kopyalarken gelen boşluk/satır sonu temizlenir); diğer alanlarda yalnızca baş-son boşluk.
    const clean = field.secret && !/PASSWORD/.test(key) ? value.replace(/\s+/g, "") : value.trim();
    if (!clean) throw new HttpError(400, "bos", "Boş değer kaydedilemez; silmek için Sil düğmesini kullanın.");
    await integ().save(key, clean, admin.id);
    return { ok: true };
  });

  app.delete("/admin/integrations/:key", async (req) => {
    const admin = requireAdmin(req);
    const { key } = z.object({ key: z.string().max(40) }).parse(req.params);
    if (!FIELDS.some((f) => f.key === key)) throw new HttpError(404, "bulunamadi", "Bu ayar bulunamadı.");
    await integ().save(key, null, admin.id);
    return { ok: true };
  });

  app.post("/admin/integrations/:group/test", { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (req): Promise<Test> => {
    const admin = requireAdmin(req);
    const { group } = z.object({ group: z.enum(GROUPS.map((g) => g.id) as [string, ...string[]]) }).parse(req.params);
    try {
      switch (group) {
        case "ai": {
          const r = await testAi(deps);
          return r.ok ? { ok: true, message: `Çalışıyor (${((r.ms ?? 0) / 1000).toFixed(1)} sn). Örnek başlık: "${r.title}"` } : { ok: false, message: r.error ?? "Çalışmıyor." };
        }
        case "mail": {
          if (!config.RESEND_API_KEY.trim()) return { ok: false, message: "API anahtarı girilmemiş." };
          if (!admin.email) return { ok: false, message: "Deneme e-postası için yönetici hesabınızda e-posta adresi olmalı." };
          await deps.mailer.send(admin.email, "almakisterim deneme e-postası", "Bu bir deneme e-postasıdır. E-posta gönderimi çalışıyor.");
          return { ok: true, message: `Deneme e-postası ${admin.email} adresine gönderildi. Gelen kutunuzu (ve istenmeyen klasörünü) kontrol edin.` };
        }
        case "sms": {
          if (!(config.NETGSM_USERCODE.trim() && config.NETGSM_PASSWORD.trim() && config.NETGSM_HEADER.trim())) return { ok: false, message: "Kullanıcı kodu, şifre ve mesaj başlığının üçü de girilmeli." };
          if (!admin.phone) return { ok: false, message: "Deneme SMS'i için yönetici hesabınızda telefon numarası olmalı." };
          await deps.sms.send(admin.phone, "almakisterim deneme SMS'i: SMS gönderimi çalışıyor.");
          return { ok: true, message: `Deneme SMS'i ${admin.phone} numarasına gönderildi.` };
        }
        case "photos": {
          if (!deps.photos?.enabled) return { ok: false, message: "Pixabay ya da Pexels anahtarı girilmemiş." };
          const list = await deps.photos.search("araba", 3);
          return list.length ? { ok: true, message: `Çalışıyor: ${deps.photos.name} üzerinden ${list.length} örnek fotoğraf geldi.` } : { ok: false, message: "Yanıt geldi ama fotoğraf dönmedi; anahtarı kontrol edin." };
        }
        case "google": {
          if (!(config.GOOGLE_CLIENT_ID.trim() && config.GOOGLE_CLIENT_SECRET.trim())) return { ok: false, message: "İstemci kimliği ve gizli anahtar girilmeli." };
          // Sahte bir kodla belirteç istenir: kimlik doğruysa Google "invalid_grant", yanlışsa "invalid_client" der.
          const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ code: "deneme", client_id: config.GOOGLE_CLIENT_ID, client_secret: config.GOOGLE_CLIENT_SECRET, redirect_uri: `${config.APP_URL}/api/auth/google/callback`, grant_type: "authorization_code" }) });
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (body.error === "invalid_grant") return { ok: true, message: "Kimlik bilgileri doğru. Google ile giriş çalışır." };
          if (body.error === "invalid_client" || body.error === "unauthorized_client") return { ok: false, message: "İstemci kimliği ya da gizli anahtar yanlış." };
          return { ok: false, message: `Google beklenmeyen yanıt verdi (${body.error ?? res.status}).` };
        }
        case "storage": {
          if (!deps.storage.enabled) return { ok: false, message: "Hesap kimliği, erişim anahtarı, gizli anahtar ve genel adresin hepsi girilmeli." };
          const key = `deneme/baglanti-${Date.now()}.txt`;
          await deps.storage.put(key, "text/plain", Buffer.from("almakisterim baglanti denemesi"));
          const head = await deps.storage.head(key);
          await deps.storage.remove(key).catch(() => {});
          return head ? { ok: true, message: "Çalışıyor: deneme dosyası yüklendi, okundu ve silindi." } : { ok: false, message: "Dosya yüklendi ama okunamadı; depo adını kontrol edin." };
        }
      }
      return { ok: false, message: "Bilinmeyen bölüm." };
    } catch (e) {
      req.log.warn({ group, err: msg(e) }, "entegrasyon denemesi başarısız");
      return { ok: false, message: `Çalışmıyor: ${msg(e)}` };
    }
  });
}
