import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/** Sunucu adresi: EXPO_PUBLIC_API_URL (geliştirmede bilgisayarın yerel adresi) ya da app.json > extra.apiUrl */
export const API_URL: string = (process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "https://almakisterim.com").replace(/\/$/, "");
/** Sunucudan gelen "/api/__media/..." gibi göreli adresler tam adrese çevrilir. */
export const abs = (u: string | null | undefined) => (!u ? "" : /^https?:\/\//.test(u) ? u : `${API_URL}${u}`);

/**
 * Oturum anahtarı telefonun güvenli deposunda (iOS Keychain / Android Keystore) tutulur ve "x-ak-session" başlığıyla gönderilir.
 * Tarayıcıdaki önizlemede (yalnızca geliştirme) tarayıcı deposu kullanılır.
 */
const KEY = "ak_session";
let token: string | null | undefined;
let listeners: (() => void)[] = [];
export const onSessionChange = (fn: () => void) => { listeners.push(fn); return () => { listeners = listeners.filter((l) => l !== fn); }; };

export async function getToken(): Promise<string | null> {
  if (token !== undefined) return token;
  try { token = Platform.OS === "web" ? globalThis.localStorage?.getItem(KEY) ?? null : await SecureStore.getItemAsync(KEY); }
  catch { token = null; }
  return token;
}
export async function setToken(t: string | null) {
  token = t;
  try {
    if (Platform.OS === "web") { if (t) globalThis.localStorage?.setItem(KEY, t); else globalThis.localStorage?.removeItem(KEY); }
    else if (t) await SecureStore.setItemAsync(KEY, t); else await SecureStore.deleteItemAsync(KEY);
  } catch { /* yalnızca bellekte */ }
  listeners.forEach((l) => l());
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const t = await getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: { "x-ak-app": "1", ...(t ? { "x-ak-session": t } : {}), ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "omit",
    });
  } catch {
    throw new ApiError(0, "baglanti", "İnternet bağlantınızı kontrol edip tekrar deneyin.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (res.status === 401 && t) await setToken(null);
  if (!res.ok) throw new ApiError(res.status, data.error ?? "hata", data.message ?? "Bir sorun oluştu, lütfen tekrar deneyin.");
  return data as T;
}
