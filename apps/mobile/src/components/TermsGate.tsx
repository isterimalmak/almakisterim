import { useState } from "react";
import { Modal, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { api } from "@/lib/api";
import { openWeb } from "@/lib/links";
import { useSession } from "@/lib/session";
import { C, R } from "@/lib/theme";
import { Btn } from "./ui";

/** Üyelik Sözleşmesi'nin yürürlükteki sürümünü onaylamamış üyeye gösterilir (sitedeki onay penceresiyle aynı). */
export function TermsGate() {
  const { user, refresh, signOut } = useSession();
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!user || user.terms_ok !== false) return null;
  const save = async () => {
    setBusy(true); setErr("");
    try {
      await api("/me/consents", { body: { terms: true, ...(marketing && !user.marketing ? { marketing: true } : {}), context: "uygulama" } });
      await refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const doc = (slug: string, text: string) => <Text style={{ color: C.orange }} onPress={() => void openWeb(`/sozlesmeler/${slug}`)}>{text}</Text>;
  const row = (on: boolean, set: (v: boolean) => void, label: string, body: React.ReactNode) => (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => set(!on)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <Switch value={on} onValueChange={set} accessibilityLabel={label} />
      <Text style={{ flex: 1, color: C.text, fontSize: 13, lineHeight: 19 }}>{body}</Text>
    </Pressable>
  );
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,.5)", justifyContent: "center", padding: 16 }}>
        <ScrollView accessibilityViewIsModal style={{ flexGrow: 0, backgroundColor: C.card, borderRadius: R.lg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: "800", color: C.navy }}>Sözleşme onayı</Text>
          <Text style={{ color: C.text, lineHeight: 20 }}>Devam etmek için Üyelik Sözleşmesi'ni onaylamanız gerekiyor. Sözleşme {doc("talep-verme-kurallari", "Talep Verme Kuralları")}, {doc("yasakli-urunler", "Yasaklı Ürünler Listesi")} ve {doc("satici-kurallari", "Satıcı Kuralları")} eklerini de kapsar.</Text>
          {row(terms, setTerms, "Üyelik Sözleşmesi'ni onaylıyorum", <>{doc("uyelik-sozlesmesi", "Üyelik Sözleşmesi")}'ni ve eklerini okudum, kabul ediyorum. *</>)}
          {!user.marketing ? row(marketing, setMarketing, "Kampanya iletileri almak istiyorum", <>Kampanya ve yeniliklerden e-posta, SMS ve bildirimle haberdar olmak istiyorum ({doc("ticari-elektronik-ileti-onayi", "Ticari Elektronik İleti Onay Metni")}). İsteğe bağlı.</>) : null}
          <Text style={{ color: C.muted, fontSize: 12, lineHeight: 18 }}>Kişisel verilerinizin nasıl işlendiğini {doc("kvkk-aydinlatma-metni", "KVKK Aydınlatma Metni")}'nde okuyabilirsiniz.</Text>
          {err ? <Text style={{ color: C.red }}>{err}</Text> : null}
          <Btn title="Onayla ve devam et" disabled={!terms} busy={busy} onPress={() => void save()} />
          <Btn title="Çıkış yap" kind="gh" onPress={() => void signOut()} />
        </ScrollView>
      </View>
    </Modal>
  );
}
