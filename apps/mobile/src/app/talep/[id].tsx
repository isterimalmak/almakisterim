import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Dimensions, FlatList, Linking, Pressable, RefreshControl, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import { Box, Btn, Err, ReqCard, Skeleton } from "@/components/ui";
import { theme } from "@/lib/home";
import { abs, api, API_URL, ApiError } from "@/lib/api";
import { attrsFor } from "@/lib/catalog";
import { confirm } from "@/lib/confirm";
import { openWebAuthed } from "@/lib/links";
import { ago, dateTr, isAny, place, price } from "@/lib/format";
import { isVehicleSub, vehicleRows, type VehicleAttrs } from "@/lib/vehicles";
import { useSession } from "@/lib/session";
import { C, R, SH } from "@/lib/theme";
import type { Contact, Page, Req } from "@/lib/types";

const W = Dimensions.get("window").width;
const CAT_ICON: Record<string, string> = { vasita: "car", emlak: "home", elektronik: "phone", ev: "sofa", yedek: "gear", hizmet: "wrench", ders: "book", sanayi: "crane", moda: "shirt", bebek: "stroller", spor: "bike", toptan: "box" };
const LABELS: Record<string, string> = { marka: "Marka", model: "Model", yil: "Yıl", yakit: "Yakıt", vites: "Vites", km: "Kilometre", oda: "Oda sayısı", m2: "m²", hafiza: "Hafıza", renk: "Renk", isitma: "Isıtma", esya: "Eşyalı", imar: "İmar durumu", tapu: "Tapu" };
const phoneTr = (p: string) => p.replace(/^90(\d{3})(\d{3})(\d{2})(\d{2})$/, "0$1 $2 $3 $4");
const val = (v: unknown) => (Array.isArray(v) ? v.filter((x) => !isAny(x)).join(", ") : typeof v === "object" && v ? Object.values(v).filter((x) => !isAny(x)).join(" – ") : String(v));

// Kapanan talep: sayfa kaldırılmaz; aynı kategorideki (önce aynı ildeki) açık talepler gösterilir (sitedeki gibi).
function Similar({ r }: { r: Req }) {
  const [items, setItems] = useState<Req[] | null>(null);
  useEffect(() => {
    const get = (city?: string) => api<Page<Req>>(`/requests?${new URLSearchParams({ sub: r.category_id, per: "6", ...(city ? { city } : {}) })}`).then((x) => x.items);
    void get(r.city).then(async (xs) => (xs.length ? xs : get())).then((xs) => setItems(xs.filter((x) => x.id !== r.id))).catch(() => setItems([]));
  }, [r.id, r.category_id, r.city]);
  return (
    <View accessibilityLabel="Benzer açık talepler" style={{ gap: 8 }}>
      <Box><Text style={{ color: C.text }}><Text style={{ fontWeight: "800" }}>Bu talep kapandı.</Text> Alıcı artık teklif almıyor. Aşağıda {r.category_name} kategorisindeki açık talepleri görebilirsiniz.</Text></Box>
      {items === null ? <Skeleton rows={2} /> : items.length ? items.map((x) => <ReqCard key={x.id} r={x} />)
        : <Text style={{ color: C.muted }}>Şu an bu kategoride açık talep yok.</Text>}
      <Text accessibilityRole="link" style={{ color: C.orange, fontWeight: "700" }} onPress={() => router.push({ pathname: "/talepler", params: { top: r.top_id, sub: r.category_id } })}>{r.category_name} kategorisindeki tüm talepler ›</Text>
    </View>
  );
}

