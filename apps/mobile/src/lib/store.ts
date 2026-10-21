import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Küçük tercihler (tanıtım görüldü mü, son aramalar). Telefonda cihazın deposunda, tarayıcı önizlemesinde tarayıcı deposunda.
export async function getItem(key: string): Promise<string | null> {
  try { return Platform.OS === "web" ? globalThis.localStorage?.getItem(key) ?? null : await SecureStore.getItemAsync(key); } catch { return null; }
}
export async function setItem(key: string, value: string) {
  try { if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value); else await SecureStore.setItemAsync(key, value); } catch { /* önemli değil */ }
}

const RECENT = "ak_son_aramalar";
export async function recentSearches(): Promise<string[]> {
  try { return JSON.parse((await getItem(RECENT)) ?? "[]") as string[]; } catch { return []; }
}
export async function addRecentSearch(q: string) {
  const t = q.trim(); if (t.length < 2) return;
  const list = [t, ...(await recentSearches()).filter((x) => x.toLocaleLowerCase("tr") !== t.toLocaleLowerCase("tr"))].slice(0, 8);
  await setItem(RECENT, JSON.stringify(list));
}
export const clearRecentSearches = () => setItem(RECENT, "[]");
