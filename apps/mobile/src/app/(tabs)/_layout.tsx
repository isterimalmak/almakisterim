import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { tap } from "@/components/ui";
import { useSession } from "@/lib/session";
import { C, G, SH } from "@/lib/theme";

const icon = (name: string) => ({ color, size }: { color: import("react-native").ColorValue; size: number }) => <Icon name={name} color={String(color)} size={size} />;

// Ortadaki "Talep Ver": sitedeki gibi alt menüden taşan turuncu yuvarlak düğme.
function TalepVerButton(p: { onPress?: (e: never) => void; accessibilityState?: { selected?: boolean } }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Talep Ver" onPress={(e) => { tap(); p.onPress?.(e as never); }} style={{ flex: 1, alignItems: "center" }}>
      <View style={[{ marginTop: -22, width: 60, height: 60, borderRadius: 30, borderWidth: 4, borderColor: C.card, overflow: "hidden" }, SH.lg]}>
        <LinearGradient colors={G.orange} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Icon name="plus" size={28} color="#fff" sw={2.6} />
        </LinearGradient>
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { user } = useSession();
  // Android'in alt gezinme tuşları (geri, ana ekran) menünün üstüne binmesin: alttaki boşluk kadar yükselt.
  const bottom = useSafeAreaInsets().bottom;
  return (
    <Tabs screenListeners={{ tabPress: () => tap() }} screenOptions={{
      headerStyle: { backgroundColor: C.card }, headerTintColor: C.navy, headerTitleStyle: { fontWeight: "800", color: C.navy, fontSize: 19 }, headerShadowVisible: false,
      tabBarActiveTintColor: C.orange, tabBarInactiveTintColor: "#8A919C", tabBarLabelStyle: { fontSize: 11, fontWeight: "700", lineHeight: 15 },
      tabBarStyle: { backgroundColor: C.card, borderTopColor: C.line, height: 70 + bottom, paddingTop: 6, paddingBottom: 12 + bottom },
      tabBarBadgeStyle: { backgroundColor: C.orange, fontSize: 10, fontWeight: "800" }, sceneStyle: { backgroundColor: C.bg },
    }}>
      {/* Ana sayfanın kendi üst çubuğu var (logo, arama, bildirimler; sitedeki gibi beyaz). */}
      <Tabs.Screen name="index" options={{ title: "Ana Sayfa", headerShown: false, tabBarIcon: icon("home") }} />
      <Tabs.Screen name="talepler" options={{ title: "Talepler", tabBarIcon: icon("list") }} />
      <Tabs.Screen name="talep-ver" options={{ title: "Talep Ver", tabBarLabel: () => null, tabBarButton: (p) => <TalepVerButton onPress={p.onPress as never} /> }} />
      <Tabs.Screen name="mesajlar" options={{ title: "Mesajlar", tabBarIcon: icon("chat"), tabBarBadge: user?.unread_messages || undefined }} />
      <Tabs.Screen name="hesap" options={{ title: "Hesabım", tabBarIcon: icon("user"), tabBarBadge: user?.unread_notifications || undefined }} />
    </Tabs>
  );
}
