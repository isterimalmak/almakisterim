"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/components/Session";
import { dateTr } from "@/lib/format";

type Aud = "all" | "buyers" | "sellers";
type Stats = {
  devices: { ios: number; android: number };
  audiences: Record<Aud, { users: number; devices: number }>;
  my_devices: number;
  campaigns: { id: number; title: string; body: string; link: string; audience: Aud | "test"; recipients: number; delivered: number; failed: number; created_at: string; created_by: string | null }[];
};
const AUD: Record<Aud | "test", string> = { all: "Uygulamayı kullanan bütün üyeler", buyers: "Talep verenler", sellers: "Satıcılar (numara açan, teklif veren, alarm kuran)", test: "Yalnız kendi telefonum (deneme)" };

// Telefon uygulamasına anlık bildirim (duyuru): önce yöneticinin kendi telefonuna denenir, sonra seçilen gruba gönderilir.
// Uygulamada "Duyurular" bildirimini kapatan üyelere gitmez.
export function PushAdmin() {
  const { toast } = useSession();
  const [s, setS] = useState<Stats | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState<Aud>("all");
  const [busy, setBusy] = useState<"" | "test" | "send">("");
  const load = () => api<Stats>("/admin/push").then(setS).catch((e) => toast((e as Error).message));
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = title.trim().length >= 2 && body.trim().length >= 5;
  const send = async (aud: Aud | "test") => {
    if (aud !== "test") {
      const n = s?.audiences[aud];
      if (!confirm(`"${title.trim()}" bildirimi ${n ? `${n.users} üyenin ${n.devices} telefonuna` : "seçilen gruba"} gönderilsin mi? Gönderilen bildirim geri alınamaz.`)) return;
    }
    setBusy(aud === "test" ? "test" : "send");
    try {
      const r = await api<{ recipients: number; delivered: number; failed: number }>("/admin/push/send", { body: { title: title.trim(), body: body.trim(), link: link.trim(), audience: aud } });
      toast(aud === "test" ? "Deneme bildirimi telefonunuza gönderildi." : `${r.recipients} üyeye gönderildi (${r.delivered} telefona ulaştı${r.failed ? `, ${r.failed} telefona ulaşmadı` : ""}).`);
      if (aud !== "test") { setTitle(""); setBody(""); setLink(""); }
      void load();
    } catch (e) { toast((e as Error).message); } finally { setBusy(""); }
  };

  return (
    <section className="ap-box" aria-label="Telefon uygulaması bildirimi"><div className="ap-box-h"><h2>Telefon Uygulaması Bildirimi</h2></div><div className="ap-box-b">
      <div className="note n-info" style={{ marginBottom: 12 }}><span>Bildirim, almakisterim uygulamasını kullanan ve bildirime izin veren üyelerin telefon ekranına düşer. Üyeler uygulamada "Duyurular"ı kapatabilir.</span></div>
      {!s ? <div className="loading">Yükleniyor…</div> : (
        <div className="rk-ozet" aria-label="Bildirim alan telefonlar">
          <div className="rk-kut"><span className="rk-et">Bildirim alan telefon</span><b className="rk-kut-ad">{s.devices.ios + s.devices.android}</b><small className="muted">{s.devices.android} Android · {s.devices.ios} iPhone</small></div>
          <div className="rk-kut"><span className="rk-et">Duyuru alacak üye</span><b className="rk-kut-ad">{s.audiences.all.users}</b><small className="muted">{s.audiences.buyers.users} talep veren · {s.audiences.sellers.users} satıcı</small></div>
          <div className="rk-kut"><span className="rk-et">Sizin telefonunuz</span><b className="rk-kut-ad">{s.my_devices ? "Bağlı" : "Bağlı değil"}</b><small className="muted">{s.my_devices ? "deneme bildirimi gönderebilirsiniz" : "uygulamada bu hesapla giriş yapıp bildirime izin verin"}</small></div>
        </div>
      )}
      <div className="form-grid" style={{ maxWidth: 620 }}>
        <div className="fg full"><label htmlFor="p-title">Başlık *</label><input className="inp" id="p-title" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Hafta sonu fırsatı" /><span className="hint">{title.length}/60</span></div>
        <div className="fg full"><label htmlFor="p-body">Telefon bildirimi metni *</label><textarea className="txa" id="p-body" rows={3} maxLength={180} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Örn. Bu hafta vasıta kategorisinde 120 yeni alıcı var, hemen bakın!" /><span className="hint">{body.length}/180</span></div>
        <div className="fg full"><label htmlFor="p-link">Dokununca açılacak sayfa (isteğe bağlı)</label><input className="inp" id="p-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/kategori/vasita" /><span className="hint">Boş bırakılırsa ana sayfa açılır.</span></div>
        <div className="fg full"><label>Kime</label><div className="radio-row">
          {(["all", "buyers", "sellers"] as const).map((k) => (
            <label key={k}><input type="radio" name="p-aud" checked={audience === k} onChange={() => setAudience(k)} />{AUD[k]}{s && <span className="muted"> ({s.audiences[k].users})</span>}</label>
          ))}
        </div></div>
      </div>
      {/* Telefon görünümü: bildirimin ekranda nasıl duracağı */}
      {ready && (
        <div className="push-onizle" title="Önizleme">
          <span className="push-ic" aria-hidden="true">ai</span>
          <div><b>{title.trim()}</b><p>{body.trim()}</p></div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" className="btn btn-wh" disabled={!ready || !!busy} onClick={() => void send("test")}>{busy === "test" ? "Gönderiliyor…" : "Kendime dene"}</button>
        <button type="button" className="btn btn-or" disabled={!ready || !!busy} onClick={() => void send(audience)}>{busy === "send" ? "Gönderiliyor…" : "Telefonlara gönder"}</button>
      </div>

      {!!s?.campaigns.length && (<>
        <h3 style={{ margin: "18px 0 8px", fontSize: 14 }}>Gönderilenler</h3>
        <table className="tbl" aria-label="Gönderilen telefon bildirimleri"><thead><tr><th>Bildirim</th><th>Kime</th><th className="r">Ulaşan</th><th>Tarih</th></tr></thead><tbody>
          {s.campaigns.map((c) => (
            <tr key={c.id}>
              <td><b>{c.title}</b><div className="ti-s">{c.body}</div></td>
              <td data-m="Kime">{AUD[c.audience]}</td>
              <td data-m="Ulaşan" className="r">{c.delivered}{c.failed ? <span className="muted"> / {c.failed} ulaşmadı</span> : null}</td>
              <td data-m="Tarih" className="nowrap muted">{dateTr(c.created_at)}</td>
            </tr>
          ))}
        </tbody></table>
      </>)}
    </div></section>
  );
}
