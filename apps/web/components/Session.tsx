"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, type CategoryTop, type User } from "@/lib/api";

type Ctx = {
  user: User | null;
  ready: boolean;
  categories: CategoryTop[];
  refresh: () => Promise<void>;
  toast: (msg: string) => void;
};

const SessionCtx = createContext<Ctx>({ user: null, ready: false, categories: [], refresh: async () => {}, toast: () => {} });
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<CategoryTop[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  const refresh = useCallback(async () => {
    const [me, cats] = await Promise.all([
      api<{ user: User | null }>("/me").catch(() => ({ user: null })),
      api<{ categories: CategoryTop[] }>("/categories").catch(() => ({ categories: [] })),
    ]);
    setUser(me.user);
    setCategories(cats.categories);
    setReady(true);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  return (
    <SessionCtx.Provider value={{ user, ready, categories, refresh, toast }}>
      {children}
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}</div>
    </SessionCtx.Provider>
  );
}
