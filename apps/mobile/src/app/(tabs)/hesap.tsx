import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Btn, Press } from "@/components/ui";
import { api } from "@/lib/api";
import { openWeb, openWebAuthed } from "@/lib/links";
import { useSession } from "@/lib/session";
import { usePaymentsUi } from "@/lib/useCats";
import { C, G, R, SH } from "@/lib/theme";

type Row = { icon: string; title: string; go: () => void; badge?: number; tone?: string };

export default function Hesap() {
  const { user, signOut, refresh } = useSession();
  const ui = usePaymentsUi();
  // Özet (sitedeki Bana Özel → Özet gibi): açık taleplerim, okunmamış mesajlar, alarmlarıma uyan talepler.
  const [sum, setSum] = useState<{ open: number; matches: number } | null>(null);
  useFocusEffect(useCallback(() => {
    void refresh();
    if (!user) return;
    void Promise.all([
      api<{ items: { status?: string }[] }>("/me/requests").then((x) => x.items.filter((r) => r.status === "active").length).catch(() => 0),
      api<{ items: unknown[] }>("/me/matches").then((x) => x.items.length).catch(() => 0),
    ]).then(([open, matches]) => setSum({ open, matches }));
  }, [refresh, user?.id]));
  const info: Row[] = [
    { icon: "book", title: "Sık Sorulan Sorular", go: () => void openWeb("/sss") },
    { icon: "shield", title: "Güvenli alışveriş ipuçları", go: () => void openWeb("/sozlesmeler/guvenli-alisveris") },
    { icon: "book", title: "Sözleşmeler ve Kurallar", go: () => void openWeb("/sozlesmeler") },
    { icon: "lock", title: "KVKK Aydınlatma Metni", go: () => void openWeb("/sozlesmeler/kvkk-aydinlatma-metni") },
    { icon: "mail", title: "İletişim", go: () => void openWeb("/sayfa/iletisim") },
  ];
  if (!user) return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <LinearGradient colors={G.navy} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: R.lg, padding: 20, gap: 12 }, SH.md]}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(255,255,255,.14)", alignItems: "center", justifyContent: "center" }}><Icon name="user" size={28} color="#fff" /></View>
        <Text style={{ color: "#fff", fontSize: 21, fontWeight: "900" }}>almakisterim'e hoş geldiniz</Text>
        {["Almak istediğinizi ücretsiz yazın", "Satıcılar size ulaşsın, teklifleri karşılaştırın", "Satıcıysanız alarm kurun, müşteriyi ilk siz bulun"].map((t) => (
          <View key={t} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Icon name="check" size={16} color="#FFB37F" sw={2.6} /><Text style={{ color: "#DCE2F2", flex: 1 }}>{t}</Text></View>
        ))}
        <Btn title="Giriş yap / Üye ol" onPress={() => router.push("/giris")} style={{ marginTop: 4 }} />
      </LinearGradient>
      <List rows={info} />
    </ScrollView>
  );
  const rows: Row[] = [
    { icon: "list", title: "Taleplerim", go: () => router.push("/hesap/taleplerim"), tone: "#1F54C9" },
    { icon: "heart", title: "Favori Talepler", go: () => router.push("/hesap/favoriler"), tone: "#D93025" },
    { icon: "search", title: "Size Uygun Talepler", go: () => router.push("/hesap/uygun"), tone: "#7C3AED" },
    { icon: "phone", title: "Numarasını Açtıklarım", go: () => router.push("/hesap/numaralar"), tone: "#18794E" },
    { icon: "bolt", title: "Talep Alarmları", go: () => router.push("/hesap/alarmlar"), tone: C.orange },
    { icon: "bell", title: "Bildirimler", go: () => router.push("/hesap/bildirimler"), badge: user.unread_notifications, tone: "#A55A12" },
    ...(ui.show_safe ? [{ icon: "shield", title: "Güvenli Al satışlarım", go: () => void openWebAuthed("/guvenli-al"), tone: "#0F6B85" }] : []),
    { icon: "user", title: "Hesap Bilgileri", go: () => router.push("/hesap/bilgiler"), tone: C.navy },
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <LinearGradient colors={G.navy} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: R.lg, padding: 18, gap: 14 }, SH.md]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: C.orange, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>{initials(user.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: 19, fontWeight: "900" }} numberOfLines={1}>{user.name || "Üye"}</Text>
            <Text style={{ color: "#C9D0E4" }} numberOfLines={1}>{user.phone ? `0${user.phone.slice(2)}` : user.email}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Stat n={user.free_unlocks_left} l="ücretsiz numara hakkı (bu ay)" />
          {ui.show_credits ? <Stat n={user.credits} l="kredi" /> : null}
        </View>
      </LinearGradient>
      <View accessibilityLabel="Özet" style={{ flexDirection: "row", gap: 10 }}>
        <Tile n={sum?.open} l="Açık talebim" icon="list" tone="#1F54C9" go={() => router.push("/hesap/taleplerim")} />
        <Tile n={user.unread_messages ?? 0} l="Okunmamış mesaj" icon="chat" tone={C.orange} go={() => router.push("/mesajlar")} />
        <Tile n={sum?.matches} l="Size uygun talep" icon="search" tone="#7C3AED" go={() => router.push("/hesap/uygun")} />
      </View>
      <List rows={rows} />
      <List rows={info} />
      <Btn title="Çıkış yap" kind="wh" onPress={() => void signOut()} />
    </ScrollView>
  );
}

const initials = (name: string) => (name || "Ü").trim().split(/\s+/).slice(0, 2).map((w) => w[0]!.toLocaleUpperCase("tr")).join("");

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,.1)", borderRadius: R.md, padding: 12 }}>
      <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900" }}>{n}</Text>
      <Text style={{ color: "#C9D0E4", fontSize: 12 }}>{l}</Text>
    </View>
  );
}

function Tile({ n, l, icon, tone, go }: { n: number | undefined; l: string; icon: string; tone: string; go: () => void }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={`${l}: ${n ?? "…"}`} onPress={go} style={[{ flex: 1, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 12, gap: 4 }, SH.sm]}>
      <Icon name={icon} size={18} color={tone} />
      <Text style={{ fontSize: 22, fontWeight: "900", color: C.navy }}>{n ?? "…"}</Text>
      <Text style={{ fontSize: 12, color: C.muted, fontWeight: "600" }} numberOfLines={2}>{l}</Text>
    </Press>
  );
}

function List({ rows }: { rows: Row[] }) {
  return (
    <View style={[{ backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, overflow: "hidden" }, SH.sm]}>
      {rows.map((r, i) => (
        <Press key={r.title} accessibilityRole="button" accessibilityLabel={r.title} onPress={r.go} scale={0.99}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
          <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: `${r.tone ?? C.navy}14`, alignItems: "center", justifyContent: "center" }}>
            <Icon name={r.icon} size={20} color={r.tone ?? C.navy} />
          </View>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: C.text }}>{r.title}</Text>
          {r.badge ? <Text style={{ backgroundColor: C.orange, color: "#fff", fontWeight: "800", fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: "hidden" }}>{r.badge}</Text> : null}
          <Icon name="chevr" size={18} color="#A0A6B0" />
        </Press>))}
    </View>
  );
}
