"use client";

// E-posta Stüdyosu (Marka Bahçem'den alındı) için küçük uyum katmanı: oradaki api.admin.mail istemcisi, useApp (toast/fail/user),
// Modal, Skeleton, Img, Empty, PTop, useLoad, dateTime ve uploadFile burada almakisterim'in kendi araçlarıyla karşılanır.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api as call, uploadFile as upload } from "@/lib/api";
import { useSession } from "@/components/Session";
import type { MailAudience, MailHome, MailRuleInput, MailSend, MailTemplate } from "@/lib/mail";

type Ok = { ok: true };
type Draft = Omit<MailTemplate, "id" | "updatedAt" | "uses">;
const qs = (o: Record<string, string | number | undefined>) => {
  const p = Object.entries(o).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return p.length ? "?" + p.join("&") : "";
};
const get = <T,>(p: string) => call<T>(p);
const post = <T,>(p: string, body: unknown = {}) => call<T>(p, { method: "POST", body });
const put = <T,>(p: string, body: unknown) => call<T>(p, { method: "PUT", body });
const patch = <T,>(p: string, body: unknown) => call<T>(p, { method: "PATCH", body });
const del = <T,>(p: string) => call<T>(p, { method: "DELETE" });

export const api = {
  admin: {
    mail: {
      home: () => get<MailHome>("/admin/mail"),
      template: (id: number) => get<{ template: MailTemplate }>(`/admin/mail/templates/${id}`),
      createTemplate: (b: { starter?: string; copyOf?: number; name?: string }) => post<{ id: number }>("/admin/mail/templates", b),
      saveTemplate: (id: number, t: Draft) => put<{ template: MailTemplate }>(`/admin/mail/templates/${id}`, t),
      deleteTemplate: (id: number) => del<Ok>(`/admin/mail/templates/${id}`),
      render: (t: Draft) => post<{ subject: string; html: string }>("/admin/mail/render", t),
      test: (id: number, to?: string, test = true) => post<{ ok: true; to: string; ready: boolean }>(`/admin/mail/templates/${id}/test`, { ...(to ? { to } : {}), test }),
      audience: (audience: MailAudience, kind: "info" | "marketing") => get<{ count: number; total: number }>("/admin/mail/audience" + qs({ audience, kind })),
      createRule: (b: MailRuleInput) => post<{ id: number }>("/admin/mail/rules", b),
      updateRule: (id: number, b: Partial<MailRuleInput>) => patch<Ok>(`/admin/mail/rules/${id}`, b),
      deleteRule: (id: number) => del<Ok>(`/admin/mail/rules/${id}`),
      sends: (q: { rule?: number; status?: string } = {}) => get<{ sends: MailSend[] }>("/admin/mail/sends" + qs(q)),
      cancelSend: (id: number) => del<Ok>(`/admin/mail/sends/${id}`),
    },
  },
};

/** Marka Bahçem'deki useApp: toast, fail (hatayı bildirir) ve oturumdaki kullanıcı */
export function useApp() {
  const { user, toast } = useSession();
  const fail = useCallback((e: unknown) => toast(e instanceof Error ? e.message : "Bir sorun oluştu, lütfen tekrar deneyin."), [toast]);
  return { user, toast, fail };
}

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => { setLoading(true); try { setData(await fn()); setError(null); } catch (e) { setError(e); } finally { setLoading(false); } }, deps);
  useEffect(() => { void load(); }, [load]);
  return { data, setData, error, loading, reload: load };
}

export const dateTime = (d: string | Date) => new Date(d).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Görsel yükler, herkese açık adresini döndürür (almakisterim'in R2 yükleyicisiyle) */
export async function uploadFile(file: File, _purpose: "cover"): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Yalnızca JPG, PNG veya WEBP görsel yüklenebilir.");
  const m = await upload(file, () => {});
  // Önizleme ve e-posta mutlak adres ister; yerel depoda adres /api/… ile başlar (çizici site adresini önüne ekler).
  return m.url;
}

const PALETTE: [string, string][] = [["#EAF0FC", "#C9D7F5"], ["#FFF1E8", "#FBD3B8"], ["#E7F5EE", "#BFE3CF"], ["#F3F5F9", "#DADDE2"]];
export function Img({ src, alt = "", emoji = "📋", seed = 0 }: { src?: string | null; alt?: string; emoji?: string; seed?: number }) {
  if (src) return <div className="pimg has-img"><img src={src} alt={alt} loading="lazy" /></div>;
  const [c1, c2] = PALETTE[Math.abs(seed) % PALETTE.length]!;
  return <div className="pimg" style={{ background: `linear-gradient(145deg,${c1},${c2})` }} role="img" aria-label={alt}><span className="em">{emoji}</span></div>;
}

export function Empty({ icon, title, text, children }: { icon: string; title: string; text?: ReactNode; children?: ReactNode }) {
  return <div className="empty"><div className="ei">{icon}</div><h3>{title}</h3>{text ? <p>{text}</p> : null}{children}</div>;
}

export function Modal({ title, onClose, children, footer, wide = false }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true">
        <div className="modal-h"><h3 style={{ margin: 0 }}>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Kapat">✕</button></div>
        <div className="modal-b">{children}</div>
        {footer ? <div className="modal-f">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Skeleton({ h = 18, w = "100%", r = 8 }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}

export function PTop({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return <div className="ptop"><div><h1>{title}</h1>{sub ? <div className="sub">{sub}</div> : null}</div><div className="row">{actions}</div></div>;
}
