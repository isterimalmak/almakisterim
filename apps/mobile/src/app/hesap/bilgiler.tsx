import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { Box, Btn, Err, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { confirm } from "@/lib/confirm";
import { openWeb } from "@/lib/links";
import { useSession } from "@/lib/session";
import { C } from "@/lib/theme";

const PREFS: ["offer" | "accepted" | "message", string][] = [["offer", "Talebime yeni teklif geldiğinde"], ["accepted", "Teklifim kabul edildiğinde"], ["message", "Yeni mesaj geldiğinde"]];

export default function Bilgiler() {
  const { user, ready, refresh, signOut } = useSession();
  const [name, setName] = useState(user?.name ?? "");
  const [marketing, setMarketing] = useState(!!user?.marketing);
  const [prefs, setPrefs] = useState(user?.mail_prefs ?? { offer: true, accepted: true, message: true });
  const [del, setDel] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [ok, setOk] = useState("");
  // Bilgiler oturum yüklenince forma gelir (sayfa doğrudan açıldıysa ilk anda henüz boştur).
  useEffect(() => { if (!user) return; setName(user.name); setMarketing(!!user.marketing); if (user.mail_prefs) setPrefs(user.mail_prefs); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Oturum yüklenince girişsizse (ya da hesap silinince) geri dönülür.
  useEffect(() => { if (ready && !user) router.canGoBack() ? router.back() : router.replace("/hesap"); }, [ready, user]);
  if (!user) return null;
  const save = async () => {
    setBusy("kaydet"); setErr(""); setOk("");
    try { await api("/me", { method: "PATCH", body: { ...(name.trim() ? { name: name.trim() } : {}), marketing, mail_prefs: prefs } }); await refresh(); setOk("Bilgileriniz kaydedildi."); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  // Hesap silme (Google Play / App Store zorunluluğu): sitedeki ile aynı; kutuya SİL yazılır.
  const remove = async () => {
    if (!(await confirm("Hesabınız kalıcı olarak silinecek", "Adınız, telefonunuz ve e-postanız silinir; açık talepleriniz kapanır. Bu işlem geri alınamaz.", "Hesabımı sil", true))) return;
    setBusy("sil"); setErr("");
    try { await api("/me", { method: "DELETE", body: { onay: del.trim() } }); await signOut(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}>
      <Box title="Hesap bilgileri">
        <Field label="Ad soyad / firma adı" value={name} onChangeText={setName} maxLength={80} />
        <Text style={{ color: C.muted }}>Telefon: {user.phone ? `0${user.phone.slice(2)}` : "—"}   ·   E-posta: {user.email ?? "—"}</Text>
      </Box>
      {!user.phone ? <PhoneAdd onDone={refresh} /> : null}
      <Box title="E-posta bildirimleri">
        {PREFS.map(([k, l]) => (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ flex: 1, color: C.text }}>{l}</Text>
            <Switch accessibilityLabel={l} value={prefs[k]} onValueChange={(v) => setPrefs((p) => ({ ...p, [k]: v }))} />
          </View>))}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ flex: 1, color: C.text }}>Kampanya ve fırsat e-postaları</Text>
          <Switch accessibilityLabel="Kampanya ve fırsat e-postaları" value={marketing} onValueChange={setMarketing} />
        </View>
        <Text style={{ color: C.muted, fontSize: 12 }}>Telefona gelen anlık bildirimleri telefonunuzun ayarlarından kapatabilirsiniz.</Text>
      </Box>
      {err ? <Err text={err} /> : null}
      {ok ? <Text accessibilityRole="alert" style={{ color: C.green, fontWeight: "700" }}>{ok}</Text> : null}
      <Btn title="Kaydet" busy={busy === "kaydet"} onPress={save} />
      <Box title="Hesabı sil">
        <Text style={{ color: C.muted, fontSize: 13 }}>Hesabınızı silerseniz adınız, telefon numaranız ve e-posta adresiniz kalıcı olarak silinir; açık talepleriniz kapanır. <Text style={{ color: C.orange }} onPress={() => void openWeb("/sozlesmeler/hesap-silme")}>Ayrıntılar</Text></Text>
        <Field label="Onaylamak için büyük harflerle SİL yazın" value={del} onChangeText={setDel} autoCapitalize="characters" autoCorrect={false} />
        <Btn title="Hesabımı kalıcı olarak sil" kind="wh" busy={busy === "sil"} disabled={del.trim() !== "SİL"} onPress={remove} />
      </Box>
    </ScrollView>
  );
}

// Google / Apple / e-postayla girenler için: talep vermek ve satıcıya ulaşmak için doğrulanmış telefon gerekir.
function PhoneAdd({ onDone }: { onDone: () => Promise<void> }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  return (
    <Box title="Telefon numarası ekle">
      <Text style={{ color: C.muted, fontSize: 13 }}>Talep vermek için doğrulanmış bir telefon numarası gerekir.</Text>
      <Field label="Cep telefonu" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!sent} placeholder="05xx xxx xx xx" />
      {!sent ? <Btn kind="navy" title="Doğrulama kodu gönder" busy={busy} disabled={!phone.trim()} onPress={() => run(async () => { await api("/me/phone/code", { body: { phone } }); setSent(true); })} /> : (
        <>
          <Field label="SMS ile gelen 6 haneli kod" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" />
          <Btn title="Numarayı doğrula" busy={busy} disabled={code.length !== 6} onPress={() => run(async () => { await api("/me/phone/verify", { body: { phone, code } }); await onDone(); })} />
        </>)}
      {err ? <Err text={err} /> : null}
    </Box>
  );
}
