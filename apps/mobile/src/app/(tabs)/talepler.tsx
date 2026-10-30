import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Modal, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";
import { Picker } from "@/components/Picker";
import { Btn, Chip, Empty, Field, ReqCard, Skeleton } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { theme } from "@/lib/home";
import { api } from "@/lib/api";
import { CITIES } from "@/lib/catalog";
import { useSession } from "@/lib/session";
import { addRecentSearch, clearRecentSearches, recentSearches } from "@/lib/store";
import { fmt } from "@/lib/format";
import { useCats } from "@/lib/useCats";
import { C, R } from "@/lib/theme";
import type { Page, Req } from "@/lib/types";

// Süzgeçler: sitedeki listeleme sayfasının telefonda kullanılan kısmı (il, bütçe, acil, alıcı tipi).
type Flt = { city: string; bmin: string; bmax: string; urgent: boolean; buyer: "" | "bireysel" | "kurumsal" };
const NO_FLT: Flt = { city: "", bmin: "", bmax: "", urgent: false, buyer: "" };
const digits = (t: string) => t.replace(/\D/g, "").slice(0, 10);

const SORTS: [string, string][] = [["new", "En yeni"], ["budget_desc", "Fiyat (yüksek)"], ["budget_asc", "Fiyat (düşük)"], ["ending", "Süresi bitecek"]];

