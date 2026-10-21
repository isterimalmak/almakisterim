import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { Btn, Empty, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import { useSession } from "@/lib/session";
import { C, R } from "@/lib/theme";

type Item = { request_id: number; title: string; role: "alici" | "satici"; other_name: string; last_body: string; last_at: string; unread: number };

export default function Mesajlar() {
  const { user, refresh } = useSession();
  const [items, setItems] = useState<Item[] | null>(null);
  const load = useCallback(async () => { if (!user) return; try { setItems((await api<{ items: Item[] }>("/me/messages")).items); } catch { setItems([]); } }, [user]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  if (!user) return <View style={{ padding: 20, gap: 12 }}><Text style={{ color: C.muted }}>Mesajlarınızı görmek için giriş yapın.</Text><Btn title="Giriş yap" onPress={() => router.push("/giris")} /></View>;
  if (!items) return <Loading />;
  return (
    <FlatList data={items} keyExtractor={(x) => `${x.request_id}-${x.other_name}-${x.role}`} contentContainerStyle={{ padding: 12, gap: 8 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={async () => { await load(); await refresh(); }} />}
      ListEmptyComponent={<Empty text="Henüz mesajınız yok. Satıcılar talebinize yazınca ya da siz bir alıcıya yazınca burada görünür." />}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="link" accessibilityLabel={`${item.title}, ${item.other_name}`} onPress={() => router.push(`/mesaj/${item.request_id}`)}
          style={{ backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: item.unread ? C.orange : C.line, padding: 12, gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontWeight: "800", color: C.navy, flex: 1 }} numberOfLines={1}>{item.other_name} · {item.role === "alici" ? "Satıcı" : "Alıcı"}</Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>{ago(item.last_at)}</Text>
          </View>
          <Text numberOfLines={1} style={{ color: C.muted, fontSize: 12 }}>{item.title}</Text>
          <Text numberOfLines={2} style={{ color: C.text }}>{item.last_body}</Text>
          {item.unread ? <Text style={{ alignSelf: "flex-start", backgroundColor: C.orange, color: "#fff", fontWeight: "800", fontSize: 11, paddingHorizontal: 8, borderRadius: 10 }}>{item.unread} yeni</Text> : null}
        </Pressable>)} />
  );
}
