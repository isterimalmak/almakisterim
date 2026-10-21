import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Linking, Pressable, Text, View } from "react-native";
import { Empty, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTr } from "@/lib/format";
import { C, R } from "@/lib/theme";

type Item = { id: number; request_id: number; title: string; phone: string | null; phone_note: string | null; created_at: string };
const tr = (p: string) => p.replace(/^90(\d{3})(\d{3})(\d{2})(\d{2})$/, "0$1 $2 $3 $4");

export default function Numaralar() {
  const [items, setItems] = useState<Item[] | null>(null);
  useFocusEffect(useCallback(() => { api<{ items: Item[] }>("/me/unlocks").then((d) => setItems(d.items)).catch(() => setItems([])); }, []));
  if (!items) return <Loading />;
  return (
    <FlatList data={items} keyExtractor={(x) => String(x.id)} contentContainerStyle={{ padding: 12, gap: 8 }}
      ListEmptyComponent={<Empty text="Henüz numarasını açtığınız bir talep yok." />}
      renderItem={({ item }) => (
        <View style={{ backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.line, padding: 12, gap: 6 }}>
          <Pressable accessibilityRole="link" onPress={() => router.push(`/talep/${item.request_id}`)}><Text style={{ fontWeight: "800", color: C.navy }} numberOfLines={2}>{item.title}</Text></Pressable>
          <Text style={{ color: C.muted, fontSize: 12 }}>{dateTr(item.created_at)}</Text>
          {item.phone ? <Text accessibilityRole="link" onPress={() => void Linking.openURL(`tel:+${item.phone}`)} style={{ color: C.orange, fontWeight: "800", fontSize: 16 }}>📞 {tr(item.phone)}</Text>
            : <Text style={{ color: C.muted }}>{item.phone_note}</Text>}
          <Pressable accessibilityRole="button" onPress={() => router.push(`/mesaj/${item.request_id}`)}><Text style={{ color: C.navy, fontWeight: "700" }}>Mesaj yaz ›</Text></Pressable>
        </View>)} />
  );
}
