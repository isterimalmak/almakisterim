import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { api, API_URL, getToken } from "./api";

/** Sitenin bağlantısını (bildirimden ya da e-postadan) uygulamadaki ekrana çevirir; karşılığı yoksa sayfayı uygulama içi tarayıcıda açar. */
export function openLink(link: string) {
  const path = link.replace(/^https?:\/\/[^/]+/, "") || "/";
  const t = path.match(/^\/talep\/(\d+)(#mesajlar)?/);
  if (t) return t[2] ? router.push(`/mesaj/${t[1]}`) : router.push(`/talep/${t[1]}`);
  if (path.startsWith("/bana-ozel?s=mesaj")) return router.push("/mesajlar");
  if (path.startsWith("/bana-ozel")) return router.push("/hesap");
  if (path.startsWith("/kategori")) return router.push("/talepler");
  if (path === "/" || path.startsWith("/?")) return router.push("/");
  return WebBrowser.openBrowserAsync(`${API_URL}${path}`);
}
export const openWeb = (path: string) => WebBrowser.openBrowserAsync(`${API_URL}${path}`);
/** Sitenin üyeye özel sayfası (Güvenli Al, ayrıntılı alarm formu): tek kullanımlık biletle sitede de girişli açılır. */
export async function openWebAuthed(path: string) {
  if (!(await getToken())) return openWeb(path);
  try {
    const { bilet } = await api<{ bilet: string }>("/auth/web-ticket", { method: "POST", body: {} });
    return WebBrowser.openBrowserAsync(`${API_URL}/api/auth/web?bilet=${encodeURIComponent(bilet)}&next=${encodeURIComponent(path)}`);
  } catch { return openWeb(path); }
}
