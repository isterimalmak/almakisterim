import { Alert, Platform } from "react-native";

/** Onay penceresi: telefonda yerel uyarı kutusu, tarayıcı önizlemesinde confirm(). */
export function confirm(title: string, message: string, ok: string, destructive = false): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((res) => Alert.alert(title, message, [{ text: "Vazgeç", style: "cancel", onPress: () => res(false) }, { text: ok, style: destructive ? "destructive" : "default", onPress: () => res(true) }], { cancelable: true, onDismiss: () => res(false) }));
}
