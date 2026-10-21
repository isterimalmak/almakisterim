import { Tabs } from "expo-router";
import { Icon } from "@/components/Icon";
import { useSession } from "@/lib/session";
import { C } from "@/lib/theme";

const icon = (name: string) => ({ color, size }: { color: import("react-native").ColorValue; size: number }) => <Icon name={name} color={String(color)} size={size} />;

export default function TabsLayout() {
  const { user } = useSession();
  return (
    <Tabs screenOptions={{ headerStyle: { backgroundColor: C.navy }, headerTintColor: "#fff", headerTitleStyle: { fontWeight: "700" }, tabBarActiveTintColor: C.orange, tabBarInactiveTintColor: C.muted, sceneStyle: { backgroundColor: C.bg } }}>
      <Tabs.Screen name="index" options={{ title: "Ana Sayfa", headerTitle: "almakisterim", tabBarIcon: icon("home") }} />
      <Tabs.Screen name="talepler" options={{ title: "Talepler", tabBarIcon: icon("list") }} />
      <Tabs.Screen name="talep-ver" options={{ title: "Talep Ver", tabBarIcon: icon("plus"), tabBarActiveTintColor: C.orange }} />
      <Tabs.Screen name="mesajlar" options={{ title: "Mesajlar", tabBarIcon: icon("chat"), tabBarBadge: user?.unread_messages || undefined }} />
      <Tabs.Screen name="hesap" options={{ title: "Hesabım", tabBarIcon: icon("user"), tabBarBadge: user?.unread_notifications || undefined }} />
    </Tabs>
  );
}
