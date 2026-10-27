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
      {!user.phone ? <PhoneAdd onDone={refresh} /> : <PhoneChange phone={user.phone} email={user.email} onDone={refresh} />}
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

// Kayıtlı numarayı değiştirme: önce mevcut numaraya ya da e-postaya gelen kodla kimlik doğrulanır, sonra yeni numara (sitedekiyle aynı).
function PhoneChange({ phone, email, onDone }: { phone: string; email: string | null; onDone: () => Promise<void> }) {
  const [step, setStep] = useState<"idle" | "code" | "new">("idle");
  const [via, setVia] = useState<"sms" | "email">("sms");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const start = (v: "sms" | "email") => run(async () => { await api("/me/phone/change/start", { body: { via: v } }); setVia(v); setCode(""); setStep("code"); });
  const masked = `0${phone.slice(2, 5)} *** ${phone.slice(8, 10)} ${phone.slice(10)}`;
  return (
    <Box title="Telefon numarası">
      <Text style={{ color: C.text }}>Kayıtlı numaranız: <Text style={{ fontWeight: "700" }}>0{phone.slice(2)}</Text></Text>
      {step === "idle" ? (
        <>
          <Text style={{ color: C.muted, fontSize: 13 }}>Numaranızı değiştirmek için önce kimliğinizi doğrulayın. Kod nereye gönderilsin?</Text>
          <Btn kind="wh" title={`Mevcut numarama (${masked})`} busy={busy} onPress={() => void start("sms")} />
          {email ? <Btn kind="wh" title={`E-postama (${email.replace(/^(.{2}).*(@.*)$/, "$1***$2")})`} busy={busy} onPress={() => void start("email")} /> : null}
        </>
      ) : step === "code" ? (
        <>
          <Field label={via === "sms" ? "Mevcut numaranıza gelen kod" : "E-postanıza gelen kod"} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" />
          <Btn title="Doğrula" busy={busy} disabled={code.length !== 6} onPress={() => run(async () => { await api("/me/phone/change/confirm", { body: { via, code } }); setStep("new"); })} />
          <Btn kind="gh" title="Vazgeç" onPress={() => setStep("idle")} />
        </>
      ) : (
        <>
          <Text style={{ color: C.green, fontWeight: "600" }}>Kimliğiniz doğrulandı. 15 dakika içinde yeni numaranızı doğrulayın.</Text>
          <PhoneAdd title="Yeni numara" onDone={async () => { setStep("idle"); await onDone(); }} />
        </>
      )}
      <Text style={{ color: C.muted, fontSize: 12 }}>Değişiklikten sonra eski numaranıza ve e-postanıza bilgi gider. Numara 7 günde bir değiştirilebilir.</Text>
      {err ? <Err text={err} /> : null}
    </Box>
  );
}

// Google / Apple / e-postayla girenler için: talep vermek ve satıcıya ulaşmak için doğrulanmış telefon gerekir.
function PhoneAdd({ onDone, title = "Telefon numarası ekle" }: { onDone: () => Promise<void>; title?: string }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  return (
    <Box title={title}>
      {title === "Telefon numarası ekle" ? <Text style={{ color: C.muted, fontSize: 13 }}>Talep vermek için doğrulanmış bir telefon numarası gerekir.</Text> : null}
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