export default function Talep() {
  const bottom = useSafeAreaInsets().bottom;
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [d, setD] = useState<{ request: Req; contact: Contact | null } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [ok, setOk] = useState("");
  // Açık şikâyet penceresi: talep, satıcı (numara sorunu) ya da alıcının rahatsız eden satıcıyı bildirmesi
  // Güvenli Al açık mı ve hangi ana kategorilerde (sitedeki satış kutusuyla aynı koşul).
  const [safe, setSafe] = useState<{ enabled: boolean; tops: string[] } | null>(null);
  useEffect(() => { void api<{ enabled: boolean; tops: string[] }>("/safe/info").then(setSafe).catch(() => setSafe(null)); }, [user?.id]);
  const [sheet, setSheet] = useState<null | { kind: "talep" } | { kind: "numara"; unlockId: number } | { kind: "rahatsiz"; unlockId: number }>(null);
  const load = useCallback(async () => {
    try { const x = await api<{ request: Req; contact: Contact | null }>(`/requests/${id}`); setD(x); setPhone(x.contact?.phone ?? null); }
    catch (e) { setErr((e as Error).message); }
  }, [id]);
  useEffect(() => { void load(); }, [load, user?.id]);

  if (err && !d) return <View style={{ padding: 20 }}><Err text={err} /></View>;
  if (!d) return <Skeleton rows={3} />;
  const r = d.request;
  const media = (r.media ?? []).filter((m) => m.kind === "image");
  // Alan adları kategorinin tanımından (oda sayısı, m², ısıtma…).
  const labels: Record<string, string> = Object.fromEntries(attrsFor(r.top_id, r.category_id).map((a) => [a.k, a.l.replace(/ \(.*\)$/, "")]));
  // Araç taleplerinde marka/model, yıl ve km aralıkları okunur satırlara çevrilir.
  const attrs: [string, unknown][] = isVehicleSub(r.category_id) ? vehicleRows(r.attrs as VehicleAttrs)
    : Object.entries(r.attrs ?? {}).filter(([, v]) => !isAny(v) && typeof v !== "boolean" && (typeof v !== "object" || Array.isArray(v))).slice(0, 14);
  const needLogin = () => { router.push("/giris"); };

  const unlock = async () => {
    if (!user) return needLogin();
    setBusy(true); setErr("");
    try { const x = await api<{ phone: string }>(`/requests/${r.id}/unlock`, { method: "POST", body: {} }); setPhone(x.phone); }
    catch (e) {
      // Uygulamada kredi satılmaz (mağaza kuralı: dijital ürün yalnız mağazanın ödeme sistemiyle satılabilir).
      if (e instanceof ApiError && e.status === 402) setErr("Bu ayki ücretsiz numara hakkınız ve krediniz bitti.");
      else setErr((e as Error).message);
    } finally { setBusy(false); }
  };
  const fav = async () => {
    if (!user) return needLogin();
    try { await api(`/me/favorites/${r.id}`, { method: r.is_favorite ? "DELETE" : "PUT", body: {} }); await load(); } catch (e) { setErr((e as Error).message); }
  };
  const report = async (kind: "talep" | "numara" | "rahatsiz", unlockId: number | null, reason: string, note: string) => {
    setErr(""); setOk("");
    try {
      if (kind === "talep") { await api(`/requests/${r.id}/report`, { body: { reason: note ? `${reason}: ${note}` : reason } }); setOk("Şikâyetiniz alındı. Ekibimiz inceleyecek."); }
      else { await api(`/unlocks/${unlockId}/report`, { body: { reason, note } }); setOk(kind === "rahatsiz" ? "Şikâyetiniz alındı; numaranız bu satıcıdan gizlendi." : "Bildiriminiz alındı. İncelenip haklıysanız krediniz iade edilecek."); await load(); }
    } catch (e) { setErr((e as Error).message); }
  };
  const setHidden = async (hidden: boolean) => {
    if (hidden && !(await confirm("Numaranızı gizle", "Numaranız hiçbir satıcıya gösterilmeyecek ve yeni satıcılar sizi arayamayacak.", "Gizle", true))) return;
    try { await api(`/requests/${r.id}/contact`, { body: { hidden } }); await load(); } catch (e) { setErr((e as Error).message); }
  };
  // Benzer talepler için alarm: bu talebin kategorisi ve ili (sitedeki düğmeyle aynı).
  const alarm = async () => {
    if (!user) return needLogin();
    setErr(""); setOk("");
    try { await api("/me/alarms", { body: { category_id: r.category_id, ...(r.city ? { city: r.city } : {}), min_budget: 0 } }); setOk(`Alarm kuruldu: ${r.category_name}${r.city ? `, ${r.city}` : ""}. Benzer talep gelince size haber vereceğiz.`); }
    catch (e) { setErr((e as Error).message); }
  };
  const c = d.contact;
  const close = async () => {
    if (!(await confirm("Talebi kapat", "Talebiniz yayından kalkar, numaranız yeni satıcılara gösterilmez.", "Kapat", true))) return;
    try { await api(`/requests/${r.id}/close`, { method: "POST", body: {} }); await load(); } catch (e) { setErr((e as Error).message); }
  };

  return (
    <>
      <Stack.Screen options={{ title: `#${r.id}`, headerRight: () => (
        <View style={{ flexDirection: "row", gap: 16 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={r.is_favorite ? "Favorilerden çıkar" : "Favorilere ekle"} onPress={fav}><Icon name="heart" size={23} color={r.is_favorite ? C.red : C.navy} fill={r.is_favorite ? C.red : "none"} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Paylaş" onPress={() => void Share.share({ message: `${r.title} – ${API_URL}/talep/${r.id}` })}><Icon name="share" size={22} color={C.navy} /></Pressable>
        </View>) }} />
      <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={load} />} contentContainerStyle={{ paddingBottom: 110 + bottom }}>
        {media.length ? (
          <FlatList horizontal pagingEnabled data={media} keyExtractor={(m) => m.id} showsHorizontalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <View><Image source={{ uri: abs(item.url) }} style={{ width: W, height: W * 0.75, backgroundColor: "#000" }} contentFit="contain" accessibilityLabel={`Fotoğraf ${index + 1}`} />
                <Text style={{ position: "absolute", right: 10, bottom: 10, color: "#fff", backgroundColor: "rgba(0,0,0,.55)", paddingHorizontal: 8, borderRadius: 10 }}>{index + 1}/{media.length}</Text></View>
            )} />
        ) : (
          <View style={{ height: 150, backgroundColor: theme(r.top_id).c, alignItems: "center", justifyContent: "center", gap: 6 }}>
            <View style={{ width: 66, height: 66, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}><Icon name={CAT_ICON[r.top_id] ?? "box"} size={34} color={theme(r.top_id).fc} /></View>
            <Text style={{ color: theme(r.top_id).fc, fontWeight: "800" }}>{r.top_name}</Text>
          </View>
        )}
        <View style={{ padding: 14, gap: 12, marginTop: -14, backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              {r.is_urgent ? <Text style={{ backgroundColor: C.red, color: "#fff", fontSize: 11, fontWeight: "800", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 }}>ACİL</Text> : null}
              {r.is_corporate ? <Text style={{ backgroundColor: C.navy, color: "#fff", fontSize: 11, fontWeight: "800", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 }}>KURUMSAL</Text> : null}
              <Text style={{ color: C.muted, fontSize: 12 }}>{r.top_name} › {r.category_name}</Text>
            </View>
            <Text accessibilityRole="header" style={{ fontSize: 21, fontWeight: "900", color: C.navy, lineHeight: 27 }}>{r.title}</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
              <Text style={{ fontSize: 26, fontWeight: "900", color: C.orange }}>{price(r.budget_max)}</Text>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: "700" }}>bütçe</Text>
            </View>
            {/* Konum, tarih ve teklif sayısı küçük etiketler hâlinde */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {[["pin", place(r)], ["clock", ago(r.created_at)], ["chat", `${r.offer_count} teklif`]].filter(([, t]) => t).map(([ic, t]) => (
                <View key={ic} style={[{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.card, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.line }]}>
                  <Icon name={ic!} size={13} color={C.muted} /><Text style={{ color: C.text, fontSize: 12, fontWeight: "600" }}>{t}</Text>
                </View>))}
            </View>
            {r.status !== "active" ? <Text style={{ color: C.red, fontWeight: "700" }}>{r.status === "pending_review" ? "İnceleniyor" : "Bu talep kapandı"}</Text> : null}
          </View>
          <Box title="Talep bilgileri">
            {[["Talep no", `#${r.id}`], ["Kategori", r.category_name], ["Konum", [r.city, r.district, r.neighbourhood].filter(Boolean).join(" / ")], ...(isAny(r.condition) ? [] : [["Durum", r.condition]]),
              ...attrs.map(([k, v]) => [labels[k] ?? LABELS[k] ?? k.replace(/_/g, " "), val(v)]), ["Yayın tarihi", dateTr(r.created_at)], ["Son tarih", dateTr(r.expires_at)], ["Teklif", String(r.offer_count)]]
              .filter(([, v]) => v).map(([k, v]) => (
                <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, borderBottomWidth: 1, borderBottomColor: C.bg, paddingBottom: 6 }}>
                  <Text style={{ color: C.muted }}>{k}</Text><Text style={{ fontWeight: "700", color: C.text, flexShrink: 1, textAlign: "right" }}>{v}</Text>
                </View>))}
          </Box>
          {r.description ? <Box title="Açıklama"><Text style={{ lineHeight: 21, color: C.text }}>{r.description}</Text></Box> : null}
          {r.group?.length ? (
            <Box title="Aynı alıcının diğer araç talepleri">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{r.group.map((g) => (
                <Pressable key={g.id} accessibilityRole="link" onPress={() => router.push(`/talep/${g.id}`)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, backgroundColor: C.bg }}>
                  <Text style={{ color: C.navy, fontWeight: "700" }}>{g.title}</Text></Pressable>))}</View>
            </Box>) : null}
          {r.is_owner && c ? (
            <Box title="Numaranız">
              <Text style={{ color: C.text }}>{c.hidden ? "Numaranız gizli; hiçbir satıcı göremez." : `Numaranızı şu ana kadar ${c.used}${c.limit > 0 ? ` / ${c.limit}` : ""} satıcı gördü.`}</Text>
              {(c.viewers ?? []).map((v) => (
                <View key={v.unlock_id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: C.text }}>{v.seller_name} <Text style={{ color: C.muted }}>· {ago(v.created_at)}</Text></Text>
                  {v.reported ? <Text style={{ color: C.muted, fontSize: 12 }}>Şikâyet edildi</Text>
                    : <Text accessibilityRole="button" accessibilityLabel={`${v.seller_name} rahatsız etti`} style={{ color: C.red, fontWeight: "700" }} onPress={() => setSheet({ kind: "rahatsiz", unlockId: v.unlock_id })}>Rahatsız etti</Text>}
                </View>))}
              <Text accessibilityRole="button" style={{ color: C.orange, fontWeight: "700" }} onPress={() => void setHidden(!c.hidden)}>{c.hidden ? "Numaramı yeniden paylaş" : "Numaramı artık gösterme"}</Text>
            </Box>
          ) : null}
          {!r.is_owner && phone ? (
            <Box title="Alıcıyla iletişim">
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Btn style={{ flex: 1 }} kind="wh" title="WhatsApp'tan yaz" onPress={() => void Linking.openURL(`https://wa.me/${phone}`)} />
                {c?.unlock_id ? <Btn style={{ flex: 1 }} kind="gh" title="Sorun bildir" onPress={() => setSheet({ kind: "numara", unlockId: c.unlock_id! })} /> : null}
              </View>
              <Text style={{ color: C.muted, fontSize: 12 }}>Numarayı yalnızca bu talep için kullanın. Alıcıyı rahatsız eden satıcıların hesabı kapatılır.</Text>
            </Box>
          ) : null}
          {!r.is_owner && c?.unlocked && !c.blocked && r.status === "active" && safe?.enabled && safe.tops?.includes(r.top_id) ? (
            <View accessibilityLabel="Güvenli Al" style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 14, borderRadius: R.lg, backgroundColor: "#E8F4F7", borderWidth: 1, borderColor: "#BFE0E8" }}>
              <Icon name="shield" size={26} color="#0F6B85" />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontWeight: "800", color: "#0F4C5C" }}>Alıcıyla anlaştınız mı? Güvenli Al ile satın.</Text>
                <Text style={{ color: C.text, fontSize: 12 }}>Alıcı kartla öder, para bizde bekler; ürünü teslim alıp onaylayınca hesabınıza geçer.</Text>
                <Text accessibilityRole="button" style={{ color: "#0F6B85", fontWeight: "800", marginTop: 2 }} onPress={() => void openWebAuthed(`/talep/${r.id}`)}>Güvenli Al ile sat ›</Text>
              </View>
            </View>
          ) : !r.is_owner && c && r.status === "active" && !phone ? (
            <Text style={{ color: C.muted, fontSize: 12 }}>
              Numarayı en fazla {c.limit || "sınırsız"} satıcı görebilir{c.slots_left != null ? `; ${c.slots_left} hak kaldı` : ""}. Ücret: {c.price ? `${c.price} kredi` : "ücretsiz"}{user ? ` · Bu ay kalan ücretsiz hakkınız: ${user.free_unlocks_left}` : ""}.
            </Text>
          ) : null}
          <Box title="Alıcı"><Text style={{ fontWeight: "700" }}>{r.buyer_name}{r.is_corporate ? " · Kurumsal" : ""}</Text><Text style={{ color: C.muted, fontSize: 12 }}>Ürünü görmeden kapora veya ödeme göndermeyin; şüpheli durumda bize bildirin.</Text></Box>
          {!r.is_owner ? <Btn kind="wh" icon="bell" title="Benzer talepler için alarm kur" onPress={() => void alarm()} /> : null}
          {ok ? <Text accessibilityRole="alert" style={{ color: C.green, fontWeight: "700" }}>{ok}</Text> : null}
          {err ? <Err text={err} /> : null}
          {r.status !== "active" && r.status !== "pending_review" && !r.is_owner ? <Similar r={r} /> : null}
          {!r.is_owner ? <Text accessibilityRole="button" style={{ color: C.muted, textAlign: "center", textDecorationLine: "underline" }} onPress={() => setSheet({ kind: "talep" })}>Talebi şikâyet et</Text> : null}
        </View>
      </ScrollView>
      <Sheet visible={!!sheet} onClose={() => setSheet(null)}
        title={sheet?.kind === "talep" ? "Talebi şikâyet et" : sheet?.kind === "numara" ? "Sorun nedir?" : "Satıcıyı şikâyet et"}
        note={sheet?.kind === "talep" ? "Kısaca açıklayın (isteğe bağlı)" : sheet?.kind === "rahatsiz" ? "Satıcı sizi nasıl rahatsız etti? (isteğe bağlı)" : "Kısaca açıklayın (isteğe bağlı)"}
        options={sheet?.kind === "talep" ? [{ value: "Sahte veya yanıltıcı talep", label: "Sahte veya yanıltıcı talep" }, { value: "Yasaklı ürün veya hizmet", label: "Yasaklı ürün veya hizmet" }, { value: "Hakaret veya uygunsuz içerik", label: "Hakaret veya uygunsuz içerik" }, { value: "Dolandırıcılık şüphesi", label: "Dolandırıcılık şüphesi" }]
          : sheet?.kind === "numara" ? [{ value: "ulasilamiyor", label: "Numaraya ulaşılamıyor" }, { value: "yanlis_numara", label: "Yanlış numara" }, { value: "sahte_talep", label: "Sahte talep" }]
          : [{ value: "rahatsiz_etti", label: "Beni rahatsız etti (numaram bu satıcıdan gizlensin)" }]}
        onSubmit={(v, n) => { if (sheet) void report(sheet.kind, "unlockId" in sheet ? sheet.unlockId : null, v, n); }} />
      <View style={[{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, paddingBottom: 22 + bottom, backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, flexDirection: "row", gap: 8 }, SH.lg]}>
        {r.is_owner ? (
          r.status === "active" ? <Btn style={{ flex: 1 }} kind="wh" title="Talebi kapat" onPress={close} /> : <Text style={{ flex: 1, textAlign: "center", color: C.muted, padding: 12 }}>Bu sizin talebiniz.</Text>
        ) : r.status !== "active" ? <Text style={{ flex: 1, textAlign: "center", color: C.muted, padding: 12 }}>Bu talep artık yayında değil.</Text> : (
          <>
            {phone ? <Btn style={{ flex: 1 }} kind="navy" title={`📞 ${phoneTr(phone)}`} label="Alıcıyı ara" onPress={() => void Linking.openURL(`tel:+${phone}`)} />
              : d.contact?.has_phone && !d.contact.hidden ? <Btn style={{ flex: 1 }} kind="navy" title={d.contact.price ? `Numarayı Gör (${d.contact.price} kredi)` : "Numarayı Gör"} busy={busy} onPress={unlock} /> : null}
            <Btn style={{ flex: 1 }} title="Mesaj yaz" onPress={() => (user ? router.push(`/mesaj/${r.id}`) : needLogin())} />
          </>
        )}
      </View>
    </>
  );
}
