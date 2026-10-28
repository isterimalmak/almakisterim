"use client";

import { isHidden, type HomeBlock } from "@/lib/home";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, type CategoryTop, type User } from "@/lib/api";
import { TermsGate } from "./TermsGate";
import { DEFAULT_FOOTER, type Footer } from "@/lib/footer";

type Browse = { min_requests: number; show_counts_min: number };
// /api/categories yanıtı: kategoriler ve site ayarları. Kök düzen sunucuda alıp verir; sayfa ilk açılışta dolu gelir, kaymaz.
export type SiteData = { categories: CategoryTop[]; browse?: Browse; launch_mode?: boolean; phone_required?: boolean; publish_sms?: boolean; photo_required?: boolean; home_urgent_box?: boolean; home_blocks?: HomeBlock[]; site_name?: string; footer?: Footer; show_safe?: boolean; show_credits?: boolean };

type Ctx = {
  user: User | null;
  ready: boolean;
  // Bütün kategoriler: talep verirken kullanılır.
  categories: CategoryTop[];
  // Gezinme için: yeterli açık talebi olan kategoriler. Boş bölümler satıcıya gösterilmez.
  browseCategories: CategoryTop[];
  // Sayaç küçükse null döner; site boş görünmesin diye "(2)" gibi sayılar gösterilmez.
  count: (n: number | undefined | null) => number | null;
  launchMode: boolean;
  phoneRequired: boolean;
  publishSms: boolean;
  photoRequired: boolean;
  homeUrgentBox: boolean;
  // Ana sayfa bölümleri (sırası, gizlenenler, eklenen yazı/afiş/kayan yazı); vitrin ve son talepler görünür mü
  homeBlocks: HomeBlock[];
  // Logonun yanında yazan ad (yönetim → Ayarlar)
  siteName: string;
  // Alt bilgi (yönetim → Alt Bilgi ve Sayfalar)
  footer: Footer;
  // Ödeme bölümleri yönetimden gizlenebilir: Güvenli Al; kredi ve mağaza.
  showSafe: boolean;
  showCredits: boolean;
  homeVitrin: boolean;
  homeLatest: boolean;
  refresh: () => Promise<void>;
  toast: (msg: string) => void;
};

const SessionCtx = createContext<Ctx>({ user: null, ready: false, categories: [], browseCategories: [], count: () => null, launchMode: false, phoneRequired: false, publishSms: false, photoRequired: false, homeUrgentBox: false, homeBlocks: [], siteName: "almakisterim.com", footer: DEFAULT_FOOTER, showSafe: true, showCredits: true, homeVitrin: true, homeLatest: true, refresh: async () => {}, toast: () => {} });
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children, site }: { children: React.ReactNode; site?: SiteData | null }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<CategoryTop[]>(site?.categories ?? []);
  const [browse, setBrowse] = useState<Browse>(site?.browse ?? { min_requests: 1, show_counts_min: 0 });
  const [launchMode, setLaunchMode] = useState(!!site?.launch_mode);
  const [phoneRequired, setPhoneRequired] = useState(!!site?.phone_required);
  const [publishSms, setPublishSms] = useState(!!site?.publish_sms);
  const [photoRequired, setPhotoRequired] = useState(!!site?.photo_required);
  const [homeUrgentBox, setHomeUrgentBox] = useState(!!site?.home_urgent_box);
  const [homeBlocks, setHomeBlocks] = useState<HomeBlock[]>(site?.home_blocks ?? []);
  const [siteName, setSiteName] = useState(site?.site_name || "almakisterim.com");
  const [footer, setFooter] = useState<Footer>(site?.footer ?? DEFAULT_FOOTER);
  const [showSafe, setShowSafe] = useState(site?.show_safe !== false);
  const [showCredits, setShowCredits] = useState(site?.show_credits !== false);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  const refresh = useCallback(async () => {
    const [me, cats] = await Promise.all([
      api<{ user: User | null }>("/me").catch(() => ({ user: null })),
      api<SiteData>("/categories").catch(() => ({ categories: [] as CategoryTop[], browse: undefined, launch_mode: false, phone_required: false, publish_sms: false, photo_required: false, home_urgent_box: false, home_blocks: [] as HomeBlock[], site_name: undefined, footer: undefined, show_safe: true, show_credits: true })),
    ]);
    setUser(me.user);
    setCategories(cats.categories);
    if (cats.browse) setBrowse(cats.browse);
    setLaunchMode(!!cats.launch_mode);
    setPhoneRequired(!!cats.phone_required);
    setPublishSms(!!cats.publish_sms);
    setPhotoRequired(!!cats.photo_required);
    setHomeUrgentBox(!!cats.home_urgent_box);
    setHomeBlocks(cats.home_blocks ?? []);
    if (cats.site_name) setSiteName(cats.site_name);
    if (cats.footer) setFooter(cats.footer);
    setShowSafe(cats.show_safe !== false);
    setShowCredits(cats.show_credits !== false);
    setReady(true);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const browseCategories = useMemo(() => categories
    .filter((t) => t.active_count >= Math.max(1, browse.min_requests))
    .map((t) => ({ ...t, subs: t.subs.filter((x) => x.active_count >= Math.max(1, browse.min_requests)) })), [categories, browse.min_requests]);
  const count = useCallback((n: number | undefined | null) => (n != null && n >= browse.show_counts_min ? n : null), [browse.show_counts_min]);

  return (
    <SessionCtx.Provider value={{ user, ready, categories, browseCategories, count, launchMode, phoneRequired, publishSms, photoRequired, homeUrgentBox, homeBlocks, siteName, footer, showSafe, showCredits, homeVitrin: !isHidden(homeBlocks, "vitrin"), homeLatest: !isHidden(homeBlocks, "latest"), refresh, toast }}>
      {children}
      <TermsGate />
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}</div>
    </SessionCtx.Provider>
  );
}
