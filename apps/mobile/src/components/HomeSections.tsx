import { Image } from "expo-image";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View, type LayoutChangeEvent } from "react-native";
import { api, abs } from "@/lib/api";
import { theme, type Ad, type HomeBlock } from "@/lib/home";
import { openHref } from "@/lib/links";
import { LinearGradient } from "expo-linear-gradient";
import { C, G, R, SH } from "@/lib/theme";
import type { Category, Page, Req } from "@/lib/types";
import { Icon } from "./Icon";
import { Press, ReqCard, s } from "./ui";

// Uygulamanın ana sayfa bölümleri: sitenin telefon görünümüyle aynı (apps/web/components/HomeView.tsx, HomeBlocks.tsx, Ads.tsx).

const Go = ({ href, children, label, style }: { href: string | null | undefined; children: ReactNode; label?: string; style?: object }) =>
  href ? <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => void openHref(href)} style={style}>{children}</Pressable> : <View style={style}>{children}</View>;

/** Bölüm başlığı ve sağda "Tümünü gör" bağlantısı */
export function SecHead({ title, link, onLink }: { title: string; link?: string; onLink?: () => void }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, marginBottom: 8 }}>
      <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "800", color: C.text, flexShrink: 1 }}>{title}</Text>
      {link && onLink ? <Text accessibilityRole="link" onPress={onLink} style={{ color: C.orange, fontWeight: "700" }}>{link} ›</Text> : null}
    </View>
  );
}

/* ---------------- Talep kutusu ---------------- */
export function Hero({ T, examples }: { T: (k: string) => string; examples: string[] }) {
  const [q, setQ] = useState("");
  const [ex, setEx] = useState(0);
  // Kutu boşken örnek 4 saniyede bir değişir (sitedeki gibi).
  useEffect(() => { if (q) return; const t = setInterval(() => setEx((i) => (i + 1) % examples.length), 4000); return () => clearInterval(t); }, [q, examples.length]);
  const go = () => router.push({ pathname: "/talep-ver", params: q.trim() ? { metin: q.trim() } : {} });
  return (
    <LinearGradient colors={["#FFF4EA", "#FFFFFF", "#F3F6FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ margin: 12, marginBottom: 14, padding: 16, borderRadius: R.lg, borderWidth: 1, borderColor: "#FBE0CF", gap: 10 }, SH.sm]}>
      {T("badge") ? <Text style={{ alignSelf: "flex-start", backgroundColor: C.orange, color: "#fff", fontWeight: "800", fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, overflow: "hidden" }}>{T("badge")}</Text> : null}
      <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: "800", color: C.navy }}>{T("title")}</Text>
      {T("sub") ? <Text style={{ fontSize: 15, color: "#3A4250" }}>{T("sub")}</Text> : null}
      <View style={{ backgroundColor: "#fff", borderRadius: R.md, borderWidth: 1, borderColor: "#F5CDB4", padding: 6, gap: 6 }}>
        <TextInput accessibilityLabel="Ne almak istiyorsunuz?" value={q} onChangeText={setQ} placeholder={`Örn. ${examples[ex]}`} placeholderTextColor="#9AA1AB"
          returnKeyType="go" onSubmitEditing={go} style={{ fontSize: 16, paddingHorizontal: 10, paddingVertical: 10, color: C.text }} />
        <Press accessibilityRole="button" onPress={go} style={[{ borderRadius: R.sm, overflow: "hidden" }, SH.md]}>
          <LinearGradient colors={G.orange} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingVertical: 14, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16.5 }}>{T("button")}</Text>
          </LinearGradient>
        </Press>
      </View>
      {T("ai") ? <Text style={{ fontSize: 13, color: "#3A4250" }}>✨ {T("ai")}</Text> : null}
      <View style={{ flexDirection: "row", gap: 6 }} accessibilityLabel="Nasıl çalışır">
        {["s1", "s2", "s3"].map((k, i) => (
          <View key={k} style={{ flex: 1, backgroundColor: "#fff", borderRadius: R.md, borderWidth: 1, borderColor: C.line, padding: 8, alignItems: "center", gap: 4 }}>
            <Text style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFE8DA", color: C.orange, textAlign: "center", lineHeight: 24, fontWeight: "800", overflow: "hidden" }}>{i + 1}</Text>
            <Text style={{ fontSize: 12, fontWeight: "800", color: C.navy, textAlign: "center" }}>{T(k)}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

/* ---------------- Kategori kutucukları ---------------- */
export function CatTiles({ cats, browse, count, urgentTotal }: { cats: Category[]; browse: boolean; count: (n?: number) => number | null; urgentTotal: number }) {
  // Az kategori varsa (4 ve altı) satıra eşit yayılır; sağ taraf boş kalmasın. Fazlaysa yana kayar.
  const few = cats.length + (urgentTotal > 0 ? 1 : 0) <= 4;
  const tile = few ? { flex: 1, alignItems: "center" as const, gap: 6 } : { width: 76, alignItems: "center" as const, gap: 6 };
  const items = (
    <>
      {urgentTotal > 0 && (
        <Pressable accessibilityRole="link" accessibilityLabel="Acil Talepler" onPress={() => router.push({ pathname: "/talepler", params: { urgent: "1" } })} style={tile}>
          <View style={{ width: 70, height: 70, borderRadius: 18, borderWidth: 2.5, borderColor: C.red, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 50, height: 50, borderRadius: 12, backgroundColor: C.red, alignItems: "center", justifyContent: "center" }}><Icon name="bolt" size={24} color="#fff" sw={2.2} /></View>
          </View>
          <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: "700", color: C.text, textAlign: "center" }}>Acil Talepler</Text>
        </Pressable>
      )}
      {cats.map((c) => {
        const t = theme(c.id);
        const n = count(c.active_count);
        return (
          <Pressable key={c.id} accessibilityRole="link" accessibilityLabel={c.name}
            onPress={() => (browse ? router.push({ pathname: "/talepler", params: { top: c.id } }) : router.push("/talep-ver"))} style={tile}>
            <View style={{ width: 70, height: 70, borderRadius: 18, borderWidth: 2.5, borderColor: t.fc, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 50, height: 50, borderRadius: 12, backgroundColor: t.c, alignItems: "center", justifyContent: "center" }}><Icon name={c.icon} size={24} color={t.fc} /></View>
              {n !== null && <Text style={{ position: "absolute", bottom: -8, backgroundColor: t.fc, color: "#fff", fontSize: 10, fontWeight: "800", paddingHorizontal: 6, paddingVertical: 1, borderRadius: R.pill, overflow: "hidden" }}>{n} talep</Text>}
            </View>
            <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: "700", color: C.text, textAlign: "center", marginTop: n !== null ? 4 : 0 }}>{c.name}</Text>
          </Pressable>
        );
      })}
    </>
  );
  return few ? (
    <View accessibilityLabel="Kategoriler" style={{ flexDirection: "row", paddingHorizontal: 12, gap: 12, paddingVertical: 4, marginBottom: 14 }}>{items}</View>
  ) : (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Kategoriler" contentContainerStyle={{ paddingHorizontal: 12, gap: 12, paddingVertical: 4, marginBottom: 14 }}>{items}</ScrollView>
  );
}

