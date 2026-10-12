"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useSession } from "@/components/Session";
import { api, type CategoryTop } from "@/lib/api";
import { dateTr } from "@/lib/format";

type Stats = { users: number; active_requests: number; pending_review: number; offers: number; deals: number; reports: number };
type Pending = { id: number; title: string; description: string; moderation_note: string | null; created_at: string; buyer_name: string };
type Report = { id: number; request_id: number; reason: string; created_at: string; title: string; status: string };
type UserRow = { id: string; name: string; email: string | null; phone: string | null; role: string; credits: number; created_at: string };

export default function Admin() {
  const { user, ready, refresh, toast } = useSession();
  const [tab, setTab] = useState<"kat" | "den" | "kul" | "ayar">("kat");
  const [stats, setStats] = useState<Stats | null>(null);
  const [cats, setCats] = useState<CategoryTop[]>([]);
  const [mod, setMod] = useState<{ pending: Pending[]; reports: Report[] } | null>(null);
  const [settings, setSettings] = useState<{ free_offers_per_month?: number; store_monthly_price_try?: number } | null>(null);
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);

  const load = useCallback(async () => {
    const [s, c, m, st] = await Promise.all([
      api<Stats>("/admin/stats"), api<{ categories: CategoryTop[] }>("/admin/categories"),
      api<{ pending: Pending[]; reports: Report[] }>("/admin/moderation"), api<typeof settings>("/admin/settings"),
    ]);
    setStats(s); setCats(c.categories); setMod(m); setSettings(st);
  }, []);
  useEffect(() => { if (user?.role === "admin") void load().catch((e) => toast(e.message)); }, [user, load, toast]);

  if (!ready) return <div className="loading">Yükleniyor…</div>;
  if (user?.role !== "admin") return <div className="wrap" style={{ padding: "30px 16px" }}><div className="box"><div className="empty">Bu sayfa yalnızca yöneticiler içindir. <Link className="link" href="/giris?sonra=/yonetim">Yönetici hesabıyla giriş yapın</Link>.</div></div></div>;

  const toggle = async (id: string, v: boolean) => {
    await api(`/admin/categories/${id}`, { method: "PATCH", body: { is_visible: v } });
    toast(v ? "Yayına alındı." : "Gizlendi.");
    await Promise.all([load(), refresh()]);
  };
  const act = async (id: number, action: "approve" | "reject" | "remove") => {
    await api(`/admin/requests/${id}/${action}`, { body: {} });
    toast(action === "approve" ? "Talep onaylandı ve yayına alındı." : "Talep yayından kaldırıldı.");
    void load();
  };
  const searchUsers = async () => setUsers((await api<{ items: UserRow[] }>(`/admin/users?q=${encodeURIComponent(q)}`)).items);
  const credit = async (u: UserRow) => {
    const v = window.prompt(`${u.name || u.phone || u.email} için eklenecek kredi (eksi değer düşer):`, "10");
    if (!v || !Number(v)) return;
    try { const r = await api<{ credits: number }>(`/admin/users/${u.id}/credits`, { body: { delta: Math.round(Number(v)) } }); toast(`Yeni kredi: ${r.credits}`); void searchUsers(); }
    catch (e) { toast((e as Error).message); }
  };

  return (
    <div className="wrap" style={{ paddingBottom: 40 }}>
      <div className="crumb"><Link href="/">Ana Sayfa</Link> › Yönetim Paneli</div>
      <div className="list-head"><h1>Yönetim Paneli</h1></div>
      <div className="kpis">
        <div className="kpi"><small>Yayındaki talep</small><b>{stats?.active_requests ?? "–"}</b></div>
        <div className="kpi"><small>Toplam teklif / anlaşma</small><b>{stats ? `${stats.offers} / ${stats.deals}` : "–"}</b></div>
        <div className="kpi"><small>Üye</small><b>{stats?.users ?? "–"}</b></div>
        <div className="kpi"><small>İnceleme bekleyen</small><b style={{ color: stats?.pending_review ? "var(--red)" : undefined }}>{stats?.pending_review ?? "–"}</b></div>
      </div>
      <div className="res-bar" style={{ borderBottom: "1px solid var(--line)", borderRadius: 4, marginBottom: 14 }}><div className="tabs">
        <button className={tab === "kat" ? "on" : ""} onClick={() => setTab("kat")}>Kategoriler</button>
        <button className={tab === "den" ? "on" : ""} onClick={() => setTab("den")}>İçerik Denetimi ({(mod?.pending.length ?? 0) + (mod?.reports.length ?? 0)})</button>
        <button className={tab === "kul" ? "on" : ""} onClick={() => setTab("kul")}>Kullanıcılar ve Kredi</button>
        <button className={tab === "ayar" ? "on" : ""} onClick={() => setTab("ayar")}>Ayarlar</button>
      </div></div>

      {tab === "kat" && (
        <>
          <div className="note n-info" style={{ marginBottom: 12 }}><span>Kapattığınız kategori veya alt kategori sitenin hiçbir yerinde görünmez: menü, ana sayfa, arama ve talep verme. İçindeki talepler silinmez; tekrar açtığınızda geri gelir.</span></div>
          <div className="box adm-tree">
            <div className="trow hdr-r"><span>Kategori</span><span>Aktif talep</span><span className="c-st">Durum</span><span>Yayın</span></div>
            {cats.map((t) => (
              <div key={t.id}>
                <div className={"trow top" + (t.is_visible ? "" : " off")}><span className="nm"><Icon name={t.icon} size={18} />{t.name}</span><span>{t.active_count}</span><span className={"st c-st " + (t.is_visible ? "on" : "off")}>{t.is_visible ? "Yayında" : "Gizli"}</span><button className={"sw" + (t.is_visible ? " on" : "")} role="switch" aria-checked={t.is_visible} aria-label={t.name} onClick={() => toggle(t.id, !t.is_visible)} /></div>
                {t.subs.map((s) => {
                  const off = !t.is_visible || !s.is_visible;
                  return <div key={s.id} className={"trow sub" + (off ? " off" : "")}><span className="nm">{s.name}</span><span>{s.active_count}</span><span className={"st c-st " + (off ? "off" : "on")}>{!t.is_visible ? "Üst kategori gizli" : s.is_visible ? "Yayında" : "Gizli"}</span><button className={"sw" + (s.is_visible ? " on" : "")} role="switch" aria-checked={s.is_visible} aria-label={s.name} disabled={!t.is_visible} onClick={() => toggle(s.id, !s.is_visible)} /></div>;
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "den" && mod && (
        <>
          <div className="box" style={{ marginBottom: 14 }}><div className="box-h"><h2>İnceleme bekleyen talepler</h2></div>
            {mod.pending.length ? <table className="tbl"><thead><tr><th>Talep</th><th>Yapay zekâ notu</th><th></th></tr></thead><tbody>
              {mod.pending.map((p) => <tr key={p.id}><td><Link className="ti-t" href={`/talep/${p.id}`}>{p.title}</Link><div className="ti-s">{p.buyer_name} · {dateTr(p.created_at)}</div></td><td data-m="Not"><span className="lbl l-am" style={{ whiteSpace: "normal" }}>{p.moderation_note || "—"}</span></td>
                <td className="r act-cell nowrap"><button className="btn btn-wh btn-sm" onClick={() => act(p.id, "approve")}>Onayla</button> <button className="btn btn-bl btn-sm" onClick={() => act(p.id, "reject")}>Reddet</button></td></tr>)}
            </tbody></table> : <div className="empty">İnceleme bekleyen talep yok.</div>}
          </div>
          <div className="box"><div className="box-h"><h2>Şikayetler</h2></div>
            {mod.reports.length ? <table className="tbl"><thead><tr><th>Talep</th><th>Neden</th><th></th></tr></thead><tbody>
              {mod.reports.map((r) => <tr key={r.id}><td><Link className="ti-t" href={`/talep/${r.request_id}`}>{r.title}</Link><div className="ti-s">{dateTr(r.created_at)}</div></td><td data-m="Neden">{r.reason}</td>
                <td className="r act-cell">{r.status === "active" ? <button className="btn btn-bl btn-sm" onClick={() => act(r.request_id, "remove")}>Yayından kaldır</button> : <span className="muted">{r.status}</span>}</td></tr>)}
            </tbody></table> : <div className="empty">Şikayet yok.</div>}
          </div>
        </>
      )}

      {tab === "kul" && (
        <div className="box"><div className="box-h"><h2>Kullanıcılar</h2></div><div className="box-b">
          <form style={{ display: "flex", gap: 8, marginBottom: 12 }} onSubmit={(e) => { e.preventDefault(); void searchUsers(); }}><input className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ad, e-posta veya telefon" /><button className="btn btn-bl">Ara</button></form>
          {users.length ? <table className="tbl"><thead><tr><th>Kullanıcı</th><th>İletişim</th><th className="r">Kredi</th><th></th></tr></thead><tbody>
            {users.map((u) => <tr key={u.id}><td><b>{u.name || "—"}</b> {u.role === "admin" && <span className="lbl l-kur">Yönetici</span>}<div className="ti-s">{dateTr(u.created_at)}</div></td><td data-m="İletişim">{u.phone ?? u.email}</td><td data-m="Kredi" className="r">{u.credits}</td><td className="r act-cell"><button className="btn btn-wh btn-sm" onClick={() => credit(u)}>Kredi tanımla</button></td></tr>)}
          </tbody></table> : <div className="muted">Aramak için yazın.</div>}
        </div></div>
      )}

      {tab === "ayar" && settings && (
        <div className="box"><div className="box-h"><h2>Ayarlar</h2></div><div className="box-b">
          <div className="form-grid" style={{ maxWidth: 560 }}>
            <div className="fg"><label htmlFor="s-free">Aylık ücretsiz teklif hakkı</label><input className="inp" id="s-free" type="number" value={settings.free_offers_per_month ?? 0} onChange={(e) => setSettings({ ...settings, free_offers_per_month: Number(e.target.value) })} /></div>
            <div className="fg"><label htmlFor="s-store">Mağaza üyeliği (TL / ay)</label><input className="inp" id="s-store" type="number" value={settings.store_monthly_price_try ?? 0} onChange={(e) => setSettings({ ...settings, store_monthly_price_try: Number(e.target.value) })} /></div>
          </div>
          <button className="btn btn-or" style={{ marginTop: 12 }} onClick={async () => { try { await api("/admin/settings", { method: "PUT", body: settings }); toast("Ayarlar kaydedildi."); } catch (e) { toast((e as Error).message); } }}>Kaydet</button>
        </div></div>
      )}
    </div>
  );
}
