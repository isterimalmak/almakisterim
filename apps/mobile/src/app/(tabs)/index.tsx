import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AdGrid, CatTiles, CustomBlock, Hero, InfoBox, SecHead, Welcome } from "@/components/HomeSections";
import { Icon } from "@/components/Icon";
import { Intro } from "@/components/Intro";
import { Btn, ReqCard } from "@/components/ui";
import { api } from "@/lib/api";
import { blockText, useHome, type BuiltinId, type HomeBlock } from "@/lib/home";
import { useSession } from "@/lib/session";
import { C, R } from "@/lib/theme";
import type { Page, Req } from "@/lib/types";

// Ana sayfa: sitenin telefon görünümüyle aynı. Bölümlerin sırası, gizlenenler ve yazılar Yönetim → Ana Sayfa Düzeni'nden gelir;
// reklamlar Yönetim → Reklam Alanları'ndan.
const EXAMPLES = ["2018 model dizel Passat", "Kadıköy'de 3+1 kiralık daire", "Az kilometreli otomatik Clio", "Urla'da 500 m² imarlı arsa"];
type Lists = { urgent: Page<Req> | null; vitrin: Page<Req> | null; latest: Page<Req> | null; corp: Page<Req> | null };
const EMPTY: Page<Req> = { items: [], total: 0, page: 1, per: 0 };

