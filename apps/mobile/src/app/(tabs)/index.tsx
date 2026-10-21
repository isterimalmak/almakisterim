import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Intro } from "@/components/Intro";
import { ReqCard, s } from "@/components/ui";
import { api } from "@/lib/api";
import { useCats } from "@/lib/useCats";
import { C, R } from "@/lib/theme";
import type { Page, Req } from "@/lib/types";

// Sitenin ana sayfasındaki bölümler: kategoriler, Vasıta / Emlak Talepleri, acil talepler, son eklenenler.
const ROWS: { key: string; title: string; q: string; all: string }[] = [
  { key: "vasita", title: "Vasıta Talepleri", q: "top=vasita&sort=vitrin&per=12", all: "vasita" },
  { key: "emlak", title: "Emlak Talepleri", q: "top=emlak&sort=vitrin&per=12", all: "emlak" },
  { key: "acil", title: "Acil Talepler", q: "urgent=1&per=12", all: "" },
];

export default function Home() {
  const cats = useCats();
  const [rows, setRows] = useState<Record<string, Req[]>>({});
  const [latest, setLatest] = useState<Req[] | null>(null);
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const out: Record<string, Req[]> = {};
    await Promise.all([
      ...ROWS.map(async (r) => { out[r.key] = (await api<Page<Req>>(`/requests?${r.q}`).catch(() => ({ items: [] as Req[] }))).items; }),
      api<Page<Req>>("/requests?per=20").then((d) => setLatest(d.items)).catch(() => setLatest([])),
    ]);
    setRows(out);
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <>
    <Intro />
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />} contentContainerStyle={{ paddingBottom: 30 }}>
      <View style={{ backgroundColor: C.navy, padding: 16, paddingTop: 6, gap: 10 }}>
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>Neyi arıyorsunuz?</Text>
        <Text style={{ color: "#C9D0E4" }}>Almak istediğinizi yazın, satıcılar size ulaşsın.</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput accessibilityLabel="Talep ara" placeholder="Talep ara: iPhone, 3+1 daire…" placeholderTextColor="#9AA1AB" value={q} onChangeText={setQ}
            returnKeyType="search" onSubmitEditing={() => router.push({ pathname: "/talepler", params: { q } })} style={[s.inp, { flex: 1 }]} />
          <Pressable accessibilityRole="button" accessibilityLabel="Ara" onPress={() => router.push({ pathname: "/talepler", params: { q } })} style={{ backgroundColor: C.orange, borderRadius: R.md, width: 50, alignItems: "center", justifyContent: "center" }}>
            <Icon name="search" size={22} color="#fff" sw={2.2} />
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push("/talep-ver")} style={{ backgroundColor: C.orange, borderRadius: R.pill, padding: 14, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Ücretsiz Talep Ver</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", padding: 10, gap: 8 }}>
        {(cats ?? []).map((c) => (
          <Pressable key={c.id} accessibilityRole="link" accessibilityLabel={c.name} onPress={() => router.push({ pathname: "/talepler", params: { top: c.id } })}
            style={{ width: "22.8%", backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.line, paddingVertical: 10, alignItems: "center", gap: 4 }}>
            <Icon name={c.icon} size={24} color={C.navy} />
            <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "700", color: C.navy }}>{c.name}</Text>
          </Pressable>
        ))}
      </View>

      {ROWS.map((r) => rows[r.key]?.length ? (
        <View key={r.key} accessibilityLabel={r.title} style={{ marginTop: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, marginBottom: 8 }}>
            <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: "800", color: C.navy }}>{r.title}</Text>
            <Text accessibilityRole="link" onPress={() => router.push({ pathname: "/talepler", params: r.all ? { top: r.all } : { urgent: "1" } })} style={{ color: C.orange, fontWeight: "700" }}>Tümünü gör ›</Text>
          </View>
          <FlatList horizontal data={rows[r.key]} keyExtractor={(x) => String(x.id)} contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }} showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => <ReqCard r={item} compact />} />
        </View>
      ) : null)}

      <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: "800", color: C.navy, paddingHorizontal: 14, marginTop: 16, marginBottom: 8 }}>Son Eklenen Talepler</Text>
      <View style={{ paddingHorizontal: 14, gap: 8 }}>{(latest ?? []).map((r) => <ReqCard key={r.id} r={r} />)}</View>
    </ScrollView>
    </>
  );
}