/* ---------------- Reklam ve afiş görselleri ---------------- */
// Video sessiz ve döngüde oynar; köşedeki düğmeyle ses açılır (sitedeki gibi).
function AdVideo({ url, label, startMuted = true }: { url: string; label: string; startMuted?: boolean }) {
  const player = useVideoPlayer(abs(url), (p) => { p.loop = true; p.muted = startMuted; p.play(); });
  const [muted, setMuted] = useState(startMuted);
  return (
    <View style={{ flex: 1 }}>
      <VideoView player={player} style={{ flex: 1 }} contentFit="cover" nativeControls={false} accessibilityLabel={label} />
      <Pressable accessibilityRole="button" accessibilityLabel={muted ? "Sesi aç" : "Sesi kapat"} onPress={() => { player.muted = !muted; setMuted(!muted); player.play(); }}
        style={{ position: "absolute", left: 8, bottom: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,.55)", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontSize: 14 }}>{muted ? "🔇" : "🔊"}</Text>
      </Pressable>
    </View>
  );
}
export function AdMedia({ a }: { a: Ad }) {
  return a.media.kind === "video"
    ? <AdVideo url={a.media.url} label={a.title || "Tanıtım videosu"} />
    : <Image source={{ uri: abs(a.media.url) }} style={{ flex: 1 }} contentFit="cover" accessibilityLabel={a.title || "Tanıtım"} />;
}
/** İkişerli ızgara; sayı tekse son kutu tam genişlik olur (boşluk kalmasın). */
export function AdGrid({ ads, label = "Tanıtımlar" }: { ads: Ad[]; label?: string }) {
  if (!ads.length) return null;
  const odd = ads.length % 2 === 1;
  return (
    <View accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 12, marginBottom: 14 }}>
      {ads.map((a, i) => {
        const wide = ads.length === 1 || (odd && i === ads.length - 1);
        return (
          <Go key={a.id} href={a.link_url} label={a.title || "Tanıtım"}
            style={{ width: wide ? "100%" : "48.5%", aspectRatio: wide ? 16 / 9 : 4 / 3, borderRadius: R.md, overflow: "hidden", backgroundColor: C.card, borderWidth: 1, borderColor: C.line }}>
            <AdMedia a={a} />
          </Go>
        );
      })}
    </View>
  );
}

