"use client";

// Analiz (ölçüm) çerezleri yalnızca ziyaretçi "Kabul et" derse çalışır (Çerez Politikası, 5. bölüm):
// Google Analytics 4, siteye ilk gelinen yerin kaydı (ak_kaynak) ve gezilen sayfaların kaydı (ak_ziyaretci). Reddedilirse hiçbiri oluşturulmaz.
const KEY = "ak_cerez";
const SRC = "ak_kaynak";
const SRC_DAYS = 30;
const VISITOR = "ak_ziyaretci";

type Gtag = (...args: unknown[]) => void;
declare global { interface Window { dataLayer?: unknown[]; gtag?: Gtag } }

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* gizli sekme */ } };
const del = (k: string) => { try { localStorage.removeItem(k); } catch { /* gizli sekme */ } };

export const consent = (): "evet" | "hayir" | null => { const v = get(KEY); return v === "evet" || v === "hayir" ? v : null; };
export function setConsent(v: "evet" | "hayir") {
  set(KEY, v);
  if (v === "hayir") { del(SRC); del(VISITOR); }
  window.dispatchEvent(new Event("ak-cerez"));
}

// İlk geliş: dışarıdan (arama motoru, başka site) ya da doğrudan gelindiğinde gelinen sitenin adı ve ilk sayfa saklanır.
// Site içi gezinmede ve 30 gün dolmadan üzerine yazılmaz (ilk temas sayılır).
export function captureSource() {
  if (consent() !== "evet") return;
  const cur = readSource();
  if (cur) return;
  let ref = "";
  try { ref = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : ""; } catch { ref = ""; }
  if (ref === location.hostname) return;
  set(SRC, JSON.stringify({ ref: ref.replace(/[^a-z0-9.-]/g, "").slice(0, 100), landing: location.pathname.slice(0, 200), at: Date.now() }));
}
function readSource(): { ref: string; landing: string } | null {
  try {
    const x = JSON.parse(get(SRC) ?? "null") as { ref: string; landing: string; at: number } | null;
    if (!x || Date.now() - x.at > SRC_DAYS * 864e5) return null;
    return { ref: x.ref, landing: x.landing };
  } catch { return null; }
}
// Talep verilirken talebe eklenir (yalnız onay varsa).
export const sourceForRequest = () => (consent() === "evet" ? readSource() ?? undefined : undefined);

// Ziyaretçi numarası: tarayıcıda üretilen rastgele değer (kişisel bilgi içermez); yalnız onay varsa oluşturulur.
export function visitorId(): string | null {
  if (consent() !== "evet") return null;
  const cur = get(VISITOR);
  if (cur && /^[a-z0-9]{16,40}$/.test(cur)) return cur;
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  const id = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  set(VISITOR, id);
  return id;
}

// Google Analytics 4: reklam ve Google sinyalleri kapalı. Tek sayfa gezinmeleri GA'nın "geçmiş değişikliği" ölçümüyle sayılır.
let loaded = "";
export function loadAnalytics(id: string) {
  if (!id || loaded === id || consent() !== "evet") return;
  loaded = id;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() { window.dataLayer!.push(arguments); } as Gtag; // eslint-disable-line prefer-rest-params
  window.gtag("js", new Date());
  window.gtag("config", id, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}
// Dönüşüm olayları (ör. talep verildi); onay yoksa ya da Analytics bağlı değilse hiçbir şey yapmaz.
export const track = (name: string, params: Record<string, string | number> = {}) => { if (loaded && window.gtag) window.gtag("event", name, params); };
