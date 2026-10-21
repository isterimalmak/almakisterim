import { Image } from "expo-image";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { abs } from "@/lib/api";
import { place, price } from "@/lib/format";
import { C, R } from "@/lib/theme";
import type { Req } from "@/lib/types";

export function Btn({ title, onPress, kind = "or", busy, disabled, style, label }: { title: string; onPress: () => void; kind?: "or" | "navy" | "wh" | "gh"; busy?: boolean; disabled?: boolean; style?: ViewStyle; label?: string }) {
  const bg = { or: C.orange, navy: C.navy, wh: C.card, gh: "transparent" }[kind];
  const fg = kind === "or" || kind === "navy" ? "#fff" : C.navy;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? title} disabled={disabled || busy} onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, borderWidth: kind === "wh" ? 1 : 0 }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnT, { color: fg }]}>{title}</Text>}
    </Pressable>
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

export const Empty = ({ text }: { text: string }) => <Text style={{ color: C.muted, textAlign: "center", padding: 24 }}>{text}</Text>;
export const Loading = () => <View style={{ padding: 30 }}><ActivityIndicator color={C.navy} /></View>;
export const Err = ({ text }: { text: string }) => <Text accessibilityRole="alert" style={{ color: C.red, fontSize: 13 }}>{text}</Text>;

/** Talep kartı (listeler ve vitrinler) */
export function ReqCard({ r, compact }: { r: Req; compact?: boolean }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={r.title} onPress={() => router.push(`/talep/${r.id}`)} style={({ pressed }) => [compact ? s.tile : s.card, pressed && { opacity: 0.85 }]}>
      <Image source={r.cover_url ? { uri: abs(r.cover_url) } : require("../../assets/splash-icon.png")} style={compact ? s.tileImg : s.cardImg} contentFit="cover" />
      <View style={{ flex: 1, padding: compact ? 8 : 0, gap: 3 }}>
        {r.is_urgent ? <Text style={s.urgent}>ACİL</Text> : null}
        <Text numberOfLines={2} style={s.cardT}>{r.title}</Text>
        <Text numberOfLines={1} style={s.cardS}>{place(r)}</Text>
        <Text style={s.price}>{price(r.budget_max)}</Text>
      </View>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  btn: { minHeight: 48, borderRadius: R.pill, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderColor: C.line },
  btnT: { fontWeight: "700", fontSize: 15 },
  label: { fontSize: 13, fontWeight: "700", color: C.navy },
  inp: { borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: "#fff", color: C.text },
  box: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  boxH: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  boxT: { fontSize: 16, fontWeight: "800", color: C.navy },
  card: { flexDirection: "row", gap: 12, backgroundColor: C.card, padding: 10, borderRadius: R.md, borderWidth: 1, borderColor: C.line },
  cardImg: { width: 96, height: 96, borderRadius: R.sm, backgroundColor: C.bg },
  tile: { width: 150, backgroundColor: C.card, borderRadius: R.md, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  tileImg: { width: 150, height: 112, backgroundColor: C.bg },
  cardT: { fontSize: 14, fontWeight: "700", color: C.text },
  cardS: { fontSize: 12, color: C.muted },
  price: { fontSize: 15, fontWeight: "800", color: C.orange },
  urgent: { alignSelf: "flex-start", backgroundColor: C.red, color: "#fff", fontSize: 10, fontWeight: "800", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});
