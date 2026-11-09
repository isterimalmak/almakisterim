"use client";

import { Fragment, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/components/Session";
import { fmt } from "@/lib/format";

type Session = { visitor: string; name: string | null; email: string | null; phone: string | null; member: boolean; first_at: string; last_at: string;
  views: number; total_ms: number; entry: string; exit: string; device: string; ref: string };
type Data = {
  summary: { visitors: number; members: number; views: number; logins: number; avg_ms: number | null };
  pages: { path: string; views: number; visitors: number; avg_ms: number | null }[];
  sessions: Session[];
  logins: { created_at: string; name: string; email: string | null; phone: string | null }[];
};
type Step = { id: number; path: string; created_at: string; duration_ms: number | null };

const time = (iso: string) => new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dur = (ms: number | null) => {
  if (ms == null) return "–";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} sn` : s < 3600 ? `${Math.floor(s / 60)} dk ${s % 60} sn` : `${Math.floor(s / 3600)} sa ${Math.floor((s % 3600) / 60)} dk`;
};
const who = (x: { name: string | null; email: string | null; phone: string | null }) => [x.email, x.phone].filter(Boolean).join(" · ");

// Yönetim → Ziyaretçiler: kim giriş yaptı, hangi sayfalara girdi, ne kadar kaldı, nereden çıktı.
export function VisitsAdmin() {
  const { toast } = useSession();
  const [days, setDays] = useState(1);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [d, setD] = useState<Data | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  useEffect(() => {
    void api<Data>(`/admin/visits?days=${days}&q=${encodeURIComponent(term)}`).then(setD).catch((e) => toast((e as Error).message));
  }, [days, term]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = async (v: string) => {
    if (open === v) { setOpen(null); return; }
    setOpen(v); setSteps([]);
    try { setSteps((await api<{ items: Step[] }>(`/admin/visits/${v}?days=${days}`)).items); } catch (e) { toast((e as Error).message); }
  };
  const s = d?.summary;
  return (
    <section aria-label="Ziyaretçiler">
      <div className="box-h" style={{ marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <div className="seg" role="group" aria-label="Dönem">{[[1, "Bugün (24 saat)"], [7, "Son 7 gün"], [30, "Son 30 gün"], [90, "Son 90 gün"]].map(([n, l]) =>
          <button key={n} type="button" className={days === n ? "on" : ""} aria-pressed={days === n} onClick={() => setDays(n as number)}>{l}</button>)}</div>
        <form style={{ display: "flex", gap: 6 }} onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
          <input className="inp" aria-label="Üye ara" placeholder="Üye adı, e-posta ya da telefon" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
          <button className="btn" type="submit">Ara</button>
          {term && <button className="btn" type="button" onClick={() => { setQ(""); setTerm(""); }}>Temizle</button>}
        </form>
      </div>
      <div className="lp-stats">
        <div><b>{s ? fmt(s.visitors) : "–"}</b><small>ziyaretçi</small></div>
        <div><b>{s ? fmt(s.members) : "–"}</b><small>giriş yapmış üye gezdi</small></div>
        <div><b>{s ? fmt(s.views) : "–"}</b><small>sayfa görüntüleme</small></div>
        <div><b>{s ? fmt(s.logins) : "–"}</b><small>giriş (oturum açma)</small></div>
        <div><b>{s ? dur(s.avg_ms) : "–"}</b><small>sayfada ortalama süre</small></div>
      </div>
      <p className="muted" style={{ fontSize: 12.5 }}>Sayfa gezintisi yalnız çerez kutusunda "Kabul et" diyen ziyaretçiler için kaydedilir; girişler her zaman kaydedilir. Kayıtlar 90 gün saklanır, üye hesabını silerse silinir.</p>

      <div className="box" style={{ marginBottom: 12 }}>
        <div className="box-h"><h3>Ziyaretçiler ve gezdikleri sayfalar</h3></div>
        {d?.sessions.length ? (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Kim</th><th>Giriş sayfası</th><th>Çıkış sayfası</th><th className="r">Sayfa</th><th className="r">Süre</th><th>Cihaz</th><th>Geldiği yer</th><th>Son görülme</th></tr></thead>
              <tbody>
                {d.sessions.map((x) => (
                  <Fragment key={x.visitor}>
                    <tr className="row" onClick={() => void toggle(x.visitor)} aria-expanded={open === x.visitor}>
                      <td>{x.member ? <><b>{x.name}</b><br /><small className="muted">{who(x)}</small></> : <span className="muted">Üye değil · {x.visitor.slice(0, 6)}</span>}</td>
                      <td>{x.entry}</td><td>{x.exit}</td>
                      <td className="r">{fmt(x.views)}</td><td className="r">{dur(x.total_ms)}</td>
                      <td>{x.device === "mobil" ? "Telefon" : x.device === "masaustu" ? "Bilgisayar" : "–"}</td>
                      <td>{x.ref || "Doğrudan"}</td><td>{time(x.last_at)}</td>
                    </tr>
                    {open === x.visitor && (
                      <tr><td colSpan={8} style={{ background: "#FAFBFC" }}>
                        {steps.length ? <ol style={{ margin: 0, paddingLeft: 20 }} aria-label="Gezdiği sayfalar">
                          {steps.map((st) => <li key={st.id}>{time(st.created_at)} · <b>{st.path}</b> · {st.duration_ms == null ? "süre bilinmiyor" : dur(st.duration_ms)}</li>)}
                        </ol> : "Yükleniyor…"}
                      </td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">{d ? "Bu dönemde kayıtlı ziyaret yok." : "Yükleniyor…"}</div>}
      </div>

      <div className="box" style={{ marginBottom: 12 }}>
        <div className="box-h"><h3>Son girişler</h3></div>
        {d?.logins.length ? (
          <table className="tbl"><tbody>{d.logins.map((x, i) => <tr key={i}><td><b>{x.name}</b> <small className="muted">{who(x)}</small></td><td style={{ width: 130 }}>{time(x.created_at)}</td></tr>)}</tbody></table>
        ) : <div className="empty">Bu dönemde giriş yok.</div>}
      </div>

      <div className="box">
        <div className="box-h"><h3>En çok girilen sayfalar</h3></div>
        {d?.pages.length ? (
          <table className="tbl">
            <thead><tr><th>Sayfa</th><th className="r">Görüntüleme</th><th className="r">Ziyaretçi</th><th className="r">Ort. süre</th></tr></thead>
            <tbody>{d.pages.map((p) => <tr key={p.path}><td>{p.path}</td><td className="r">{fmt(p.views)}</td><td className="r">{fmt(p.visitors)}</td><td className="r">{dur(p.avg_ms)}</td></tr>)}</tbody>
          </table>
        ) : <div className="empty">Henüz yok.</div>}
      </div>
    </section>
  );
}
