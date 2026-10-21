import { router, useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { FlatList, Pressable, Text } from "react-native";
import { api } from "@/lib/api";
import { dateTr, price } from "@/lib/format";
import { C, R } from "@/lib/theme";
import { Empty, Loading } from "./ui";

type Row = { id: number; title: string; status?: string; budget_max: number; city: string; created_at: string; category_name?: string };

/** Hesabım altındaki talep listeleri (favoriler, size uygun talepler). */
export function RowList({ path, empty }: { path: string; empty: ReactNode }) {
  const [items, setItems] = useState<Row[] | null>(null);
  useFocusEffect(useCallback(() => { api<{ items: Row[] }>(path).then((d) => setItems(d.items)).catch(() => setItems([])); }, [path]));
  if (!items) return <Loading />;
  return (
    <FlatList data={items} keyExtractor={(x) => String(x.id)} contentContainerStyle={{ padding: 12, gap: 8 }}
      ListEmptyComponent={typeof empty === "string" ? <Empty text={empty} /> : <>{empty}</>}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="link" accessibilityLabel={item.title} onPress={() => router.push(`/talep/${item.id}`)} style={{ backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.line, padding: 12, gap: 4 }}>
          <Text style={{ fontWeight: "800", color: C.navy }} numberOfLines={2}>{item.title}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{[item.category_name, item.city, dateTr(item.created_at)].filter(Boolean).join(" · ")}</Text>
          <Text style={{ color: C.orange, fontWeight: "800" }}>{price(item.budget_max)}</Text>
          {item.status && item.status !== "active" ? <Text style={{ color: C.muted, fontSize: 12, fontWeight: "700" }}>Yayında değil</Text> : null}
        </Pressable>)} />
  );
}
