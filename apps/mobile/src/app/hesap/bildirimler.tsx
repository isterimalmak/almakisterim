import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, Text } from "react-native";
import { Empty, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import { openLink } from "@/lib/links";
import { useSession } from "@/lib/session";
import { C, R } from "@/lib/theme";

type Item = { id: number; text: string; link: string; read_at: string | null; created_at: string };

export default function Bildirimler() {
  const { refresh } = useSession();
  const [items, setItems] = useState<Item[] | null>(null);
  useFocusEffect(useCallback(() => {
    api<{ items: Item[] }>("/me/notifications").then(async (d) => { setItems(d.items); await api("/me/notifications/read", { method: "POST", body: {} }).catch(() => {}); await refresh(); }).catch(() => setItems([]));
  }, [refresh]));
  if (!items) return <Loading />;
  return (
    <FlatList data={items} keyExtractor={(x) => String(x.id)} contentContainerStyle={{ padding: 12, gap: 8 }} ListEmptyComponent={<Empty text="Bildiriminiz yok." />}
      renderItem={({ item }) => (
        <Pressable accessibilityRole={item.link ? "link" : "text"} disabled={!item.link} onPress={() => openLink(item.link)}
          style={{ backgroundColor: item.read_at ? C.card : C.soft, borderRadius: R.md, borderWidth: 1, borderColor: C.line, padding: 12, gap: 4 }}>
          <Text style={{ color: C.text }}>{item.text}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{ago(item.created_at)}</Text>
        </Pressable>)} />
  );
}
