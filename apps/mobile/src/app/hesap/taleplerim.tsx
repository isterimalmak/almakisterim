import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, Text } from "react-native";
import { Btn, Empty, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTr, price } from "@/lib/format";
import { C, R } from "@/lib/theme";

type Item = { id: number; title: string; status: string; budget_max: number; city: string; created_at: string; category_name: string; offer_count: number };
const ST: Record<string, [string, string]> = { active: ["Yayında", C.green], pending_review: ["İnceleniyor", "#B26A00"], closed: ["Kapandı", C.muted], expired: ["Süresi doldu", C.muted], rejected: ["Yayınlanmadı", C.red] };

export default function Taleplerim() {
  const [items, setItems] = useState<Item[] | null>(null);
  useFocusEffect(useCallback(() => { api<{ items: Item[] }>("/me/requests").then((d) => setItems(d.items)).catch(() => setItems([])); }, []));
  if (!items) return <Loading />;
  return (
    <FlatList data={items} keyExtractor={(x) => String(x.id)} contentContainerStyle={{ padding: 12, gap: 8 }}
      ListEmptyComponent={<><Empty text="Henüz talebiniz yok." /><Btn title="Ücretsiz talep ver" onPress={() => router.push("/talep-ver")} /></>}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="link" accessibilityLabel={item.title} onPress={() => router.push(`/talep/${item.id}`)} style={{ backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.line, padding: 12, gap: 4 }}>
          <Text style={{ fontWeight: "800", color: C.navy }} numberOfLines={2}>{item.title}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>#{item.id} · {item.category_name} · {item.city} · {dateTr(item.created_at)}</Text>
          <Text style={{ color: C.orange, fontWeight: "800" }}>{price(item.budget_max)}</Text>
          <Text style={{ color: (ST[item.status] ?? ["", C.muted])[1], fontWeight: "700", fontSize: 12 }}>{(ST[item.status] ?? [item.status])[0]} · {item.offer_count} teklif</Text>
        </Pressable>)} />
  );
}
