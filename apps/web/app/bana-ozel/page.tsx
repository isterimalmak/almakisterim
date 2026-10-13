"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { PhoneVerify } from "@/components/PhoneVerify";
import { useSession } from "@/components/Session";
import { api } from "@/lib/api";
import { CITIES } from "@/lib/catalog";
import { ago, budgetTxt, dateTr, fmt, initials } from "@/lib/format";

type Row = { id: number; title: string; status?: string; budget_min: number; budget_max: number; city?: string; created_at: string; category_name?: string; offer_count?: number; already_offered?: boolean };
type Conv = { request_id: number; title: string; role: "alici" | "satici"; other_name: string; last_body: string; last_at: string; unread: number };
type Unlock = { id: number; request_id: number; title: string; status: string; phone: string | null; phone_note: string | null; credits: number; is_free: boolean; created_at: string; refunded: boolean; report_status: string | null };
type Notif = { id: number; text: string; link: string; read_at: string | null; created_at: string };
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
  const [convs, setConvs] = useState<Conv[] | null>(null);
  const [alarms, setAlarms] = useState<Alarm[] | null>(null);
  const [unlocks, setUnlocks] = useState<Unlock[] | null>(null);
  const [notifs, setNotifs] = useState<Notif[] | null>(null);
  const [na, setNa] = useState({ category_id: "", city: "", min_budget: "" });

  const load = useCallback(async () => {
    if (!user) return;
    setRows(null);
    if (s === "taleplerim") setRows((await api<{ items: Row[] }>("/me/requests")).items);
    if (s === "favori") setRows((await api<{ items: Row[] }>("/me/favorites")).items);
    if (s === "ozet" || s === "eslesme") setRows((await api<{ items: Row[] }>("/me/matches")).items);
    if (s === "mesaj" || s === "ozet") setConvs((await api<{ items: Conv[] }>("/me/messages")).items);
    if (s === "alarm" || s === "ozet" || s === "eslesme") setAlarms((await api<{ items: Alarm[] }>("/me/alarms")).items);
    if (s === "numaralar") setUnlocks((await api<{ items: Unlock[] }>("/me/unlocks")).items);
    if (s === "bildirim") {
      setNotifs((await api<{ items: Notif[] }>("/me/notifications")).items);
      await api("/me/notifications/read", { body: {} });
      void refresh();
    }
  }, [s, user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load().catch((e) => toast(e.message)); }, [load, toast]);

  if (!ready) return <div className="loading">Yükleniyor…</div>;
  if (!user) return (
    <div className="wrap" style={{ padding: "30px 16px 60px", maxWidth: 520 }}><div className="box"><div className="box-b" style={{ textAlign: "center", padding: 30 }}>
      <h2 style={{ fontSize: 18, color: "var(--navy)", marginBottom: 6 }}>Bana Özel</h2>
      <p className="muted" style={{ marginBottom: 16 }}>Taleplerinizi, mesajlarınızı ve alarmlarınızı görmek için giriş yapın.</p>
      <Link className="btn btn-or btn-lg" href="/giris?sonra=/bana-ozel">Giriş Yap / Hesap Aç</Link>
    </div></div></div>
  );

  const logout = async () => { await api("/auth/logout", { body: {} }); await refresh(); router.push("/"); };
  const matchTable = (items: Row[]) => items.length ? (
    <table className="tbl"><thead><tr><th>Talep</th><th>Bütçe</th><th>İl</th><th></th></tr></thead><tbody>
      {items.map((r) => <tr key={r.id} className="row" onClick={() => router.push(`/talep/${r.id}`)}>
        <td><div className="ti-t">{r.title}</div><div className="ti-s">{r.category_name} · {ago(r.created_at)}</div></td>
        <td className="budget-cell nb"><div className="budget">{budgetTxt(r.budget_min, r.budget_max)}</div></td>
        <td data-m="İl">{r.city}</td>
        <td className="r act-cell"><span className="btn btn-or btn-sm">Alıcıya ulaş</span></td>
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
        <div className="kpi"><small>Bu ay ücretsiz numara</small><b>{user.free_unlocks_left}</b></div>
        <div className="kpi"><small>Krediniz</small><b>{user.credits}</b><Link className="link" style={{ fontSize: 12 }} href="/bana-ozel?s=kredi">Kredi yükle</Link></div>
        <div className="kpi"><small>Konuşma</small><b>{convs?.length ?? "–"}</b></div>
        <div className="kpi"><small>Okunmamış mesaj</small><b>{user.unread_messages ?? 0}</b><Link className="link" style={{ fontSize: 12 }} href="/bana-ozel?s=mesaj">Mesajlar</Link></div>
      </div>
      <div className="box"><div className="box-h"><h2>Size uygun talepler</h2><Link className="link" href="/bana-ozel?s=eslesme">Tümü »</Link></div>{rows ? matchTable(rows.slice(0, 6)) : content}</div>
    </>
  );
  if (s === "eslesme") content = <div className="box"><div className="box-h"><h2>Size Uygun Talepler</h2><Link className="link" href="/bana-ozel?s=alarm">Alarmları düzenle</Link></div>{rows ? matchTable(rows) : content}</div>;
  if (s === "taleplerim" || s === "favori") content = (
    <div className="box"><div className="box-h"><h2>{s === "favori" ? "Favori Talepler" : "Taleplerim"}</h2>{s === "taleplerim" && <Link className="btn btn-or btn-sm" href="/talep-ver">+ Yeni Talep</Link>}</div>
      {!rows ? content : rows.length ? (
        <table className="tbl"><thead><tr><th>Talep</th><th>Bütçe</th><th>Tarih</th><th>Durum</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.id} className="row" onClick={() => router.push(`/talep/${r.id}`)}>
            <td><div className="ti-t">{r.title}</div><div className="ti-s">Talep No {r.id}{r.category_name ? ` · ${r.category_name}` : ""}</div></td>
            <td className="budget-cell nb"><div className="budget">{budgetTxt(r.budget_min, r.budget_max)}</div></td>
            <td data-m="Tarih" className="muted nowrap">{dateTr(r.created_at)}</td>
            <td data-m="Durum">{r.status && <St s={r.status} />}</td>
          </tr>)}
        </tbody></table>
      ) : <div className="empty">{s === "favori" ? "Favori talebiniz yok." : <>Henüz talep vermediniz.<br /><br /><Link className="btn btn-or" href="/talep-ver">Ücretsiz Talep Ver</Link></>}</div>}
    </div>
  );
  if (s === "mesaj") content = (
    <div className="box"><div className="box-h"><h2>Mesajlar</h2></div>
      {!convs ? content : convs.length ? (
        <ul className="convs">{convs.map((c) => (
          <li key={`${c.request_id}-${c.other_name}-${c.role}`} className={c.unread ? "new" : ""}>
            <Link href={`/talep/${c.request_id}#mesajlar`}>
              <span className="cv-h"><b>{c.other_name}</b><span className={"lbl " + (c.role === "alici" ? "l-soft" : "l-gy")}>{c.role === "alici" ? "Talebinize yazan satıcı" : "Ulaştığınız alıcı"}</span>{!!c.unread && <span className="badge">{c.unread}</span>}</span>
              <span className="cv-t">{c.title}</span>
              <span className="cv-b muted">{c.last_body}</span>
              <span className="cv-a muted">{ago(c.last_at)}</span>
            </Link>
          </li>
        ))}</ul>
      ) : <div className="empty">Henüz mesajınız yok. Satmak istiyorsanız <Link className="link" href="/kategori">alıcıları listeleyin</Link> ve ulaşın.</div>}
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
      <div className="note n-info" style={{ marginBottom: 12 }}><span>Alıcıyla iletişim (numarasını görmek ve mesaj göndermek) kredi ile açılır; açtığınız talebin sahibine ücretsiz mesaj yazarsınız. Her ay birkaç numara ücretsizdir: bu ay kalan hakkınız <b>{user.free_unlocks_left}</b>, krediniz <b>{user.credits}</b>. Bir numara genelde {user.unlock_price} kredidir (bazı kategorilerde farklı olabilir).</span></div>
      <div className="box"><div className="box-b">
        <b>Kredi satın alma yakında açılıyor.</b>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Ödeme altyapısı kurulana kadar kredi veya mağaza üyeliği için bizimle iletişime geçin; kredi hesabınıza elle tanımlanır.</p>
      </div></div>
    </>
  );
  if (s === "numaralar") content = <div className="box"><div className="box-h"><h2>Numarasını Açtıklarım</h2></div>{unlocks ? (unlocks.length ? (
    <table className="tbl"><thead><tr><th>Talep</th><th>Numara</th><th>Ücret</th><th>Tarih</th></tr></thead><tbody>
      {unlocks.map((u) => <tr key={u.id} className="row" onClick={() => router.push(`/talep/${u.request_id}`)}>
        <td><div className="ti-t">{u.title}</div><div className="ti-s"><St s={u.status} />{u.report_status && <> <span className="lbl l-am">{u.report_status === "open" ? "Bildirim inceleniyor" : u.report_status === "refunded" ? "İade edildi" : "Bildirim sonuçlandı"}</span></>}</div></td>
        <td data-m="Numara">{u.phone ? <a className="link" href={`tel:+${u.phone}`} onClick={(e) => e.stopPropagation()}><b>{u.phone.replace(/^90(\d{3})(\d{3})(\d{2})(\d{2})$/, "0$1 $2 $3 $4")}</b></a> : <span className="muted" style={{ fontSize: 12 }}>{u.phone_note}</span>}</td>
        <td data-m="Ücret" className="nowrap">{u.is_free ? "Ücretsiz hak" : `${u.credits} kredi`}</td>
        <td data-m="Tarih" className="nowrap muted">{ago(u.created_at)}</td>
      </tr>)}
    </tbody></table>
  ) : <div className="empty">Henüz numarasını açtığınız bir talep yok. <Link className="link" href="/bana-ozel?s=eslesme">Size uygun taleplere</Link> göz atın.</div>) : content}</div>;
  if (s === "bildirim") content = <div className="box"><div className="box-h"><h2>Bildirimler</h2></div>{notifs ? (notifs.length ? (
    <ul className="notifs">{notifs.map((n) => <li key={n.id} className={n.read_at ? "" : "new"}>{n.link ? <Link href={n.link}>{n.text}</Link> : n.text}<span className="muted">{ago(n.created_at)}</span></li>)}</ul>
  ) : <div className="empty">Bildiriminiz yok.</div>) : content}</div>;
  if (s === "hesap") content = (
    <>
      <ProfileForm />
      <div className="box" style={{ marginTop: 14 }}><div className="box-h"><h2>Telefon numarası</h2></div><div className="box-b">
        {user.phone ? <p>Doğrulanmış numaranız: <b>{user.phone.replace(/^90(\d{3})(\d{3})(\d{2})(\d{2})$/, "0$1 $2 $3 $4")}</b></p>
          : <><p className="muted" style={{ marginBottom: 10, fontSize: 13 }}>Talep vermek için doğrulanmış bir telefon numarası gerekir.</p><PhoneVerify /></>}
      </div></div>
    </>
  );

  const menu: [string, string, number?][] = [["taleplerim", "Taleplerim"], ["favori", "Favori Talepler"], ["mesaj", `Mesajlar${user.unread_messages ? ` (${user.unread_messages})` : ""}`], ["ozet", "Satıcı Özeti"], ["eslesme", "Size Uygun Talepler"], ["alarm", "Talep Alarmları"], ["numaralar", "Numarasını Açtıklarım"], ["kredi", "Kredi ve Mağaza"], ["bildirim", `Bildirimler${user.unread_notifications ? ` (${user.unread_notifications})` : ""}`], ["hesap", "Hesap Bilgileri"]];
  return (
    <div className="wrap acc">
      <nav className="acc-menu">
        <div className="hd"><span className="av">{initials(user.name || "Üye")}</span><div><b style={{ fontSize: 13 }}>{user.name || "Üye"}</b><div><button className="link" style={{ fontSize: 12 }} onClick={logout}>Çıkış yap</button></div></div></div>
        <div className="grp">Alıcı</div>
        {menu.slice(0, 3).map(([k, l]) => <Link key={k} href={`/bana-ozel?s=${k}`} className={s === k ? "on" : ""}><span>{l}</span></Link>)}
        <div className="grp">Satıcı</div>
        {menu.slice(3, 8).map(([k, l]) => <Link key={k} href={`/bana-ozel?s=${k}`} className={s === k ? "on" : ""}><span>{l}</span></Link>)}
        <div className="grp">Hesap</div>
        {menu.slice(8).map(([k, l]) => <Link key={k} href={`/bana-ozel?s=${k}`} className={s === k ? "on" : ""}><span>{l}</span></Link>)}
        {user.role === "admin" && <Link href="/yonetim"><span>Yönetim Paneli</span></Link>}
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
