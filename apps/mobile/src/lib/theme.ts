import { Platform, type ViewStyle } from "react-native";

// Sitenin renkleri (apps/web/app/globals.css ile aynı) ve uygulamanın ortak görünüm ayarları.
export const C = {
  navy: "#13235B", navy2: "#04274F", blue: "#1F54C9", orange: "#F26B1D", orange2: "#FF8A3D", bg: "#F4F5F8", card: "#FFFFFF", text: "#1F2328", muted: "#6A717C",
  line: "#E7E9EE", green: "#1E8E3E", red: "#D93025", soft: "#FFF3EC", navySoft: "#EEF1FA",
};
export const R = { sm: 8, md: 12, lg: 18, pill: 999 };
// Kartlar için yumuşak gölge (Android'de elevation).
const sh = (y: number, blur: number, o: number, el: number): ViewStyle => Platform.select<ViewStyle>({
  android: { elevation: el },
  default: { shadowColor: "#0B1530", shadowOpacity: o, shadowRadius: blur, shadowOffset: { width: 0, height: y } },
})!;
export const SH = { sm: sh(1, 4, 0.06, 1), md: sh(4, 14, 0.08, 3), lg: sh(10, 24, 0.14, 8) };
// Renk geçişleri: turuncu düğmeler, lacivert kartlar.
export const G = { orange: ["#FF8A3D", "#F26B1D"] as const, navy: ["#1E3A8A", "#13235B"] as const, warm: ["#FFF7F1", "#FFFFFF"] as const };
