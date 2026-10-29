import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, type ReactNode } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type TextInputProps, type ViewStyle } from "react-native";
import { abs } from "@/lib/api";
import { place, price } from "@/lib/format";
import { theme } from "@/lib/home";
import { C, G, R, SH } from "@/lib/theme";
import type { Req } from "@/lib/types";
import { Icon } from "./Icon";

/** Dokunuşta hafif titreşim (web'de yok). */
export const tap = () => { if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => {}); };

/** Basılınca hafifçe küçülen dokunma alanı (kartlar, düğmeler). */
// Yerleşimi belirleyen özellikler (genişlik, boşluk) dıştaki dokunma alanına da verilir; yoksa düğme satırda daralır.
const OUTER = ["flex", "flexGrow", "flexShrink", "flexBasis", "alignSelf", "width", "minWidth", "maxWidth", "margin", "marginTop", "marginBottom", "marginLeft", "marginRight", "marginHorizontal", "marginVertical"] as const;
export function Press({ style, children, onPress, scale = 0.97, ...p }: Omit<PressableProps, "style" | "children"> & { style?: ViewStyle | ViewStyle[]; children: ReactNode; scale?: number }) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (x: number) => Animated.spring(v, { toValue: x, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const flat = StyleSheet.flatten(style) ?? {};
  const outer = Object.fromEntries(OUTER.filter((k) => flat[k] !== undefined).map((k) => [k, flat[k]])) as ViewStyle;
  const inner = { ...flat, ...Object.fromEntries(OUTER.filter((k) => k.startsWith("margin")).map((k) => [k, undefined])), ...(outer.flex !== undefined || outer.width !== undefined || outer.alignSelf === "stretch" ? { width: "100%" as const, flex: undefined } : {}) } as ViewStyle;
  return (
    <Pressable {...p} style={outer} onPress={(e) => { tap(); onPress?.(e); }} onPressIn={() => to(scale)} onPressOut={() => to(1)}>
      <Animated.View style={[inner, { transform: [{ scale: v }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Btn({ title, onPress, kind = "or", busy, disabled, style, label, icon }: { title: string; onPress: () => void; kind?: "or" | "navy" | "wh" | "gh"; busy?: boolean; disabled?: boolean; style?: ViewStyle; label?: string; icon?: string }) {
  const fg = kind === "or" || kind === "navy" ? "#fff" : C.navy;
  const inner = (
    <>
      {busy ? <ActivityIndicator color={fg} /> : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon ? <Icon name={icon} size={18} color={fg} sw={2.2} /> : null}
          <Text style={[s.btnT, { color: fg }]}>{title}</Text>
        </View>
      )}
    </>
  );
  const box: ViewStyle = { ...s.btn, opacity: disabled ? 0.5 : 1, ...(kind === "wh" ? { backgroundColor: C.card, borderWidth: 1 } : kind === "gh" ? { backgroundColor: "transparent" } : {}), ...(kind === "or" && !disabled ? SH.md : {}) };
  return (
    <Press accessibilityRole="button" accessibilityLabel={label ?? title} disabled={disabled || busy} onPress={onPress} style={[box, style ?? {}]}>
      {kind === "or" || kind === "navy"
        ? <LinearGradient colors={kind === "or" ? G.orange : G.navy} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: R.pill }]} />
        : null}
      {inner}
    </Press>
  );
}

export function Field({ label, ...p }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor="#9AA1AB" {...p} style={[s.inp, p.multiline && { minHeight: 96, textAlignVertical: "top" }, p.style]} />
    </View>
  );
}

export const Box = ({ title, right, children, style }: { title?: string; right?: ReactNode; children: ReactNode; style?: ViewStyle }) => (
  <View style={[s.box, style]}>
    {title ? <View style={s.boxH}><Text accessibilityRole="header" style={s.boxT}>{title}</Text>{right}</View> : null}
    <View style={{ padding: 14, gap: 10 }}>{children}</View>
  </View>
);

/** Boş liste: simge, yazı ve isteğe bağlı düğme. */
export function Empty({ text, icon = "search", action, onAction }: { text: string; icon?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: "center", padding: 28, gap: 12 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.navySoft, alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={32} color={C.navy} /></View>
      <Text style={{ color: C.muted, textAlign: "center", fontSize: 14, lineHeight: 20 }}>{text}</Text>
      {action && onAction ? <Btn title={action} onPress={onAction} style={{ alignSelf: "stretch" }} /> : null}
    </View>
  );
}

/** Yüklenirken yanıp sönen gri kutular (liste iskeleti). */
export function Skeleton({ rows = 5, tile }: { rows?: number; tile?: boolean }) {
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(o, { toValue: 1, duration: 650, useNativeDriver: true }), Animated.timing(o, { toValue: 0.5, duration: 650, useNativeDriver: true })]));
    a.start(); return () => a.stop();
  }, [o]);
  const bar = (w: number | `${number}%`, h = 12) => <View style={{ width: w, height: h, borderRadius: 6, backgroundColor: "#E4E7ED" }} />;
  return (
    <Animated.View accessibilityLabel="Yükleniyor" style={{ opacity: o, padding: 12, gap: 10, flexDirection: tile ? "row" : "column" }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={tile ? [s.tile, { padding: 0 }] : [s.card]}>
          <View style={tile ? s.tileImg : [s.cardImg, { backgroundColor: "#E4E7ED" }]} />
          <View style={{ flex: 1, gap: 8, padding: tile ? 10 : 2 }}>{bar("85%")}{bar("55%")}{bar("40%", 16)}</View>
        </View>
      ))}
    </Animated.View>
  );
}
export const Loading = () => <View style={{ padding: 30 }}><ActivityIndicator color={C.orange} /></View>;
export const Err = ({ text }: { text: string }) => <Text accessibilityRole="alert" style={{ color: C.red, fontSize: 13 }}>{text}</Text>;

