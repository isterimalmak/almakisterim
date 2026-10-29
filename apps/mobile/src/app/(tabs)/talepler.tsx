import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Chip, Empty, ReqCard, Skeleton } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { theme } from "@/lib/home";
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
      <View style={{ backgroundColor: C.card, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F1F2F5", borderRadius: R.pill, paddingHorizontal: 14 }}>
        <Icon name="search" size={18} color={C.orange} sw={2.2} />
        <TextInput accessibilityLabel="Talep ara" placeholder="Talep ara: iPhone, 3+1 daire…" placeholderTextColor="#8A919C" value={q} onChangeText={(t) => { setQ(t); if (!t) setFocus(true); }} returnKeyType="search" onFocus={() => { if (blurT.current) clearTimeout(blurT.current); setFocus(true); }} onBlur={() => { blurT.current = setTimeout(() => setFocus(false), 200); }}
          onSubmitEditing={() => search(q)} style={{ flex: 1, fontSize: 15, paddingVertical: 11, color: C.text }} />
        {q ? <Text accessibilityRole="button" accessibilityLabel="Aramayı temizle" onPress={() => setQ("")} style={{ color: C.muted, fontSize: 18, paddingHorizontal: 4 }}>×</Text> : null}
        </View>
        {focus && !q.trim() && recent.length ? (
          <View accessibilityLabel="Son aramalar" style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: "700" }}>Son aramalar</Text>
              <Text accessibilityRole="button" style={{ color: C.muted, fontSize: 12 }} onPress={() => { void clearRecentSearches(); setRecent([]); }}>Temizle</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{recent.map((r) => <Chip key={r} small on={false} text={r} onPress={() => search(r)} />)}</View>
          </View>) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {[{ id: "", name: "Tümü", icon: "list" }, ...(cats ?? [])].map((c) => <Chip key={c.id || "all"} on={top === c.id} text={c.name} icon={c.icon} color={c.id ? theme(c.id).fc : C.navy} onPress={() => { setTop(c.id); setSub(""); }} />)}
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
      {!items ? <Skeleton /> : (
        <FlatList data={items} keyExtractor={(r) => String(r.id)} contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 30 }}
          ListHeaderComponent={<Text style={{ color: C.muted, marginBottom: 2, fontSize: 13 }}><Text style={{ color: C.text, fontWeight: "800" }}>{fmt(total)} talep</Text>{topCat ? ` · ${topCat.name}` : ""}</Text>}
          ListEmptyComponent={<Empty text="Bu aramaya uyan açık talep yok. Aradığınızı siz yazın, satıcılar size ulaşsın." action="Ücretsiz talep ver" onAction={() => router.push("/talep-ver")} />}
          onEndReachedThreshold={0.4} onEndReached={() => { if (items.length < total) void load(false); }}
          renderItem={({ item }) => <ReqCard r={item} />} />
      )}
    </View>
  );
}

