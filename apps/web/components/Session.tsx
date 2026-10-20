"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, type CategoryTop, type User } from "@/lib/api";

type Browse = { min_requests: number; show_counts_min: number };

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
  photoRequired: boolean;
  homeUrgentBox: boolean;
  // Ana sayfadaki vitrin ve son talepler bölümleri (yönetici gizleyebilir).
  homeVitrin: boolean;
  homeLatest: boolean;
  // Ana sayfa bölümlerinin sırası ve gizlenenler
  homeOrder: string[];
  homeHidden: string[];
  refresh: () => Promise<void>;
  toast: (msg: string) => void;
};

const SessionCtx = createContext<Ctx>({ user: null, ready: false, categories: [], browseCategories: [], count: () => null, launchMode: false, phoneRequired: false, photoRequired: false, homeUrgentBox: false, homeVitrin: true, homeLatest: true, homeOrder: [], homeHidden: [], refresh: async () => {}, toast: () => {} });
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<CategoryTop[]>([]);
  const [browse, setBrowse] = useState<Browse>({ min_requests: 1, show_counts_min: 0 });
  const [launchMode, setLaunchMode] = useState(false);
  const [phoneRequired, setPhoneRequired] = useState(false);
  const [photoRequired, setPhotoRequired] = useState(false);
  const [homeUrgentBox, setHomeUrgentBox] = useState(false);
  const [homeVitrin, setHomeVitrin] = useState(true);
  const [homeLatest, setHomeLatest] = useState(true);
  const [homeOrder, setHomeOrder] = useState<string[]>([]);
  const [homeHidden, setHomeHidden] = useState<string[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  const refresh = useCallback(async () => {
    const [me, cats] = await Promise.all([
      api<{ user: User | null }>("/me").catch(() => ({ user: null })),
      api<{ categories: CategoryTop[]; browse?: Browse; launch_mode?: boolean; phone_required?: boolean; photo_required?: boolean; home_urgent_box?: boolean; home_vitrin?: boolean; home_latest?: boolean; home_order?: string[]; home_hidden?: string[] }>("/categories").catch(() => ({ categories: [] as CategoryTop[], browse: undefined, launch_mode: false, phone_required: false, photo_required: false, home_urgent_box: false, home_vitrin: true, home_latest: true, home_order: [] as string[], home_hidden: [] as string[] })),
    ]);
    setUser(me.user);
    setCategories(cats.categories);
    if (cats.browse) setBrowse(cats.browse);
    setLaunchMode(!!cats.launch_mode);
    setPhoneRequired(!!cats.phone_required);
    setPhotoRequired(!!cats.photo_required);
    setHomeUrgentBox(!!cats.home_urgent_box);
    setHomeVitrin(cats.home_vitrin !== false);
    setHomeLatest(cats.home_latest !== false);
    setHomeOrder(cats.home_order ?? []);
    setHomeHidden(cats.home_hidden ?? []);
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
    <SessionCtx.Provider value={{ user, ready, categories, browseCategories, count, launchMode, phoneRequired, photoRequired, homeUrgentBox, homeVitrin, homeLatest, homeOrder, homeHidden, refresh, toast }}>
      {children}
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}</div>
    </SessionCtx.Provider>
  );
}
