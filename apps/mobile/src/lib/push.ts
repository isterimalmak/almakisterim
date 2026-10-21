import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

// Uygulama açıkken gelen bildirim de üstte gösterilir.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
  });
}

let current: string | null = null;
export const pushToken = () => current;

/** Bildirim izni ister, Expo bildirim adresini alır ve sunucuya kaydeder. İzin verilmezse sessizce geçer. */
export async function registerPush() {
  if (Platform.OS === "web" || !Device.isDevice) return;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", { name: "Bildirimler", importance: Notifications.AndroidImportance.HIGH, lightColor: "#F26B1D" });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;
    const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
    const t = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    current = t;
    await api("/me/push-token", { body: { token: t, platform: Platform.OS === "ios" ? "ios" : "android" } });
  } catch { /* bildirim olmadan da uygulama çalışır */ }
}
