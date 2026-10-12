"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/Session";
import { api } from "@/lib/api";
import { CITIES } from "@/lib/catalog";
import { ago, budgetTxt, dateTr, fmt, initials } from "@/lib/format";

type Row = { id: number; title: string; status?: string; budget_min: number; budget_max: number; city?: string; created_at: string; category_name?: string; offer_count?: number; already_offered?: boolean };
type MyOffer = { id: number; price: number; status: string; created_at: string; request_id: number; title: string };
type Alarm = { id: number; category_id: string; category_name: string; city: string; min_budget: number };

const STATUS: Record<string, [string, string]> = {
  active: ["Yayında", "l-gr"], pending_review: ["İncelemede", "l-am"], closed: ["Kapandı", "l-gy"], expired: ["Süresi doldu", "l-gy"], rejected: ["Reddedildi", "l-acil"],
  accepted: ["Kabul edildi", "l-gr"], withdrawn: ["Geri çekildi", "l-gy"],
};
const St = ({ s }: { s: string }) => <span className={"lbl " + (STATUS[s]?.[1] ?? "l-gy")}>{STATUS[s]?.[0] ?? s}</span>;

function Account() {
  const { user, ready, categories, refresh, toast } = useSession();
  const router = useRouter();
  const s = useSearchParams().get("s") ?? "ozet";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [offers, setOffers] = useState<MyOffer[] | null>(null);
  const [alarms, setAlarms] = useState<Alarm[] | null>(null);
  const [na, setNa] = useState({ category_id: "", city: "", min_budget: "" });

  const load = useCallback(async () => {
    if (!user) return;
    setRows(null);
    if (s === "taleplerim") setRows((await api<{ items: Row[] }>("/me/requests")).items);
    if (s === "favori") setRows((await api<{ items: Row[] }>("/me/favorites")).items);
    if (s === "ozet" || s === "eslesme") setRows((await api<{ items: Row[] }>("/me/matches")).items);
    if (s === "tekliflerim" || s === "ozet") setOffers((await api<{ items: MyOffer[] }>("/me/offers")).items);
    if (s === "alarm" || s === "ozet" || s === "eslesme") setAlarms((await api<{ items: Alarm[] }>("/me/alarms")).items);
  }, [s, user]);
  useEffect(() => { void load().catch((e) => toast(e.message)); }, [load, toast]);

  if (!ready) return <div className="loading">Yükleniyor…</div>;
  if (!user) return (
    <div className="wrap" style={{ padding: "30px 16px 60px", maxWidth: 520 }}><div className="box"><div className="box-b" style={{ textAlign: "center", padding: 30 }}>
      <h2 style={{ fontSize: 18, color: "var(--navy)", marginBottom: 6 }}>Bana Özel</h2>
      <p className="muted" style={{ marginBottom: 16 }}>Taleplerinizi, tekliflerinizi ve alarmlarınızı görmek için giriş yapın.</p>
      <Link className="btn btn-or btn-lg" href="/giris?sonra=/bana-ozel">Giriş Yap / Hesap Aç</Link>
    </div></div></div>
  );

  const logout = async () => { await api("/auth/logout", { body: {} }); await refresh(); router.push("/"); };
  const matchTable = (items: Row[]) => items.length ? (
    <table className="tbl"><thead><tr><th>Talep</th><th>Bütçe</th><th className="r">Teklif</th><th>İl</th><th></th></tr></thead><tbody>
      {items.map((r) => <tr key={r.id} className="row" onClick={() => router.push(`/talep/${r.id}`)}>
        <td><div className="ti-t">{r.title}</div><div className="ti-s">{r.category_name} · {ago(r.created_at)}</div></td>
        <td className="budget-cell nb"><div className="budget">{budgetTxt(r.budget_min, r.budget_max)}</div></td>
        <td data-m="Teklif" className="r"><span className={"oc" + (r.offer_count ? "" : " z")}>{r.offer_count}</span></td>
        <td data-m="İl">{r.city}</td>
        <td className="r act-cell">{r.already_offered ? <span className="lbl l-gr">Teklif verdiniz</span> : <span className="btn btn-or btn-sm">Teklif ver</span>}</td>
      </tr>)}
    </tbody></table>
  ) : <div className="empty">{alarms?.length ? "Alarmlarınıza uyan açık talep şu an yok." : <>Size uygun talepleri görmek için <Link className="link" href="/bana-ozel?s=alarm">talep alarmı kurun</Link>: hangi kategoride ve ilde satış yaptığınızı seçin.</>}</div>;

  const addAlarm = async () => {
    if (!na.category_id) return toast("Kategori seçin.");
    try { await api("/me/alarms", { body: { category_id: na.category_id, city: na.city, min_budget: Number(na.min_budget) || 0 } }); toast("Alarm kuruldu."); setNa({ category_id: "", city: "", min_budget: "" }); void load(); }
    catch (e) { toast((e as Error).message); }
  };

  let content: React.ReactNode = <div className="loading">Yükleniyor…</div>;
  if (s === "ozet") content = (
    <>
      <div className="kpis">
        <div className="kpi"><small>Bu ay ücretsiz teklif</small><b>{user.free_offers_left}</b></div>
        <div className="kpi"><small>Teklif krediniz</small><b>{user.credits}</b><Link className="link" style={{ fontSize: 12 }} href="/bana-ozel?s=kredi">Kredi yükle</Link></div>
        <div className="kpi"><small>Verdiğiniz teklif</small><b>{offers?.length ?? "–"}</b></div>
        <div className="kpi"><small>Kabul edilen</small><b>{offers?.filter((o) => o.status === "accepted").length ?? "–"}</b></div>
      </div>
      <div className="box"><div className="box-h"><h2>Size uygun talepler</h2><Link className="link" href="/bana-ozel?s=eslesme">Tümü »</Link></div>{rows ? matchTable(rows.slice(0, 6)) : content}</div>
    </>
  );
  if (s === "eslesme") content = <div className="box"><div className="box-h"><h2>Size Uygun Talepler</h2><Link className="link" href="/bana-ozel?s=alarm">Alarmları düzenle</Link></div>{rows ? matchTable(rows) : content}</div>;
  if (s === "taleplerim" || s === "favori") content = (
    <div className="box"><div className="box-h"><h2>{s === "favori" ? "Favori Talepler" : "Taleplerim"}</h2>{s === "taleplerim" && <Link className="btn btn-or btn-sm" href="/talep-ver">+ Yeni Talep</Link>}</div>
      {!rows ? content : rows.length ? (
        <table className="tbl"><thead><tr><th>Talep</th><th>Bütçe</th><th className="r">Teklif</th><th>Tarih</th><th>Durum</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.id} className="row" onClick={() => router.push(`/talep/${r.id}`)}>
            <td><div className="ti-t">{r.title}</div><div className="ti-s">Talep No {r.id}{r.category_name ? ` · ${r.category_name}` : ""}</div></td>
            <td className="budget-cell nb"><div className="budget">{budgetTxt(r.budget_min, r.budget_max)}</div></td>
            <td data-m="Teklif" className="r">{r.offer_count !== undefined && <span className={"oc" + (r.offer_count ? "" : " z")}>{r.offer_count}</span>}</td>
            <td data-m="Tarih" className="muted nowrap">{dateTr(r.created_at)}</td>
            <td data-m="Durum">{r.status && <St s={r.status} />}</td>
          </tr>)}
        </tbody></table>
      ) : <div className="empty">{s === "favori" ? "Favori talebiniz yok." : <>Henüz talep vermediniz.<br /><br /><Link className="btn btn-or" href="/talep-ver">Ücretsiz Talep Ver</Link></>}</div>}
    </div>
  );
  if (s === "tekliflerim") content = (
    <div className="box"><div className="box-h"><h2>Verdiğim Teklifler</h2></div>
      {!offers ? content : offers.length ? (
        <table className="tbl"><thead><tr><th>Talep</th><th className="r">Teklifiniz</th><th>Tarih</th><th>Durum</th></tr></thead><tbody>
          {offers.map((o) => <tr key={o.id} className="row" onClick={() => router.push(`/talep/${o.request_id}`)}>
            <td><span className="ti-t">{o.title}</span></td><td data-m="Teklif" className="r"><b>{fmt(o.price)} TL</b></td>
            <td data-m="Tarih" className="muted nowrap">{dateTr(o.created_at)}</td><td data-m="Durum">{o.status === "active" ? <span className="lbl l-am">Alıcı inceliyor</span> : <St s={o.status} />}</td>
          </tr>)}
        </tbody></table>
      ) : <div className="empty">Henüz teklif vermediniz. <Link className="link" href="/bana-ozel?s=eslesme">Size uygun taleplere</Link> göz atın.</div>}
    </div>
  );
  if (s === "alarm") content = (
    <>
      <div className="box" style={{ marginBottom: 14 }}><div className="box-h"><h2>Talep Alarmları</h2></div>
        {!alarms ? content : alarms.length ? (
          <table className="tbl"><thead><tr><th>Kategori</th><th>İl</th><th>Bütçe</th><th></th></tr></thead><tbody>
            {alarms.map((a) => <tr key={a.id}><td>{a.category_name}</td><td data-m="İl">{a.city || "Tüm iller"}</td><td data-m="Bütçe">{a.min_budget ? `${fmt(a.min_budget)} TL ve üstü` : "Farketmez"}</td>
              <td className="r act-cell"><button className="btn btn-gh btn-sm" onClick={async () => { await api(`/me/alarms/${a.id}`, { method: "DELETE" }); void load(); }}>Sil</button></td></tr>)}
          </tbody></table>
        ) : <div className="empty">Alarm yok.</div>}
      </div>
      <div className="box"><div className="box-h"><h3>Yeni alarm</h3></div><div className="box-b">
        <div className="form-grid">
          <div className="fg"><label htmlFor="al-top">Kategori</label><select className="sel" id="al-top" value={na.category_id} onChange={(e) => setNa({ ...na, category_id: e.target.value })}><option value="">Seçin</option>{categories.map((t) => <optgroup key={t.id} label={t.name}><option value={t.id}>{t.name} (tümü)</option>{t.subs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}</select></div>
          <div className="fg"><label htmlFor="al-c">İl</label><select className="sel" id="al-c" value={na.city} onChange={(e) => setNa({ ...na, city: e.target.value })}><option value="">Tüm iller</option>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="fg"><label htmlFor="al-max">Alıcı bütçesi en az (TL)</label><input className="inp" id="al-max" type="number" value={na.min_budget} onChange={(e) => setNa({ ...na, min_budget: e.target.value })} /></div>
          <div className="fg"><label>&nbsp;</label><button className="btn btn-bl" onClick={addAlarm}>Alarm kur</button></div>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Uygun yeni talep geldiğinde SMS veya e-posta ile bildirim alırsınız.</p>
      </div></div>
    </>
  );
  if (s === "kredi") content = (
    <>
      <div className="note n-info" style={{ marginBottom: 12 }}><span>Her ay belirli sayıda teklif ücretsizdir; bu ay kalan hakkınız <b>{user.free_offers_left}</b>, krediniz <b>{user.credits}</b>. Her ek teklif 1 kredi kullanır.</span></div>
      <div className="box"><div className="box-b">
        <b>Kredi satın alma yakında açılıyor.</b>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Ödeme altyapısı kurulana kadar kredi veya mağaza üyeliği için bizimle iletişime geçin; kredi hesabınıza elle tanımlanır.</p>
      </div></div>
    </>
  );
  if (s === "hesap") content = <ProfileForm />;

  const menu: [string, string, number?][] = [["taleplerim", "Taleplerim"], ["favori", "Favori Talepler"], ["ozet", "Satıcı Özeti"], ["eslesme", "Size Uygun Talepler"], ["tekliflerim", "Verdiğim Teklifler"], ["alarm", "Talep Alarmları"], ["kredi", "Kredi ve Mağaza"], ["hesap", "Hesap Bilgileri"]];
  return (
    <div className="wrap acc">
      <nav className="acc-menu">
        <div className="hd"><span className="av">{initials(user.name || "Üye")}</span><div><b style={{ fontSize: 13 }}>{user.name || "Üye"}</b><div><button className="link" style={{ fontSize: 12 }} onClick={logout}>Çıkış yap</button></div></div></div>
        <div className="grp">Alıcı</div>
        {menu.slice(0, 2).map(([k, l]) => <Link key={k} href={`/bana-ozel?s=${k}`} className={s === k ? "on" : ""}><span>{l}</span></Link>)}
        <div className="grp">Satıcı</div>
        {menu.slice(2, 7).map(([k, l]) => <Link key={k} href={`/bana-ozel?s=${k}`} className={s === k ? "on" : ""}><span>{l}</span></Link>)}
        <div className="grp">Hesap</div>
        {menu.slice(7).map(([k, l]) => <Link key={k} href={`/bana-ozel?s=${k}`} className={s === k ? "on" : ""}><span>{l}</span></Link>)}
      </nav>
      <div>{content}</div>
    </div>
  );
}

function ProfileForm() {
  const { user, refresh, toast } = useSession();
  const [name, setName] = useState(user?.name ?? "");
  const [corp, setCorp] = useState(user?.is_corporate ?? false);
  return (
    <div className="box"><div className="box-h"><h2>Hesap Bilgileri</h2></div><div className="box-b">
      <div className="form-grid" style={{ maxWidth: 560 }}>
        <div className="fg full"><label htmlFor="p-n">Ad soyad / firma adı</label><input className="inp" id="p-n" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /><span className="hint">Diğer kullanıcılara yalnızca adınız ve soyadınızın baş harfi gösterilir.</span></div>
        <div className="fg full"><label className="chk"><input type="checkbox" checked={corp} onChange={(e) => setCorp(e.target.checked)} />Kurumsal hesap (firma adına alım/satım)</label></div>
        <div className="fg"><label>Telefon</label><input className="inp" value={user?.phone ?? "—"} disabled /></div>
        <div className="fg"><label>E-posta</label><input className="inp" value={user?.email ?? "—"} disabled /></div>
      </div>
      <button className="btn btn-or" style={{ marginTop: 12 }} onClick={async () => { try { await api("/me", { method: "PATCH", body: { name, is_corporate: corp } }); await refresh(); toast("Bilgileriniz kaydedildi."); } catch (e) { toast((e as Error).message); } }}>Kaydet</button>
    </div></div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="loading">Yükleniyor…</div>}><Account /></Suspense>;
}
