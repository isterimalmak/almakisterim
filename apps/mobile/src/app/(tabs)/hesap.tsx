import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Btn } from "@/components/ui";
import { openWeb, openWebAuthed } from "@/lib/links";
import { useSession } from "@/lib/session";
import { C, R } from "@/lib/theme";

type Row = { icon: string; title: string; go: () => void; badge?: number };

export default function Hesap() {
  const { user, signOut, refresh } = useSession();
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const info: Row[] = [
    { icon: "shield", title: "Güvenli alışveriş ipuçları", go: () => void openWeb("/sayfa/guvenli-alisveris") },
    { icon: "book", title: "Kullanım Koşulları", go: () => void openWeb("/sayfa/kullanim-kosullari") },
    { icon: "lock", title: "KVKK Aydınlatma Metni", go: () => void openWeb("/sayfa/kvkk") },
    { icon: "mail", title: "İletişim", go: () => void openWeb("/sayfa/iletisim") },
  ];
  if (!user) return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Text style={{ fontSize: 20, fontWeight: "800", color: C.navy }}>Hesabım</Text>
      <Text style={{ color: C.muted }}>Talep vermek, satıcılara ulaşmak ve mesajlaşmak için giriş yapın.</Text>
      <Btn title="Giriş yap / Üye ol" onPress={() => router.push("/giris")} />
      <List rows={info} />
    </ScrollView>
  );
  const rows: Row[] = [
    { icon: "list", title: "Taleplerim", go: () => router.push("/hesap/taleplerim") },
    { icon: "heart", title: "Favori Talepler", go: () => router.push("/hesap/favoriler") },
    { icon: "search", title: "Size Uygun Talepler", go: () => router.push("/hesap/uygun") },
    { icon: "phone", title: "Numarasını Açtıklarım", go: () => router.push("/hesap/numaralar") },
    { icon: "bolt", title: "Talep Alarmları", go: () => router.push("/hesap/alarmlar") },
    { icon: "bell", title: "Bildirimler", go: () => router.push("/hesap/bildirimler"), badge: user.unread_notifications },
    { icon: "shield", title: "Güvenli Al satışlarım", go: () => void openWebAuthed("/guvenli-al") },
    { icon: "user", title: "Hesap Bilgileri", go: () => router.push("/hesap/bilgiler") },
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={{ backgroundColor: C.navy, borderRadius: R.lg, padding: 16, gap: 4 }}>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>{user.name || "Üye"}</Text>
        <Text style={{ color: "#C9D0E4" }}>{user.phone ? `0${user.phone.slice(2)}` : user.email}</Text>
        <Text style={{ color: "#C9D0E4", fontSize: 12 }}>Bu ay ücretsiz numara hakkı: {user.free_unlocks_left} · Krediniz: {user.credits}</Text>
      </View>
      <List rows={rows} />
      <List rows={info} />
      <Btn title="Çıkış yap" kind="wh" onPress={() => void signOut()} />
    </ScrollView>
  );
}

function List({ rows }: { rows: Row[] }) {
  return (
    <View style={{ backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line }}>
      {rows.map((r, i) => (
        <Pressable key={r.title} accessibilityRole="button" accessibilityLabel={r.title} onPress={r.go}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
          <Icon name={r.icon} size={22} color={C.navy} />
          <Text style={{ flex: 1, fontSize: 15, color: C.text }}>{r.title}</Text>
          {r.badge ? <Text style={{ backgroundColor: C.orange, color: "#fff", fontWeight: "800", paddingHorizontal: 8, borderRadius: 10 }}>{r.badge}</Text> : null}
          <Icon name="chevr" size={18} color={C.muted} />
        </Pressable>))}
    </View>
  );
}
