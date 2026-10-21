import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, onSessionChange, setToken } from "./api";
import { pushToken, registerPush } from "./push";
import type { User } from "./types";

type S = { user: User | null; ready: boolean; refresh: () => Promise<void>; signIn: (token: string) => Promise<void>; signOut: () => Promise<void> };
const Ctx = createContext<S>({ user: null, ready: false, refresh: async () => {}, signIn: async () => {}, signOut: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    if (!(await getToken())) { setUser(null); setReady(true); return; }
    try { setUser((await api<{ user: User | null }>("/me")).user); } catch { /* bağlantı yoksa eski bilgi kalır */ }
    setReady(true);
  }, []);
  useEffect(() => { void refresh(); return onSessionChange(() => void refresh()); }, [refresh]);
  // Giriş yapılınca telefonun bildirim adresi kaydedilir (izin ilk girişte sorulur).
  useEffect(() => { if (user) void registerPush(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (t: string) => { await setToken(t); }, []);
  const signOut = useCallback(async () => {
    try { await api("/auth/logout", { body: { push_token: pushToken() ?? undefined } }); } catch { /* yine de çıkılır */ }
    await setToken(null);
  }, []);
  return <Ctx.Provider value={{ user, ready, refresh, signIn, signOut }}>{children}</Ctx.Provider>;
}
export const useSession = () => useContext(Ctx);