function TopBar() {
  const { user } = useSession();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const search = () => router.push({ pathname: "/talepler", params: q.trim() ? { q: q.trim() } : {} });
  const unread = user?.unread_notifications ?? 0;
  return (
    <View style={{ backgroundColor: C.card, paddingTop: insets.top + 8, paddingBottom: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <Image source={require("../../../assets/icon.png")} style={{ width: 40, height: 40, borderRadius: 10 }} accessibilityLabel="almakisterim" />
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#F1F2F5", borderRadius: R.pill, paddingHorizontal: 12, gap: 8 }}>
        <Icon name="search" size={18} color={C.orange} sw={2.2} />
        <TextInput accessibilityLabel="Talep ara" value={q} onChangeText={setQ} placeholder="Ne arıyorsunuz?" placeholderTextColor="#8A919C" returnKeyType="search"
          onSubmitEditing={search} style={{ flex: 1, fontSize: 15, paddingVertical: 10, color: C.text }} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={unread ? `${unread} okunmamış bildirim` : "Bildirimler"} hitSlop={8}
        onPress={() => router.push(user ? "/hesap/bildirimler" : "/giris")} style={{ padding: 4 }}>
        <Icon name="bell" size={24} color={C.text} />
        {unread > 0 && <Text style={{ position: "absolute", top: -2, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.orange, color: "#fff", fontSize: 11, fontWeight: "800", textAlign: "center", lineHeight: 18, paddingHorizontal: 4, overflow: "hidden" }}>{unread > 99 ? "99+" : unread}</Text>}
      </Pressable>
    </View>
  );
}

export default function Home() {
  const { site, blocks, browse, count, ads, forPhone, load: loadSite } = useHome();
  const [lists, setLists] = useState<Lists>({ urgent: null, vitrin: null, latest: null, corp: null });
  const [refreshing, setRefreshing] = useState(false);
  const loadLists = useCallback(async () => {
    const get = (q: string) => api<Page<Req>>(`/requests?${q}`).catch(() => EMPTY);
    const [urgent, vitrin, latest, corp] = await Promise.all([get("urgent=1&per=8"), get("sort=vitrin&per=20"), get("per=10"), get("buyer=kurumsal&per=5")]);
    setLists({ urgent, vitrin, latest, corp });
  }, []);
  useEffect(() => { void loadLists(); }, [loadLists]);
  const T = (id: BuiltinId) => (k: string) => blockText(blocks, id, k);
  const cats = browse.length ? browse : site?.categories ?? [];

  const builtin = (id: BuiltinId) => {
    const t = T(id);
    switch (id) {
      case "hero": return <Hero T={t} examples={EXAMPLES} />;
      case "cats": return <CatTiles cats={cats} browse={!!browse.length} count={count} urgentTotal={lists.urgent?.total ?? 0} />;
      case "ads_m": return <AdGrid ads={forPhone(ads?.items)} />;
      case "center_ads": return <AdGrid ads={forPhone(ads?.center)} />;
      case "urgent": return site?.home_urgent_box && lists.urgent?.items.length ? (
        <View accessibilityLabel={t("title")} style={{ marginBottom: 16 }}>
          <SecHead title={t("title")} link={t("link")} onLink={() => router.push({ pathname: "/talepler", params: { urgent: "1" } })} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}>{lists.urgent.items.map((r) => <ReqCard key={r.id} r={r} compact />)}</ScrollView>
        </View>) : null;
      case "vitrin": return lists.vitrin?.items.length ? (
        <View accessibilityLabel={t("title")} style={{ marginBottom: 16 }}>
          <SecHead title={t("title")} link={t("link")} onLink={() => router.push("/talepler")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}>{lists.vitrin.items.map((r) => <ReqCard key={r.id} r={r} compact />)}</ScrollView>
        </View>) : null;
      case "latest": return (
        <View accessibilityLabel={t("title")} style={{ marginBottom: 16 }}>
          <SecHead title={t("title")} link={t("link")} onLink={() => router.push("/talepler")} />
          <View style={{ paddingHorizontal: 14, gap: 8 }}>
            {lists.latest?.items.length ? lists.latest.items.map((r) => <ReqCard key={r.id} r={r} />)
              : lists.latest ? <InfoBox title="İlk talepler geliyor"><Text style={{ color: C.muted }}>Almak istediğinizi yazın; ilk talep sahipleri satıcıların en çok ilgisini çeker.</Text><Btn title="Ücretsiz talep ver" onPress={() => router.push("/talep-ver")} /></InfoBox> : null}
          </View>
        </View>);
      case "corp": return lists.corp?.items.length ? (
        <View accessibilityLabel={t("title")} style={{ marginBottom: 16 }}>
          <SecHead title={t("title")} link={t("link")} onLink={() => router.push("/talepler")} />
          <View style={{ paddingHorizontal: 14, gap: 8 }}>{lists.corp.items.map((r) => <ReqCard key={r.id} r={r} />)}</View>
        </View>) : null;
      case "launch": return site?.launch_mode ? (
        <View style={{ marginHorizontal: 12, marginBottom: 14, padding: 16, borderRadius: R.md, backgroundColor: "#FFF3EC", borderLeftWidth: 4, borderLeftColor: C.orange, gap: 8 }}>
          <Text style={{ fontSize: 17, fontWeight: "800", color: C.text }}>{t("title")}</Text>
          <Text style={{ color: "#3A4250" }}>{t("text")}</Text>
          <Btn title={t("button")} onPress={() => router.push("/hesap/alarmlar")} />
        </View>) : null;
      case "how": return (
        <InfoBox title={t("title")}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10 }}>
              <Text style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#E8EEFB", color: "#1F54C9", textAlign: "center", lineHeight: 26, fontWeight: "800", overflow: "hidden" }}>{i}</Text>
              <View style={{ flex: 1 }}><Text style={{ fontWeight: "800", color: C.text }}>{t(`s${i}t`)}</Text><Text style={{ color: C.muted }}>{t(`s${i}d`)}</Text></View>
            </View>
          ))}
        </InfoBox>);
      case "safe": return (
        <InfoBox title={t("title")}>
          <View style={{ flexDirection: "row", gap: 8 }}><Icon name="lock" size={16} sw={2} /><Text style={{ flex: 1, color: C.text, fontSize: 13 }}>{t("p1")}</Text></View>
          <View style={{ flexDirection: "row", gap: 8 }}><Icon name="check" size={16} sw={2} /><Text style={{ flex: 1, color: C.text, fontSize: 13 }}>{t("p2")}</Text></View>
        </InfoBox>);
    }
  };
  // Gizlenen ve "yalnız bilgisayarda" seçilen bölümler uygulamada görünmez.
  const shown = blocks.filter((b: HomeBlock) => !b.hidden && b.show !== "desktop");

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Intro />
      <Welcome ad={ads?.welcome} />
      <TopBar />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await Promise.all([loadSite(), loadLists()]); setRefreshing(false); }} />}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 30 }}>
        {shown.map((b) => <View key={b.id}>{b.type === "builtin" ? builtin(b.id) : <CustomBlock b={b} ads={ads?.blok ?? []} />}</View>)}
      </ScrollView>
    </View>
  );
}