/** Seçilebilir yuvarlak etiket (kategori, sıralama). */
export function Chip({ on, text, onPress, small, icon, color }: { on: boolean; text: string; onPress: () => void; small?: boolean; icon?: string; color?: string }) {
  const c = color ?? C.navy;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { tap(); onPress(); }}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: small ? 11 : 14, paddingVertical: small ? 6 : 8, borderRadius: R.pill, backgroundColor: on ? c : C.card, borderWidth: 1, borderColor: on ? c : C.line }}>
      {icon ? <Icon name={icon} size={small ? 14 : 16} color={on ? "#fff" : c} /> : null}
      <Text style={{ fontSize: small ? 12 : 13, fontWeight: "700", color: on ? "#fff" : C.text }}>{text}</Text>
    </Pressable>
  );
}

// Talebin yeni (2 gün) olup olmadığı ve kalan süresi.
const isNew = (iso: string) => Date.now() - new Date(iso).getTime() < 2 * 864e5;
const leftTxt = (iso: string) => { const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5); return d <= 0 ? "Bugün bitiyor" : `${d} gün kaldı`; };

function Badges({ r }: { r: Req }) {
  const out: [string, string][] = [];
  if (r.is_urgent) out.push(["ACİL", C.red]);
  if (r.is_corporate) out.push(["KURUMSAL", C.blue]);
  if (isNew(r.created_at)) out.push(["YENİ", C.green]);
  if (!out.length) return null;
  return <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>{out.map(([t, c]) => <Text key={t} style={[s.badge, { backgroundColor: c }]}>{t}</Text>)}</View>;
}

/** Fotoğrafı olmayan talepte kategorinin rengi ve simgesi. */
function Cover({ r, style }: { r: Req; style: ViewStyle }) {
  if (r.cover_url) return <Image source={{ uri: abs(r.cover_url) }} style={style as object} contentFit="cover" transition={200} />;
  const t = theme(r.top_id);
  return <View style={[style, { backgroundColor: t.c, alignItems: "center", justifyContent: "center" }]}><Icon name={ICONS[r.top_id] ?? "box"} size={34} color={t.fc} sw={1.5} /></View>;
}
const ICONS: Record<string, string> = { vasita: "car", emlak: "home", elektronik: "phone", ev: "sofa", yedek: "gear", hizmet: "wrench", ders: "book", sanayi: "crane", moda: "shirt", bebek: "stroller", spor: "bike", toptan: "box" };

/** Talep kartı (listeler ve vitrinler) */
export function ReqCard({ r, compact }: { r: Req; compact?: boolean }) {
  if (compact) return (
    <Press accessibilityRole="link" accessibilityLabel={r.title} onPress={() => router.push(`/talep/${r.id}`)} style={s.tile}>
      <View>
        <Cover r={r} style={s.tileImg} />
        <View style={{ position: "absolute", left: 8, top: 8 }}><Badges r={r} /></View>
      </View>
      <View style={{ padding: 10, gap: 3 }}>
        <Text numberOfLines={2} style={[s.cardT, { minHeight: 36 }]}>{r.title}</Text>
        <Text numberOfLines={1} style={s.cardS}>{place(r)}</Text>
        <Text style={s.price}>{price(r.budget_max)}</Text>
      </View>
    </Press>
  );
  return (
    <Press accessibilityRole="link" accessibilityLabel={r.title} onPress={() => router.push(`/talep/${r.id}`)} style={s.card} scale={0.985}>
      <Cover r={r} style={s.cardImg} />
      <View style={{ flex: 1, gap: 4 }}>
        <Badges r={r} />
        <Text numberOfLines={2} style={s.cardT}>{r.title}</Text>
        {r.category_name ? <Text numberOfLines={1} style={s.cardS}>{r.category_name}</Text> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="pin" size={13} color={C.muted} /><Text numberOfLines={1} style={[s.cardS, { flex: 1 }]}>{place(r)}</Text></View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          <Text style={s.price}>{price(r.budget_max)}</Text>
          <Text style={s.left}>{leftTxt(r.expires_at)}</Text>
        </View>
      </View>
    </Press>
  );
}

export const s = StyleSheet.create({
  btn: { minHeight: 50, borderRadius: R.pill, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderColor: C.line, overflow: "hidden" },
  btnT: { fontWeight: "800", fontSize: 15.5, letterSpacing: 0.2 },
  label: { fontSize: 13, fontWeight: "700", color: C.navy },
  inp: { borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: "#fff", color: C.text },
  box: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, overflow: "hidden", ...SH.sm },
  boxH: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  boxT: { fontSize: 16, fontWeight: "800", color: C.navy },
  card: { flexDirection: "row", gap: 12, backgroundColor: C.card, padding: 10, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, ...SH.sm },
  cardImg: { width: 104, height: 104, borderRadius: R.md, backgroundColor: C.bg },
  tile: { width: 160, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, overflow: "hidden", ...SH.sm },
  tileImg: { width: 160, height: 120, backgroundColor: C.bg },
  cardT: { fontSize: 14.5, fontWeight: "800", color: C.text, lineHeight: 19 },
  cardS: { fontSize: 12.5, color: C.muted },
  price: { fontSize: 16, fontWeight: "900", color: C.orange },
  left: { fontSize: 11, fontWeight: "700", color: C.muted, backgroundColor: C.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill, overflow: "hidden" },
  badge: { color: "#fff", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, overflow: "hidden" },
  urgent: { alignSelf: "flex-start", backgroundColor: C.red, color: "#fff", fontSize: 10, fontWeight: "800", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});
