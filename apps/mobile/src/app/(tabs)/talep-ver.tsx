import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Picker } from "@/components/Picker";
import { VehicleFields } from "@/components/VehicleFields";
import { isVehicleSub, vehicleName, type VehicleAttrs } from "@/lib/vehicles";
import { Box, Btn, Err, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { CITIES, condsFor } from "@/lib/catalog";
import { openWeb } from "@/lib/links";
import { useSession } from "@/lib/session";
import { C, R } from "@/lib/theme";
import { pickAndUpload, type Uploaded } from "@/lib/upload";
import { useCats } from "@/lib/useCats";

type Draft = { category_id: string | null; title: string; description: string; budget_max: number | null; city: string | null; district: string | null; condition?: string; attrs: Record<string, unknown> };
const MAX_PHOTOS = 8;

export default function TalepVer() {
  const { user, refresh } = useSession();
  const cats = useCats();
  const [raw, setRaw] = useState("");
  const [sub, setSub] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [budget, setBudget] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [districts, setDistricts] = useState<string[]>([]);
  const [cond, setCond] = useState("Farketmez");
  const [attrs, setAttrs] = useState<Record<string, unknown>>({});
  const [photos, setPhotos] = useState<Uploaded[]>([]);
  // Birden fazla araç seçildiyse her araç ayrı talep olur ve kendi fotoğraflarıyla yayınlanır ("Marka|Model" → fotoğraflar).
  const [carPhotos, setCarPhotos] = useState<Record<string, Uploaded[]>>({});
  const [agree, setAgree] = useState(false);
  const [smsOn, setSmsOn] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => { api<{ publish_sms: boolean }>("/categories").then((d) => setSmsOn(d.publish_sms)).catch(() => {}); }, []);
  useEffect(() => { setPhone(user?.phone ? `0${user.phone.slice(2)}` : ""); }, [user?.phone]);
  useEffect(() => {
    setDistricts([]); if (!city) return;
    api<{ districts: string[] }>(`/locations?il=${encodeURIComponent(city)}`).then((d) => setDistricts(d.districts)).catch(() => {});
  }, [city]);
  const subs = useMemo(() => (cats ?? []).flatMap((t) => (t.subs ?? []).map((s) => ({ value: s.id, label: `${t.name} › ${s.name}`, top: t.id }))), [cats]);
  const top = subs.find((s) => s.value === sub)?.top;
  const conds = condsFor(top);
  const cars = isVehicleSub(sub) ? (attrs as VehicleAttrs).araclar ?? [] : [];
  const multi = cars.length > 1;
  const carKey = (c: { marka: string; model: string | null }) => `${c.marka}|${c.model ?? ""}`;
  useEffect(() => { if (!conds.includes(cond)) setCond(conds.includes("Farketmez") ? "Farketmez" : conds[0]!); }, [top]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (k: string, fn: () => Promise<void>) => { setBusy(k); setErr(""); try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); } };
  // Tek cümleden yapay zekâ ile doldurma (sitedeki "Talep Oluştur" ile aynı).
  const fill = () => run("ai", async () => {
    const { draft } = await api<{ draft: Draft }>("/ai/draft", { body: { text: raw } });
    if (draft.category_id) setSub(draft.category_id);
    if (draft.title) setTitle(draft.title);
    if (draft.description) setDesc(draft.description);
    if (draft.budget_max) setBudget(String(draft.budget_max));
    if (draft.city && CITIES.includes(draft.city)) setCity(draft.city);
    if (draft.district) setTimeout(() => setDistrict(draft.district!), 300);
    if (draft.condition) setCond(draft.condition);
    setAttrs(draft.attrs ?? {});
    const missing = [!draft.category_id && "kategori", !draft.budget_max && "fiyat", !draft.city && "il"].filter(Boolean);
    setNote(missing.length ? `Doldurduk. Size kalan: ${missing.join(", ")}.` : "Doldurduk. Kontrol edip fotoğraf ekleyin.");
  });
  const addPhotos = (src: "camera" | "library", key?: string) => run("foto", async () => {
    const have = key ? carPhotos[key]?.length ?? 0 : photos.length;
    const up = await pickAndUpload(src, MAX_PHOTOS - have);
    if (key) setCarPhotos((m) => ({ ...m, [key]: [...(m[key] ?? []), ...up] })); else setPhotos((p) => [...p, ...up]);
  });
  const removePhoto = (id: string, key?: string) => {
    if (key) setCarPhotos((m) => ({ ...m, [key]: (m[key] ?? []).filter((y) => y.id !== id) })); else setPhotos((x) => x.filter((y) => y.id !== id));
    void api(`/media/${id}`, { method: "DELETE" }).catch(() => {});
  };
  const sendCode = () => run("kod", async () => { await api("/me/publish-code", { body: { phone } }); setCodeSent(true); });
  const publish = () => run("yayin", async () => {
    if (!sub) throw new Error("Kategori seçin.");
    if (!(Number(budget) > 0)) throw new Error("Fiyatı yazın.");
    if (!city) throw new Error("İl seçin.");
    if (!agree) throw new Error("Kuralları ve numaranızın paylaşılmasını onaylayın.");
    const r = await api<{ id: number; status: string }>("/requests", { body: {
      category_id: sub, title: title.trim(), description: desc.trim(), budget_min: null, budget_max: Number(budget), city, district, condition: cond, attrs,
      media_ids: multi ? [] : photos.map((p) => p.id), contact_consent: true,
      ...(multi ? { vehicle_media: Object.fromEntries(cars.map((c) => [carKey(c), (carPhotos[carKey(c)] ?? []).map((p) => p.id)])) } : {}), days: 14, ...(smsOn ? { phone, phone_code: code } : {}),
    } });
    await refresh();
    setRaw(""); setTitle(""); setDesc(""); setBudget(""); setPhotos([]); setCarPhotos({}); setAgree(false); setCode(""); setCodeSent(false); setNote(""); setAttrs({});
    router.push(`/talep/${r.id}`);
  });

  if (!user) return (
    <View style={{ padding: 20, gap: 14 }}>
      <Text style={{ fontSize: 20, fontWeight: "800", color: C.navy }}>Ücretsiz talep verin</Text>
      <Text style={{ color: C.muted }}>Almak istediğinizi yazın; elinde o ürün olan satıcılar size ulaşsın. Talep vermek için giriş yapın.</Text>
      <Btn title="Giriş yap / Üye ol" onPress={() => router.push("/giris")} />
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Box title="Ne almak istiyorsunuz?">
          <Field label="Tek cümleyle yazın" multiline value={raw} onChangeText={setRaw} placeholder="Örn. 2018 sonrası dizel otomatik Passat, bütçem 1,2 milyon, Ankara" />
          <Btn title="Yapay zekâ ile doldur" kind="navy" busy={busy === "ai"} disabled={raw.trim().length < 3} onPress={fill} />
          {note ? <Text style={{ color: C.green, fontWeight: "600" }}>{note}</Text> : null}
        </Box>
        <Box title="Talep detayları">
          <Picker label="Kategori *" value={sub} options={subs} onChange={setSub} />
          <Field label="Talep başlığı *" value={title} onChangeText={setTitle} maxLength={120} />
          <Field label="Açıklama" value={desc} onChangeText={setDesc} multiline maxLength={4000} />
          <Field label="Fiyat (TL) *" value={budget} onChangeText={(v) => setBudget(v.replace(/\D/g, ""))} keyboardType="number-pad" />
          <Picker label="İl *" value={city} options={CITIES.map((c) => ({ value: c, label: c }))} onChange={(c) => { setCity(c); setDistrict(""); }} />
          <Picker label="İlçe" value={district} placeholder={city ? "İlçe farketmez" : "Önce il seçin"} disabled={!city} options={[{ value: "", label: "İlçe farketmez" }, ...districts.map((d) => ({ value: d, label: d }))]} onChange={setDistrict} />
          {conds.length > 1 ? (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: C.navy }}>Ürün durumu</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>{conds.map((c) => (
                <Pressable key={c} accessibilityRole="radio" accessibilityState={{ checked: cond === c }} onPress={() => setCond(c)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill, backgroundColor: cond === c ? C.navy : C.bg }}>
                  <Text style={{ color: cond === c ? "#fff" : C.navy, fontWeight: "700" }}>{c}</Text></Pressable>))}</View>
            </View>) : null}
          {isVehicleSub(sub) ? <VehicleFields sub={sub} value={attrs as VehicleAttrs} onChange={(a) => setAttrs(a as Record<string, unknown>)} /> : null}
        </Box>
        {multi ? cars.map((c) => (
          <Box key={carKey(c)} title={`${vehicleName(c)} fotoğrafları (${carPhotos[carKey(c)]?.length ?? 0}/${MAX_PHOTOS})`}>
            <Photos items={carPhotos[carKey(c)] ?? []} busy={busy === "foto"} label={vehicleName(c)} onAdd={(src) => addPhotos(src, carKey(c))} onRemove={(id) => removePhoto(id, carKey(c))} />
          </Box>)) : (
          <Box title={`Fotoğraflar (${photos.length}/${MAX_PHOTOS})`}>
            <Photos items={photos} busy={busy === "foto"} onAdd={(src) => addPhotos(src)} onRemove={(id) => removePhoto(id)} />
            <Text style={{ fontSize: 12, color: C.muted }}>Fotoğraflı talepler satıcıların dikkatini daha çok çeker.</Text>
          </Box>)}
        <Box title="Yayınla">
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agree }} onPress={() => setAgree(!agree)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <Switch value={agree} onValueChange={setAgree} accessibilityLabel="Kuralları onaylıyorum" />
            <Text style={{ flex: 1, color: C.text, fontSize: 13 }}>
              <Text style={{ color: C.orange }} onPress={() => openWeb("/sayfa/kullanim-kosullari")}>Talep verme kurallarını</Text> ve <Text style={{ color: C.orange }} onPress={() => openWeb("/sayfa/kvkk")}>aydınlatma metnini</Text> okudum; telefon numaramın ücret ödeyen satıcılarla paylaşılmasını onaylıyorum.
            </Text>
          </Pressable>
          {smsOn ? (
            <>
              <Field label="Cep telefonu (onay kodu gelecek)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!user.phone && !codeSent} />
              {!codeSent ? <Btn kind="navy" title="SMS onay kodu gönder" busy={busy === "kod"} disabled={!phone.trim()} onPress={sendCode} />
                : <Field label="SMS ile gelen 6 haneli kod" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" />}
            </>) : null}
          {err ? <Err text={err} /> : null}
          <Btn title="Talebi Yayınla" busy={busy === "yayin"} disabled={smsOn && code.length !== 6} onPress={publish} />
        </Box>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Photos({ items, busy, label, onAdd, onRemove }: { items: Uploaded[]; busy: boolean; label?: string; onAdd: (src: "camera" | "library") => void; onRemove: (id: string) => void }) {
  return (
    <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {items.map((p) => (
          <View key={p.id}>
            <Image source={{ uri: p.uri }} style={{ width: 84, height: 84, borderRadius: R.sm }} />
            <Pressable accessibilityRole="button" accessibilityLabel="Fotoğrafı kaldır" onPress={() => onRemove(p.id)}
              style={{ position: "absolute", top: -6, right: -6, backgroundColor: C.red, borderRadius: 12 }}><Icon name="x" size={18} color="#fff" sw={2.4} /></Pressable>
          </View>))}
      </View>
      {items.length < MAX_PHOTOS ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn style={{ flex: 1 }} kind="wh" title="📷 Fotoğraf çek" label={label ? `${label} için fotoğraf çek` : undefined} busy={busy} onPress={() => onAdd("camera")} />
          <Btn style={{ flex: 1 }} kind="wh" title="🖼 Galeriden seç" label={label ? `${label} için galeriden seç` : undefined} busy={busy} onPress={() => onAdd("library")} />
        </View>) : null}
    </>
  );
}
