import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TermsGate } from "@/components/TermsGate";
import { openLink } from "@/lib/links";
import { SessionProvider } from "@/lib/session";
import { C } from "@/lib/theme";

export default function Root() {
  // Bildirime dokununca ilgili ekran açılır (yeni teklif → talep, yeni mesaj → konuşma).
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const link = (r.notification.request.content.data as { link?: string } | undefined)?.link;
      if (link) openLink(link);
    });
    return () => sub.remove();
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          {/* Beyaz üst çubuk (sitedeki gibi): koyu durum çubuğu yazıları, lacivert başlık. */}
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerStyle: { backgroundColor: C.card }, headerTintColor: C.navy, headerTitleStyle: { fontWeight: "800", color: C.navy }, headerShadowVisible: false, contentStyle: { backgroundColor: C.bg }, headerBackTitle: "Geri" }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="talep/[id]" options={{ title: "Talep" }} />
            <Stack.Screen name="mesaj/[id]" options={{ title: "Mesajlar" }} />
            <Stack.Screen name="giris" options={{ title: "Giriş yap", presentation: "modal" }} />
            <Stack.Screen name="hesap/taleplerim" options={{ title: "Taleplerim" }} />
            <Stack.Screen name="hesap/numaralar" options={{ title: "Numarasını Açtıklarım" }} />
            <Stack.Screen name="hesap/bildirimler" options={{ title: "Bildirimler" }} />
            <Stack.Screen name="hesap/alarmlar" options={{ title: "Talep Alarmları" }} />
            <Stack.Screen name="hesap/bilgiler" options={{ title: "Hesap Bilgileri" }} />
            <Stack.Screen name="hesap/favoriler" options={{ title: "Favori Talepler" }} />
            <Stack.Screen name="hesap/uygun" options={{ title: "Size Uygun Talepler" }} />
          </Stack>
          <TermsGate />
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
