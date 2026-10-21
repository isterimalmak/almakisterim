import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Empty, Loading, ReqCard, s } from "@/components/ui";
import { api } from "@/lib/api";
import { addRecentSearch, clearRecentSearches, recentSearches } from "@/lib/store";
import { fmt } from "@/lib/format";
import { useCats } from "@/lib/useCats";
import { C, R } from "@/lib/theme";
import type { Page, Req } from "@/lib/types";

const SORTS: [string, string][] = [["new", "En yeni"], ["budget_desc", "Fiyat (yüksek)"], ["budget_asc", "Fiyat (düşük)"], ["ending", "Süresi bitecek"]];

export default function Talepler() {
  const p = useLocalSearchParams<{ top?: string; sub?: string; q?: string; urgent?: string }>();
  const cats = useCats();
  const [top, setTop] = useState(p.top ?? "");
  const [sub, setSub] = useState(p.sub ?? "");
  const [q, setQ] = useState(p.q ?? "");
  const [sort, setSort] = useState("new");
  const [items, setItems] = useState<Req[] | null>(null);
  const [total, setTotal] = useState(0);
  const page = useRef(1);
  const busy = useRef(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [focus, setFocus] = useState(false);
  // Kutudan çıkınca son aramalar biraz sonra kapanır (dokunulan aramanın seçilebilmesi için); yeniden odaklanınca bekleyen kapanma iptal edilir.
  const blurT = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { void recentSearches().then(setRecent); }, []);
  const search = (text: string) => { setQ(text); setFocus(false); void addRecentSearch(text).then(() => recentSearches().then(setRecent)); };
  useEffect(() => { setTop(p.top ?? ""); setSub(p.sub ?? ""); setQ(p.q ?? ""); }, [p.top, p.sub, p.q]);

  const query = useCallback((pg: number) => {
    const u = new URLSearchParams({ sort, page: String(pg), per: "20" });
    if (top) u.set("top", top); if (sub) u.set("sub", sub); if (q.trim()) u.set("q", q.trim()); if (p.urgent) u.set("urgent", "1");
    return `/requests?${u}`;
  }, [top, sub, q, sort, p.urgent]);
  const load = useCallback(async (reset: boolean) => {
    if (busy.current) return; busy.current = true;
    try {
      const pg = reset ? 1 : page.current + 1;
      const d = await api<Page<Req>>(query(pg));
      page.current = pg; setTotal(d.total);
      setItems((x) => (reset || !x ? d.items : [...x, ...d.items]));
    } catch { if (reset) setItems([]); } finally { busy.current = false; }
  }, [query]);
  useEffect(() => { setItems(null); void load(true); }, [load]);

  const topCat = cats?.find((c) => c.id === top);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: C.card, padding: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <TextInput accessibilityLabel="Talep ara" placeholder="Ara" value={q} onChangeText={setQ} returnKeyType="search" onFocus={() => { if (blurT.current) clearTimeout(blurT.current); setFocus(true); }} onBlur={() => { blurT.current = setTimeout(() => setFocus(false), 200); }}
          onSubmitEditing={() => search(q)} style={[s.inp, { paddingVertical: 9 }]} />
        {focus && !q.trim() && recent.length ? (
          <View accessibilityLabel="Son aramalar" style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: "700" }}>Son aramalar</Text>
              <Text accessibilityRole="button" style={{ color: C.muted, fontSize: 12 }} onPress={() => { void clearRecentSearches(); setRecent([]); }}>Temizle</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{recent.map((r) => <Chip key={r} small on={false} text={r} onPress={() => search(r)} />)}</View>
          </View>) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {[{ id: "", name: "Tümü" }, ...(cats ?? [])].map((c) => <Chip key={c.id || "all"} on={top === c.id} text={c.name} onPress={() => { setTop(c.id); setSub(""); }} />)}
        </ScrollView>
        {topCat?.subs?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {[{ id: "", name: `Tüm ${topCat.name}` }, ...topCat.subs].map((c) => <Chip key={c.id || "all"} small on={sub === c.id} text={c.name} onPress={() => setSub(c.id)} />)}
          </ScrollView>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {SORTS.map(([k, l]) => <Chip key={k} small on={sort === k} text={l} onPress={() => setSort(k)} />)}
        </ScrollView>
      </View>
      {!items ? <Loading /> : (
        <FlatList data={items} keyExtractor={(r) => String(r.id)} contentContainerStyle={{ padding: 12, gap: 8 }}
          ListHeaderComponent={<Text style={{ color: C.muted, marginBottom: 4 }}>{fmt(total)} talep</Text>}
          ListEmptyComponent={<View style={{ alignItems: "center", gap: 10 }}><Empty text="Bu aramaya uyan açık talep yok." /><Text accessibilityRole="link" style={{ color: C.orange, fontWeight: "700" }} onPress={() => router.push("/talep-ver")}>Siz talep verin ›</Text></View>}
          onEndReachedThreshold={0.4} onEndReached={() => { if (items.length < total) void load(false); }}
          renderItem={({ item }) => <ReqCard r={item} />} />
      )}
    </View>
  );
}

function Chip({ on, text, onPress, small }: { on: boolean; text: string; onPress: () => void; small?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
      style={{ paddingHorizontal: small ? 10 : 14, paddingVertical: small ? 6 : 8, borderRadius: R.pill, backgroundColor: on ? C.navy : C.bg, borderWidth: 1, borderColor: on ? C.navy : C.line }}>
      <Text style={{ fontSize: small ? 12 : 13, fontWeight: "700", color: on ? "#fff" : C.navy }}>{text}</Text>
    </Pressable>
  );
}