export default function Talepler() {
  const p = useLocalSearchParams<{ top?: string; sub?: string; q?: string; urgent?: string; city?: string }>();
  const cats = useCats();
  const { user } = useSession();
  const [f, setF] = useState<Flt>({ ...NO_FLT, urgent: !!p.urgent, city: p.city ?? "" });
  const [draft, setDraft] = useState<Flt>(NO_FLT);
  const [openF, setOpenF] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
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
  useEffect(() => { setF((x) => ({ ...x, urgent: !!p.urgent, ...(p.city !== undefined ? { city: p.city } : {}) })); }, [p.urgent, p.city]);

  const query = useCallback((pg: number) => {
    const u = new URLSearchParams({ sort, page: String(pg), per: "20" });
    if (top) u.set("top", top); if (sub) u.set("sub", sub); if (q.trim()) u.set("q", q.trim());
    if (f.city) u.set("city", f.city); if (f.bmin) u.set("bmin", f.bmin); if (f.bmax) u.set("bmax", f.bmax);
    if (f.urgent) u.set("urgent", "1"); if (f.buyer) u.set("buyer", f.buyer);
    return `/requests?${u}`;
  }, [top, sub, q, sort, f]);
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
  const subCat = topCat?.subs?.find((c) => c.id === sub);
  // Seçili süzgeçler listenin üstünde tek tek kaldırılabilen etiketler olarak görünür.
  const chips: { k: string; l: string; clear: () => void }[] = [];
  if (f.city) chips.push({ k: "city", l: f.city, clear: () => setF({ ...f, city: "" }) });
  if (f.bmin || f.bmax) chips.push({ k: "b", l: `${f.bmin ? fmt(Number(f.bmin)) : "0"} – ${f.bmax ? fmt(Number(f.bmax)) : "∞"} TL`, clear: () => setF({ ...f, bmin: "", bmax: "" }) });
  if (f.urgent) chips.push({ k: "u", l: "Acil", clear: () => setF({ ...f, urgent: false }) });
  if (f.buyer) chips.push({ k: "buyer", l: f.buyer === "kurumsal" ? "Kurumsal alıcılar" : "Bireysel alıcılar", clear: () => setF({ ...f, buyer: "" }) });
  // Aramayı kaydet: seçili kategori ve süzgeçlerle alarm kurulur; uyan yeni talep gelince haber verilir (sitedekiyle aynı).
  const saveSearch = async () => {
    if (!user) return router.push("/giris");
    if (!top) return setMsg({ ok: false, text: "Aramayı kaydetmek için önce bir kategori seçin." });
    const filters: Record<string, string> = {};
    if (q.trim()) filters.q = q.trim(); if (f.bmin) filters.bmin = f.bmin; if (f.bmax) filters.bmax = f.bmax;
    if (f.urgent) filters.urgent = "1"; if (f.buyer) filters.buyer = f.buyer;
    try {
      await api("/me/alarms", { body: { category_id: sub || top, ...(f.city ? { city: f.city } : {}), filters } });
      setMsg({ ok: true, text: `Arama kaydedildi: ${subCat?.name ?? topCat?.name ?? ""}${f.city ? `, ${f.city}` : ""}. Uygun yeni talep gelince size haber vereceğiz.` });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };
  const bminN = Number(draft.bmin), bmaxN = Number(draft.bmax);
  const badRange = !!draft.bmin && !!draft.bmax && bminN > bmaxN;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: C.card, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F1F2F5", borderRadius: R.pill, paddingHorizontal: 14 }}>
        <Icon name="search" size={18} color={C.orange} sw={2.2} />
        <TextInput accessibilityLabel="Talep ara" placeholder="Talep ara: iPhone, 3+1 daire…" placeholderTextColor="#8A919C" value={q} onChangeText={(t) => { setQ(t); if (!t) setFocus(true); }} returnKeyType="search" onFocus={() => { if (blurT.current) clearTimeout(blurT.current); setFocus(true); }} onBlur={() => { blurT.current = setTimeout(() => setFocus(false), 200); }}
          onSubmitEditing={() => search(q)} style={{ flex: 1, fontSize: 15, paddingVertical: 11, color: C.text }} />
        {q ? <Text accessibilityRole="button" accessibilityLabel="Aramayı temizle" onPress={() => setQ("")} style={{ color: C.muted, fontSize: 18, paddingHorizontal: 4 }}>×</Text> : null}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={chips.length ? `Filtrele, ${chips.length} süzgeç seçili` : "Filtrele"} onPress={() => { setDraft(f); setOpenF(true); }}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
            <Icon name="list" size={16} color={C.navy} /><Text style={{ color: C.navy, fontWeight: "800" }}>Filtrele</Text>
            {chips.length ? <Text style={{ backgroundColor: C.orange, color: "#fff", fontSize: 11, fontWeight: "800", minWidth: 18, textAlign: "center", borderRadius: 9, overflow: "hidden", paddingHorizontal: 5 }}>{chips.length}</Text> : null}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Aramayı kaydet" onPress={() => void saveSearch()}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.card }}>
            <Icon name="bell" size={16} color={C.orange} /><Text style={{ color: C.navy, fontWeight: "800" }}>Aramayı kaydet</Text>
          </Pressable>
        </View>
        {msg ? <Text accessibilityRole="alert" onPress={() => setMsg(null)} style={{ color: msg.ok ? C.green : C.red, fontWeight: "700", fontSize: 13 }}>{msg.text}</Text> : null}
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
        {chips.length ? (
          <View accessibilityLabel="Seçili süzgeçler" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {chips.map((c) => (
              <Pressable key={c.k} accessibilityRole="button" accessibilityLabel={`${c.l} süzgecini kaldır`} onPress={c.clear}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, backgroundColor: C.soft }}>
                <Text style={{ color: C.navy, fontSize: 12, fontWeight: "700" }}>{c.l}</Text><Text style={{ color: C.orange, fontWeight: "900" }}>×</Text>
              </Pressable>))}
            <Text accessibilityRole="button" onPress={() => setF(NO_FLT)} style={{ color: C.muted, fontSize: 12, alignSelf: "center", textDecorationLine: "underline" }}>Tümünü temizle</Text>
          </View>) : null}
      </View>
      <Modal visible={openF} animationType="slide" onRequestClose={() => setOpenF(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "900", color: C.navy }}>Filtrele</Text>
            <Text accessibilityRole="button" onPress={() => setOpenF(false)} style={{ color: C.navy, fontWeight: "700" }}>Kapat</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
            <Picker label="İl" value={draft.city} placeholder="Tüm Türkiye" options={[{ value: "", label: "Tüm Türkiye" }, ...CITIES.map((c) => ({ value: c, label: c }))]} onChange={(c) => setDraft({ ...draft, city: c })} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="En az bütçe (TL)" keyboardType="number-pad" placeholder="0" value={draft.bmin} onChangeText={(t) => setDraft({ ...draft, bmin: digits(t) })} /></View>
              <View style={{ flex: 1 }}><Field label="En çok bütçe (TL)" keyboardType="number-pad" placeholder="Sınırsız" value={draft.bmax} onChangeText={(t) => setDraft({ ...draft, bmax: digits(t) })} /></View>
            </View>
            {badRange ? <Text accessibilityRole="alert" style={{ color: C.red, fontSize: 13 }}>En az bütçe, en çok bütçeden büyük olamaz.</Text> : null}
            <View style={{ gap: 8 }}>
              <Text style={{ fontWeight: "700", color: C.navy }}>Alıcı</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {([["", "Tümü"], ["bireysel", "Bireysel"], ["kurumsal", "Kurumsal"]] as const).map(([v, l]) => <Chip key={v || "all"} on={draft.buyer === v} text={l} onPress={() => setDraft({ ...draft, buyer: v })} />)}
              </View>
            </View>
            <Chip on={draft.urgent} text="Yalnızca acil talepler" icon="bolt" color={C.red} onPress={() => setDraft({ ...draft, urgent: !draft.urgent })} />
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 10, padding: 16, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line }}>
            <Btn style={{ flex: 1 }} kind="wh" title="Temizle" onPress={() => setDraft(NO_FLT)} />
            <Btn style={{ flex: 2 }} title="Sonuçları göster" disabled={badRange} onPress={() => { setF(draft); setOpenF(false); }} />
          </View>
        </SafeAreaView>
      </Modal>
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

