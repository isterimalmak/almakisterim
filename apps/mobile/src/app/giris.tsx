import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Btn, Err, Field } from "@/components/ui";
import { api, API_URL } from "@/lib/api";
import { openWeb } from "@/lib/links";
import { useSession } from "@/lib/session";
import { C } from "@/lib/theme";

WebBrowser.maybeCompleteAuthSession();

export default function Giris() {
  const { signIn } = useSession();
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [google, setGoogle] = useState(false);
  const [apple, setApple] = useState(false);
  useEffect(() => { api<{ google: boolean }>("/auth/providers").then((p) => setGoogle(p.google)).catch(() => {}); }, []);
  // Apple ile Giriş yalnızca iPhone'da (App Store kuralı: Google ile giriş varsa Apple ile giriş de sunulur).
  useEffect(() => { if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setApple).catch(() => {}); }, []);

  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const send = () => run(async () => { await api("/auth/code", { body: { channel, target } }); setSent(true); });
  const verify = () => run(async () => {
    const r = await api<{ token: string }>("/auth/verify", { body: { channel, target, code, ...(name.trim() ? { name: name.trim() } : {}) } });
    await signIn(r.token);
    router.back();
  });
  // Google girişi telefonun tarayıcısında yapılır (Google uygulama içi görünümde girişe izin vermez); uygulamaya bilet döner.
  const withGoogle = () => run(async () => {
    const res = await WebBrowser.openAuthSessionAsync(`${API_URL}/api/auth/google?app=1`, "almakisterim://giris");
    if (res.type !== "success") return;
    const u = new URL(res.url);
    if (u.searchParams.get("hata")) throw new Error("Google ile giriş yapılamadı, lütfen tekrar deneyin.");
    const r = await api<{ token: string }>("/auth/app-ticket", { body: { bilet: u.searchParams.get("bilet") } });
    await signIn(r.token);
    router.back();
  });

  const withApple = () => run(async () => {
    try {
      const c = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL] });
      if (!c.identityToken) throw new Error("Apple ile giriş yapılamadı.");
      const fullName = [c.fullName?.givenName, c.fullName?.familyName].filter(Boolean).join(" ");
      const r = await api<{ token: string }>("/auth/apple", { body: { identity_token: c.identityToken, ...(fullName ? { name: fullName } : {}) } });
      await signIn(r.token);
      router.back();
    } catch (e) {
      if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return; // kullanıcı vazgeçti
      throw e;
    }
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 22, fontWeight: "800", color: C.navy }}>almakisterim'e hoş geldiniz</Text>
        <Text style={{ color: C.muted }}>Telefon numaranıza ya da e-postanıza gelen kodla giriş yapın; hesabınız yoksa otomatik açılır.</Text>
        <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 8 }}>
          {(["sms", "email"] as const).map((c) => (
            <Pressable key={c} accessibilityRole="tab" accessibilityState={{ selected: channel === c }} onPress={() => { setChannel(c); setSent(false); setTarget(""); }}
              style={{ flex: 1, padding: 12, borderRadius: 999, alignItems: "center", backgroundColor: channel === c ? C.navy : C.card, borderWidth: 1, borderColor: C.line }}>
              <Text style={{ fontWeight: "700", color: channel === c ? "#fff" : C.navy }}>{c === "sms" ? "Telefon" : "E-posta"}</Text>
            </Pressable>
          ))}
        </View>
        <Field label={channel === "sms" ? "Cep telefonu" : "E-posta adresi"} value={target} onChangeText={setTarget} editable={!sent}
          keyboardType={channel === "sms" ? "phone-pad" : "email-address"} autoCapitalize="none" autoComplete={channel === "sms" ? "tel" : "email"} placeholder={channel === "sms" ? "05xx xxx xx xx" : "ornek@ornek.com"} />
        {!sent ? <Btn title="Kod gönder" onPress={send} busy={busy} disabled={!target.trim()} /> : (
          <>
            <Field label="Gelen 6 haneli kod" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" />
            <Field label="Adınız soyadınız (yeni üyeyseniz)" value={name} onChangeText={setName} autoComplete="name" />
            <Btn title="Giriş yap" onPress={verify} busy={busy} disabled={code.length !== 6} />
            <Btn title="Numarayı / adresi değiştir" kind="gh" onPress={() => { setSent(false); setCode(""); }} />
          </>
        )}
        {err ? <Err text={err} /> : null}
        {google || apple ? <Text style={{ textAlign: "center", color: C.muted }}>ya da</Text> : null}
        {apple ? <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE} buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={999} style={{ height: 48 }} onPress={withApple} /> : null}
        {google ? <Btn title="Google ile devam et" kind="wh" onPress={withGoogle} busy={busy} /> : null}
        <Text style={{ fontSize: 12, color: C.muted, textAlign: "center" }}>
          Giriş yaptıktan sonra <Text style={{ color: C.orange }} onPress={() => openWeb("/sozlesmeler/uyelik-sozlesmesi")}>Üyelik Sözleşmesi</Text>'ni onaylamanız istenir. Kişisel verileriniz <Text style={{ color: C.orange }} onPress={() => openWeb("/sozlesmeler/kvkk-aydinlatma-metni")}>KVKK Aydınlatma Metni</Text> kapsamında işlenir.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
