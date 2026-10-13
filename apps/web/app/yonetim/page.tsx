"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Thumbs } from "@/components/Media";
import { useSession } from "@/components/Session";
import { AdsAdmin } from "@/components/AdsAdmin";
import { api, type Media, type CategoryTop } from "@/lib/api";
import { dateTr } from "@/lib/format";

type Stats = { users: number; active_requests: number; pending_review: number; offers: number; deals: number; reports: number };
type Pending = { id: number; title: string; description: string; moderation_note: string | null; created_at: string; buyer_name: string; media: Media[] };
type Report = { id: number; request_id: number; reason: string; created_at: string; title: string; status: string };
type UnlockStats = { summary: { today: number; month: number; month_credits: number; month_free: number; refunded_credits: number }; by_top: { id: string; name: string; unlocks: number; credits: number }[] };
type ContactReport = { id: number; side: "seller" | "buyer"; reason_text: string; note: string; status: string; created_at: string; credits: number; request_id: number; title: string;
  seller_name: string; seller_phone: string | null; buyer_name: string; buyer_phone: string | null; seller_complaints: number; buyer_complaints: number };
type UserRow = { id: string; name: string; email: string | null; phone: string | null; role: string; credits: number; created_at: string };

export default function Admin() {
  const { user, ready, refresh, toast } = useSession();
  const [tab, setTab] = useState<"kat" | "den" | "num" | "kul" | "rek" | "ayar">("kat");
  const [unl, setUnl] = useState<UnlockStats | null>(null);
  const [creps, setCreps] = useState<ContactReport[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [cats, setCats] = useState<CategoryTop[]>([]);
  const [mod, setMod] = useState<{ pending: Pending[]; reports: Report[] } | null>(null);
  const [settings, setSettings] = useState<{ phone_required?: boolean; launch_mode?: boolean; browse_min_requests?: number; show_counts_min?: number; unlock_price_tiers?: { max_budget: number | null; credits: number }[]; max_active_requests_per_user?: number; free_unlocks_per_month?: number; unlock_price_credits?: number; unlock_limit_per_request?: number; unlock_price_by_top?: Record<string, number>; store_monthly_price_try?: number } | null>(null);
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);

  const load = useCallback(async () => {
    const [s, c, m, st] = await Promise.all([
      api<Stats>("/admin/stats"), api<{ categories: CategoryTop[] }>("/admin/categories"),
      api<{ pending: Pending[]; reports: Report[] }>("/admin/moderation"), api<typeof settings>("/admin/settings"),
    ]);
    setStats(s); setCats(c.categories); setMod(m); setSettings(st);
    const [u, cr] = await Promise.all([api<UnlockStats>("/admin/unlocks"), api<{ items: ContactReport[] }>("/admin/contact-reports")]);
    setUnl(u); setCreps(cr.items);
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
  const resolveReport = async (id: number, action: "refund" | "reject" | "resolve") => {
    try { const r = await api<{ refunded_credits: number }>(`/admin/contact-reports/${id}/resolve`, { body: { action } }); toast(action === "refund" ? `${r.refunded_credits} kredi iade edildi.` : "Bildirim kapatıldı."); void load(); }
    catch (e) { toast((e as Error).message); }
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
        <div className="kpi"><small>Bugüne kadar açılan iletişim</small><b>{unl ? unl.summary.month : "–"}</b></div>
        <div className="kpi"><small>Üye</small><b>{stats?.users ?? "–"}</b></div>
        <div className="kpi"><small>İnceleme bekleyen</small><b style={{ color: stats?.pending_review ? "var(--red)" : undefined }}>{stats?.pending_review ?? "–"}</b></div>
      </div>
      <div className="res-bar" style={{ borderBottom: "1px solid var(--line)", borderRadius: 4, marginBottom: 14 }}><div className="tabs">
        <button className={tab === "kat" ? "on" : ""} onClick={() => setTab("kat")}>Kategoriler</button>
        <button className={tab === "den" ? "on" : ""} onClick={() => setTab("den")}>İçerik Denetimi ({(mod?.pending.length ?? 0) + (mod?.reports.length ?? 0)})</button>
        <button className={tab === "num" ? "on" : ""} onClick={() => setTab("num")}>Numaralar ve Şikâyetler ({creps.length})</button>
        <button className={tab === "kul" ? "on" : ""} onClick={() => setTab("kul")}>Kullanıcılar ve Kredi</button>
        <button className={tab === "rek" ? "on" : ""} onClick={() => setTab("rek")}>Reklam Alanları</button>
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
              {mod.pending.map((p) => <tr key={p.id}><td><Link className="ti-t" href={`/talep/${p.id}`}>{p.title}</Link><div className="ti-s">{p.buyer_name} · {dateTr(p.created_at)}</div><Thumbs media={p.media} /></td><td data-m="Not"><span className="lbl l-am" style={{ whiteSpace: "normal" }}>{p.moderation_note || "—"}</span></td>
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

      {tab === "num" && unl && (
        <>
          <div className="kpis">
            <div className="kpi"><small>Bugün açılan numara</small><b>{unl.summary.today}</b></div>
            <div className="kpi"><small>Bu ay açılan</small><b>{unl.summary.month}</b></div>
            <div className="kpi"><small>Bu ay harcanan kredi</small><b>{unl.summary.month_credits}</b></div>
            <div className="kpi"><small>Ücretsiz haktan</small><b>{unl.summary.month_free}</b></div>
            <div className="kpi"><small>Bu ay iade</small><b>{unl.summary.refunded_credits} kredi</b></div>
          </div>
          <div className="box" style={{ marginBottom: 14 }}><div className="box-h"><h2>Kategorilere göre (bu ay)</h2></div>
            {unl.by_top.length ? <table className="tbl"><thead><tr><th>Kategori</th><th className="r">Açılan numara</th><th className="r">Kredi</th></tr></thead><tbody>
              {unl.by_top.map((t) => <tr key={t.id}><td>{t.name}</td><td className="r">{t.unlocks}</td><td className="r">{t.credits}</td></tr>)}
            </tbody></table> : <div className="empty">Bu ay henüz numara açılmadı.</div>}
          </div>
          <div className="box"><div className="box-h"><h2>Açık bildirim ve şikâyetler</h2></div>
            {creps.length ? <table className="tbl"><thead><tr><th>Bildirim</th><th>Satıcı</th><th>Alıcı</th><th></th></tr></thead><tbody>
              {creps.map((r) => <tr key={r.id}>
                <td><span className={"lbl " + (r.side === "buyer" ? "l-acil" : "l-am")}>{r.side === "buyer" ? "Alıcı şikâyeti" : "Satıcı bildirimi"}</span> <b>{r.reason_text}</b>
                  <div className="ti-s"><Link className="link" href={`/talep/${r.request_id}`}>{r.title}</Link> · {dateTr(r.created_at)}{r.side === "seller" && <> · {r.credits} kredi ödendi</>}</div>{r.note && <div className="o-note">{r.note}</div>}</td>
                <td data-m="Satıcı">{r.seller_name}<div className="ti-s">{r.seller_phone}{r.seller_complaints > 0 && <> · <b style={{ color: "var(--red)" }}>{r.seller_complaints} şikâyet</b></>}</div></td>
                <td data-m="Alıcı">{r.buyer_name}<div className="ti-s">{r.buyer_phone}{r.buyer_complaints > 0 && <> · <b style={{ color: "var(--red)" }}>{r.buyer_complaints} bildirim</b></>}</div></td>
                <td className="r act-cell nowrap">
                  {r.side === "seller" && <button className="btn btn-bl btn-sm" onClick={() => resolveReport(r.id, "refund")}>İade et</button>}{" "}
                  <button className="btn btn-wh btn-sm" onClick={() => resolveReport(r.id, r.side === "seller" ? "reject" : "resolve")}>{r.side === "seller" ? "Reddet" : "İncelendi"}</button>
                </td>
              </tr>)}
            </tbody></table> : <div className="empty">Açık bildirim yok.</div>}
          </div>
        </>
      )}

      {tab === "rek" && <AdsAdmin />}

      {tab === "ayar" && settings && (
        <div className="box"><div className="box-h"><h2>Ayarlar</h2></div><div className="box-b">
          <div className="form-grid" style={{ maxWidth: 560 }}>
            <div className="fg"><label htmlFor="s-price">Numara görme ücreti (kredi)</label><input className="inp" id="s-price" type="number" min={0} value={settings.unlock_price_credits ?? 1} onChange={(e) => setSettings({ ...settings, unlock_price_credits: Number(e.target.value) })} /><span className="hint">Kategoriye özel fiyat girilmemişse bu kullanılır.</span></div>
            <div className="fg"><label htmlFor="s-limit">Bir talepte en fazla kaç satıcı</label><input className="inp" id="s-limit" type="number" min={0} value={settings.unlock_limit_per_request ?? 10} onChange={(e) => setSettings({ ...settings, unlock_limit_per_request: Number(e.target.value) })} /><span className="hint">0 = sınırsız.</span></div>
            <div className="fg"><label htmlFor="s-free">Aylık ücretsiz numara hakkı</label><input className="inp" id="s-free" type="number" min={0} value={settings.free_unlocks_per_month ?? 0} onChange={(e) => setSettings({ ...settings, free_unlocks_per_month: Number(e.target.value) })} /></div>
            <div className="fg full"><label className="chk" style={{ fontWeight: 600 }}><input type="checkbox" checked={!!settings.phone_required} onChange={(e) => setSettings({ ...settings, phone_required: e.target.checked })} />Telefon doğrulaması zorunlu</label><span className="hint">Kapalıyken alıcı telefonsuz talep verebilir, satıcı telefonsuz numara açabilir; telefonu olmayan alıcıya satıcılar ücretsiz mesaj gönderir. SMS sağlayıcısı bağlanınca açın.</span></div>
            <div className="fg full"><label className="chk" style={{ fontWeight: 600 }}><input type="checkbox" checked={!!settings.launch_mode} onChange={(e) => setSettings({ ...settings, launch_mode: e.target.checked })} />Lansman dönemi: numara görmek herkese ücretsiz</label><span className="hint">Başlangıçta satıcı çekmek için açık tutun. Kapatınca aşağıdaki ücretler geçerli olur.</span></div>
            <div className="fg"><label htmlFor="s-bmin">Menüde görünmesi için en az talep</label><input className="inp" id="s-bmin" type="number" min={1} value={settings.browse_min_requests ?? 1} onChange={(e) => setSettings({ ...settings, browse_min_requests: Number(e.target.value) })} /><span className="hint">Bundan az açık talebi olan kategoriler gezinirken gizlenir; talep verirken hepsi görünür.</span></div>
            <div className="fg"><label htmlFor="s-cmin">Sayaçları göstermek için en az</label><input className="inp" id="s-cmin" type="number" min={0} value={settings.show_counts_min ?? 20} onChange={(e) => setSettings({ ...settings, show_counts_min: Number(e.target.value) })} /><span className="hint">"Tüm talepler (3)" gibi küçük sayılar site boş görünmesin diye gizlenir.</span></div>
            <div className="fg"><label htmlFor="s-active">Kişi başı en fazla açık talep</label><input className="inp" id="s-active" type="number" min={0} value={settings.max_active_requests_per_user ?? 5} onChange={(e) => setSettings({ ...settings, max_active_requests_per_user: Number(e.target.value) })} /><span className="hint">Sahte taleplere karşı. 0 = sınırsız.</span></div>
            <div className="fg full"><label>Bütçeye göre numara ücreti</label>
              <table className="tbl tiers"><thead><tr><th>Talebin en fazla bütçesi (TL)</th><th>Kredi</th><th></th></tr></thead><tbody>
                {(settings.unlock_price_tiers ?? []).map((t, i, arr) => (
                  <tr key={i}>
                    <td>{t.max_budget === null ? <span className="muted">ve üzeri</span> : <input className="inp" type="number" min={1} aria-label={`${i + 1}. kademe bütçe sınırı`} value={t.max_budget} onChange={(e) => setSettings({ ...settings, unlock_price_tiers: arr.map((x, k) => (k === i ? { ...x, max_budget: Number(e.target.value) } : x)) })} />}</td>
                    <td><input className="inp" type="number" min={0} aria-label={`${i + 1}. kademe kredi`} value={t.credits} onChange={(e) => setSettings({ ...settings, unlock_price_tiers: arr.map((x, k) => (k === i ? { ...x, credits: Number(e.target.value) } : x)) })} /></td>
                    <td className="r">{t.max_budget !== null && <button className="link" onClick={() => setSettings({ ...settings, unlock_price_tiers: arr.filter((_, k) => k !== i) })}>Sil</button>}</td>
                  </tr>
                ))}
              </tbody></table>
              <button className="link" style={{ marginTop: 6 }} onClick={() => { const arr = settings.unlock_price_tiers ?? []; const top = arr.find((t) => t.max_budget === null) ?? { max_budget: null, credits: settings.unlock_price_credits ?? 1 }; const rest = arr.filter((t) => t.max_budget !== null); const last = rest.at(-1)?.max_budget ?? 0; setSettings({ ...settings, unlock_price_tiers: [...rest, { max_budget: last ? last * 10 : 10000, credits: top.credits }, top] }); }}>+ Kademe ekle</button>
              <span className="hint">Kategoriye özel ücret girilirse o kategoride kademe yerine o ücret kullanılır.</span>
            </div>
            <div className="fg full"><label>Kategoriye özel numara ücreti (kredi)</label>
              <div className="form-grid">{cats.map((t) => (
                <div className="fg" key={t.id}><label htmlFor={`s-top-${t.id}`} style={{ fontWeight: 500 }}>{t.name}</label>
                  <input className="inp" id={`s-top-${t.id}`} type="number" min={0} placeholder={`Varsayılan (${settings.unlock_price_credits ?? 1})`} value={settings.unlock_price_by_top?.[t.id] ?? ""}
                    onChange={(e) => { const m = { ...(settings.unlock_price_by_top ?? {}) }; if (e.target.value === "") delete m[t.id]; else m[t.id] = Number(e.target.value); setSettings({ ...settings, unlock_price_by_top: m }); }} /></div>
              ))}</div>
            </div>
            <div className="fg"><label htmlFor="s-store">Mağaza üyeliği (TL / ay)</label><input className="inp" id="s-store" type="number" value={settings.store_monthly_price_try ?? 0} onChange={(e) => setSettings({ ...settings, store_monthly_price_try: Number(e.target.value) })} /></div>
          </div>
          <button className="btn btn-or" style={{ marginTop: 12 }} onClick={async () => { try { await api("/admin/settings", { method: "PUT", body: settings }); toast("Ayarlar kaydedildi."); } catch (e) { toast((e as Error).message); } }}>Kaydet</button>
        </div></div>
      )}
    </div>
  );
}