/* ---------------- Yöneticinin eklediği bölümler ---------------- */
const TONES = { acik: { bg: C.card, fg: C.text, h: C.navy }, lacivert: { bg: C.navy, fg: "#fff", h: "#fff" }, turuncu: { bg: C.orange, fg: "#fff", h: "#fff" }, yesil: { bg: C.green, fg: "#fff", h: "#fff" } } as const;

function Marquee({ b }: { b: Extract<HomeBlock, { type: "marquee" }> }) {
  const x = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!w) return;
    x.setValue(0);
    // Sitedeki gibi: yazı uzunluğundan bağımsız, seçilen hızda (saniyede piksel) kayar.
    const pxs = ({ 1: 30, 2: 45, 3: 65, 4: 90, 5: 125 } as Record<number, number>)[b.speed ?? 2] ?? 45;
    const anim = Animated.loop(Animated.timing(x, { toValue: -w, duration: (w / pxs) * 1000, easing: Easing.linear, useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, [w, x, b.speed]);
  const row = (onLayout?: (e: LayoutChangeEvent) => void) => (
    <View onLayout={onLayout} style={{ flexDirection: "row" }}>
      {Array.from({ length: 4 }, (_, i) => <Text key={i} style={{ color: b.fg, fontSize: 18, fontWeight: "800", paddingRight: 28 }}>{b.text}   •</Text>)}
    </View>
  );
  return (
    <Go href={b.href} label={b.text} style={{ marginHorizontal: 12, marginBottom: 14, borderRadius: R.md, overflow: "hidden", backgroundColor: b.bg, paddingVertical: 10 }}>
      <Animated.View style={{ flexDirection: "row", transform: [{ translateX: x }] }}>
        {row((e) => setW(e.nativeEvent.layout.width))}{row()}
      </Animated.View>
    </Go>
  );
}

// Kayan vitrin / kategori vitrini: talepler yatay şeritte.
function ReqRow({ title, items, link, onLink }: { title: string; items: Req[]; link?: string; onLink?: () => void }) {
  if (!items.length) return null;
  return (
    <View accessibilityLabel={title} style={{ marginBottom: 16 }}>
      <SecHead title={title} link={link} onLink={onLink} />
      <FlatList horizontal data={items} keyExtractor={(x) => String(x.id)} contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }} showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => <ReqCard r={item} compact />} />
    </View>
  );
}
function Showcase({ b }: { b: Extract<HomeBlock, { type: "showcase" }> }) {
  const [items, setItems] = useState<Req[]>([]);
  const key = b.request_ids.join(",");
  useEffect(() => {
    if (!key) return;
    void api<Page<Req>>(`/requests?ids=${key}&per=40`).then((r) => setItems(key.split(",").map((id) => r.items.find((x) => String(x.id) === id)).filter((x): x is Req => !!x))).catch(() => {});
  }, [key]);
  return <ReqRow title={b.title || "Vitrin"} items={items} />;
}
function CatVitrin({ b }: { b: Extract<HomeBlock, { type: "catvitrin" }> }) {
  const [items, setItems] = useState<Req[]>([]);
  const key = JSON.stringify([b.top, b.limit, b.include_ids, b.exclude_ids]);
  useEffect(() => {
    // Elle eklenenler başta, sonra kategorinin talepleri; çıkarılanlar görünmez (sitedeki catVitrinItems ile aynı).
    void Promise.all([
      b.include_ids.length ? api<Page<Req>>(`/requests?ids=${b.include_ids.join(",")}&per=40`).then((r) => r.items) : Promise.resolve([] as Req[]),
      api<Page<Req>>(`/requests?top=${encodeURIComponent(b.top)}&sort=vitrin&per=${Math.min(50, b.limit + b.exclude_ids.length + b.include_ids.length)}`).then((r) => r.items),
    ]).then(([inc, auto]) => {
      const pinned = b.include_ids.map((id) => inc.find((x) => x.id === id)).filter((x): x is Req => !!x);
      const seen = new Set(pinned.map((x) => x.id));
      setItems([...pinned, ...auto.filter((x) => !seen.has(x.id))].filter((x) => !b.exclude_ids.includes(x.id)).slice(0, b.limit));
    }).catch(() => {});
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <ReqRow title={b.title} items={items} link="Tümünü gör" onLink={() => router.push({ pathname: "/talepler", params: { top: b.top } })} />;
}

export function CustomBlock({ b, ads }: { b: Exclude<HomeBlock, { type: "builtin" }>; ads: Ad[] }) {
  if (b.type === "showcase") return <Showcase b={b} />;
  if (b.type === "catvitrin") return <CatVitrin b={b} />;
  if (b.type === "marquee") return b.text ? <Marquee b={b} /> : null;
  if (b.type === "text") {
    if (!b.title && !b.text) return null;
    const t = TONES[b.tone] ?? TONES.acik;
    const center = b.align === "orta";
    return (
      <View style={{ marginHorizontal: 12, marginBottom: 14, padding: 18, borderRadius: R.md, backgroundColor: t.bg, borderWidth: b.tone === "acik" ? 1 : 0, borderColor: C.line, gap: 8, alignItems: center ? "center" : "flex-start" }}>
        {b.title ? <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "800", color: t.h, textAlign: center ? "center" : "left" }}>{b.title}</Text> : null}
        {b.text ? <Text style={{ fontSize: 14, lineHeight: 21, color: t.fg, textAlign: center ? "center" : "left" }}>{b.text}</Text> : null}
        {b.cta && b.href ? (
          <Pressable accessibilityRole="button" onPress={() => void openHref(b.href)} style={{ marginTop: 4, backgroundColor: b.tone === "acik" ? C.orange : "#fff", borderRadius: R.pill, paddingHorizontal: 20, paddingVertical: 11 }}>
            <Text style={{ fontWeight: "800", color: b.tone === "acik" ? "#fff" : t.bg }}>{b.cta}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  // Afiş: yöneticinin seçtiği görseller.
  // "Yalnız bilgisayar" görseller telefonda gösterilmez ve ızgarada yer tutmaz.
  const items = b.ad_ids.map((id) => ads.find((a) => a.id === id)).filter((a): a is Ad => !!a && a.device !== "desktop");
  if (!items.length) return null;
  return (
    <View>
      {b.title ? <SecHead title={b.title} /> : null}
      <AdGrid ads={items} label={b.title || "Afiş"} />
    </View>
  );
}

/* ---------------- Yan kutular (sitede sağ sütunda, telefonda sırasıyla) ---------------- */
export function InfoBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={[s.box, { marginHorizontal: 12, marginBottom: 14 }]}>
      <View style={s.boxH}><Text accessibilityRole="header" style={s.boxT}>{title}</Text></View>
      <View style={{ padding: 14, gap: 12 }}>{children}</View>
    </View>
  );
}

/* ---------------- Açılış penceresi (Yönetim → Reklam Alanları → Açılışta göster) ---------------- */
let welcomeShown: number | null = null;
export function Welcome({ ad }: { ad: Ad | null | undefined }) {
  const [open, setOpen] = useState(false);
  // Uygulama her açılışta bir kez gösterir.
  useEffect(() => { if (ad && ad.device !== "desktop" && welcomeShown !== ad.id) { welcomeShown = ad.id; setOpen(true); } }, [ad]);
  if (!ad || !open) return null;
  const close = () => setOpen(false);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: "rgba(10,16,32,.72)", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <View style={{ width: "100%", maxWidth: 460, aspectRatio: 4 / 5, maxHeight: "72%", borderRadius: R.lg, overflow: "hidden", backgroundColor: "#000" }}>
          <Pressable accessibilityRole={ad.link_url ? "link" : undefined} accessibilityLabel={ad.title || "Tanıtım"} disabled={!ad.link_url} style={{ flex: 1 }}
            onPress={() => { close(); void openHref(ad.link_url); }}>
            {ad.media.kind === "video" ? <AdVideo url={ad.media.url} label={ad.title || "Tanıtım videosu"} /> : <Image source={{ uri: abs(ad.media.url) }} style={{ flex: 1 }} contentFit="contain" />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={close}
            style={{ position: "absolute", top: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,.6)", alignItems: "center", justifyContent: "center" }}>
            <Icon name="x" size={20} color="#fff" sw={2.4} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
