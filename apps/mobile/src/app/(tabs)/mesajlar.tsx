import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { Empty, Press, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import { useSession } from "@/lib/session";
import { C, R, SH } from "@/lib/theme";

type Item = { request_id: number; title: string; role: "alici" | "satici"; other_name: string; last_body: string; last_at: string; unread: number };

export default function Mesajlar() {
  const { user, refresh } = useSession();
  const [items, setItems] = useState<Item[] | null>(null);
  const load = useCallback(async () => { if (!user) return; try { setItems((await api<{ items: Item[] }>("/me/messages")).items); } catch { setItems([]); } }, [user]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  if (!user) return <Empty icon="chat" text="Satıcılarla ve alıcılarla yazışmalarınız burada görünür. Mesajlarınızı görmek için giriş yapın." action="Giriş yap" onAction={() => router.push("/giris")} />;
  if (!items) return <Skeleton rows={4} />;
  return (
    <FlatList data={items} keyExtractor={(x) => `${x.request_id}-${x.other_name}-${x.role}`} contentContainerStyle={{ padding: 12, gap: 8 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={async () => { await load(); await refresh(); }} />}
      ListEmptyComponent={<Empty icon="chat" text="Henüz mesajınız yok. Satıcılar talebinize yazınca ya da siz bir alıcıya yazınca burada görünür." action="Talepleri incele" onAction={() => router.push("/talepler")} />}
      renderItem={({ item }) => (
        <Press accessibilityRole="link" accessibilityLabel={`${item.title}, ${item.other_name}`} onPress={() => router.push(`/mesaj/${item.request_id}`)} scale={0.985}
          style={[{ flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: item.unread ? "#F9C9AC" : C.line, padding: 12 }, SH.sm]}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: item.role === "alici" ? C.navySoft : "#FFF0E6", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontWeight: "900", fontSize: 17, color: item.role === "alici" ? C.navy : C.orange }}>{(item.other_name || "?").trim().charAt(0).toLocaleUpperCase("tr")}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Text style={{ fontWeight: "800", color: C.text, flex: 1 }} numberOfLines={1}>{item.other_name} <Text style={{ color: C.muted, fontWeight: "600", fontSize: 12 }}>· {item.role === "alici" ? "Satıcı" : "Alıcı"}</Text></Text>
              <Text style={{ color: item.unread ? C.orange : C.muted, fontSize: 12, fontWeight: item.unread ? "800" : "400" }}>{ago(item.last_at)}</Text>
            </View>
            <Text numberOfLines={1} style={{ color: C.blue, fontSize: 12, fontWeight: "600" }}>{item.title}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text numberOfLines={1} style={{ flex: 1, color: item.unread ? C.text : C.muted, fontWeight: item.unread ? "700" : "400" }}>{item.last_body}</Text>
              {item.unread ? <Text style={{ minWidth: 22, textAlign: "center", backgroundColor: C.orange, color: "#fff", fontWeight: "800", fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 11, overflow: "hidden" }}>{item.unread}</Text> : null}
            </View>
          </View>
        </Press>)} />
  );
}
