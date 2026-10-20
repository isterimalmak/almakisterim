"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Thread, type ChatMsg } from "@/components/Chat";
import { Gallery } from "@/components/Media";
import { PhoneVerify } from "@/components/PhoneVerify";
import { SafeSalesForRequest, SafeSellBox, useSafeInfo } from "@/components/Safe";
import { placeTxt } from "@/lib/locations";
import { VehicleRows } from "@/components/VehicleFields";
import { CatIcon, Labels } from "@/components/RequestTable";
import { useSession } from "@/components/Session";
import { api, type Contact, type RequestDetail } from "@/lib/api";
import { attrsFor } from "@/lib/catalog";
import { ago, budgetTxt, dateTr, fmt, initials, leftParts } from "@/lib/format";
import { isVehicleSub, type VehicleAttrs } from "@/lib/vehicles";

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const { user, toast, refresh } = useSession();
  const [data, setData] = useState<{ request: RequestDetail; contact: Contact } | null>(null);
  const [error, setError] = useState("");
  const safe = useSafeInfo();

  const load = useCallback(() => api<{ request: RequestDetail; contact: Contact }>(`/requests/${id}`).then(setData).catch((e) => setError(e.message)), [id]);
  useEffect(() => { void load(); }, [load, user?.id]);

  if (error) return <div className="wrap"><div className="crumb"><Link href="/">Ana Sayfa</Link></div><div className="box"><div className="empty">{error}</div></div></div>;
  if (!data) return <div className="loading">Yükleniyor…</div>;
  const r = data.request;
  const sch = attrsFor(r.top_id, r.category_id);
  const lp = leftParts(r.expires_at);
  const open = r.status === "active" && new Date(r.expires_at) > new Date();
  const c = data.contact;

  const fav = async () => {
    if (!user) return toast("Favorilere eklemek için giriş yapın.");
    await api(`/me/favorites/${r.id}`, { method: r.is_favorite ? "DELETE" : "PUT" });
    toast(r.is_favorite ? "Favorilerden çıkarıldı." : "Favorilere eklendi.");
    void load();
  };
  const alarm = async () => {
    if (!user) return toast("Alarm kurmak için giriş yapın.");
    try { await api("/me/alarms", { body: { category_id: r.category_id, city: r.city, min_budget: 0 } }); toast(`Alarm kuruldu: ${r.category_name}, ${r.city}`); }
    catch (e) { toast((e as Error).message); }
  };
  const report = async () => {
    const reason = window.prompt("Şikayet nedeninizi kısaca yazın:");
    if (!reason || reason.trim().length < 3) return;
    try { await api(`/requests/${r.id}/report`, { body: { reason: reason.trim() } }); toast("Şikayetiniz alındı. Ekibimiz inceleyecek."); }
    catch (e) { toast((e as Error).message); }
  };

  return (
    <div className="wrap">
      <div className="crumb"><Link href="/">Ana Sayfa</Link> › <Link href={`/kategori/${r.top_id}`}>{r.top_name}</Link> › <Link href={`/kategori/${r.top_id}/${r.category_id}`}>{r.category_name}</Link></div>
      <div className="det-title"><h1>{r.title}</h1><span className="no">Talep No: <b>{r.id}</b></span></div>
      {r.status === "pending_review" && <div className="note n-warn" style={{ marginBottom: 12 }}>Bu talep inceleme bekliyor ve henüz yayında değil. {r.moderation_note}</div>}
      {r.status === "rejected" && <div className="note n-bad" style={{ marginBottom: 12 }}>Bu talep kurallara uygun bulunmadığı için yayınlanmadı.</div>}
      <div className="det">
        <div>
          <div className="box"><div className="box-b det-top">
            <Gallery media={r.media} fallback={<div className="ref"><div style={{ display: "grid", placeItems: "center", gap: 8 }}><CatIcon top={r.top_id} /><span className="muted">Alıcı referans görsel eklemedi</span></div></div>} />
            <table className="info"><tbody>
              <tr><th>Alıcının bütçesi</th><td><span className="price-big">{budgetTxt(r.budget_min, r.budget_max)}</span></td></tr>
              <tr><th>Talep No</th><td>{r.id}</td></tr>
              <tr><th>Talep Tarihi</th><td>{dateTr(r.created_at)}</td></tr>
              <tr><th>Kategori</th><td>{r.top_name} › {r.category_name}</td></tr>
              <tr><th>Ürün Durumu</th><td>{r.condition}</td></tr>
              {sch.filter((a) => r.attrs[a.k] !== undefined).map((a) => <tr key={a.k}><th>{a.l}</th><td>{a.t === "num" && a.k !== "yil" ? fmt(Number(r.attrs[a.k])) : String(r.attrs[a.k])}</td></tr>)}
              {isVehicleSub(r.category_id) && <VehicleRows a={r.attrs as VehicleAttrs} />}
              <tr><th>Konum</th><td>{placeTxt(r)}{!r.district && <span className="muted"> (ilçe farketmez)</span>}</td></tr>
              <tr><th>Alıcı Tipi</th><td>{r.is_corporate ? "Kurumsal (faturalı alım)" : "Bireysel"}</td></tr>
            </tbody></table>
          </div></div>

          <section className="box det-sec">
            <div className="box-h"><h2>Talep Açıklaması</h2><div style={{ display: "flex", gap: 4 }}><Labels r={r} /></div></div>
            <div className="box-b desc">{r.description || <span className="muted">Açıklama eklenmemiş.</span>}</div>
          </section>

          <section className="box det-sec" id="mesajlar">
            <div className="box-h"><h2>{r.is_owner ? "Satıcılardan gelen mesajlar" : "Alıcıyla iletişim"}</h2></div>
            {user && <SafeSalesForRequest requestId={r.id} />}
            {r.is_owner ? <OwnerThreads r={r} />
              : !user ? <div className="empty">Alıcının numarasını görmek veya mesaj göndermek için <Link className="link" href={`/giris?sonra=/talep/${r.id}`}>giriş yapın</Link>.</div>
              : c.unlocked ? <>{safe?.enabled && safe.tops.includes(r.top_id) && !c.blocked && <SafeSellBox requestId={r.id} title={r.title.replace(/\s*almak istiyorum\.?$/i, "")} info={safe} />}<SellerThread r={r} /></>
              : !open ? <div className="box-b"><div className="note n-info">Bu talep kapandı.</div></div>
              : <UnlockBox r={r} c={c} onDone={() => { void load(); void refresh(); }} />}
          </section>
        </div>

        <aside>
          <div className="box"><div className="box-b">
            <div className="who"><span className="av" style={{ width: 42, height: 42, fontSize: 14, background: r.is_corporate ? "var(--navy)" : "#5B6B8C" }}>{initials(r.buyer_name)}</span><div><b>{r.buyer_name}</b><div className="muted" style={{ fontSize: 12 }}>{r.is_corporate ? "Kurumsal alıcı" : "Bireysel alıcı"}</div></div></div>
            {r.is_owner ? <OwnerContact r={r} c={c} onChange={load} />
              : c.phone ? <SellerContact c={c} />
              : c.unlocked && !c.blocked && !c.has_phone ? <div className="phone-hidden"><Icon name="lock" size={15} /><span>Alıcı telefon numarası eklememiş. Aşağıdan mesaj gönderin.</span></div>
              : c.blocked ? <div className="phone-hidden"><Icon name="lock" size={15} /><span>Alıcı numarasını sizinle paylaşmayı durdurdu.</span></div>
              : <div className="phone-hidden"><Icon name="lock" size={15} /><span>Alıcının numarası gizli. {open ? <>Numarayı görmek {c.price ? <b>{c.price} kredi</b> : "ücretsiz"}{c.slots_left !== null && <> · {c.slots_left} satıcı hakkı kaldı</>}.</> : "Talep kapandı."}</span></div>}
            <div className="muted" style={{ fontSize: 12 }}>Talebin süresinin bitmesine</div>
            <div className="time-left"><div><b>{lp.d}</b><small>gün</small></div><div><b>{lp.h}</b><small>saat</small></div><div><b>{lp.m}</b><small>dakika</small></div></div>
            <div className="act-list">
              {open && !r.is_owner && !c.blocked && <a className="btn btn-or btn-lg btn-block" href="#mesajlar">{c.unlocked ? "Mesaj Yaz" : "Numarayı Gör / Mesaj Yaz"}</a>}
              {!r.is_owner && <button className="btn btn-wh btn-block" onClick={fav}><Icon name="heart" size={15} /> {r.is_favorite ? "Favorilerden çıkar" : "Favorilere ekle"}</button>}
              <button className="btn btn-wh btn-block" onClick={alarm}><Icon name="bell" size={15} /> Benzer talepler için alarm kur</button>
              {r.is_owner && open && <button className="btn btn-wh btn-block" onClick={async () => { if (!confirm("Aradığınızı buldunuz mu? Talep kapanır ve numaranız yeni satıcılara gösterilmez.")) return; await api(`/requests/${r.id}/close`, { body: {} }); toast("Talep kapatıldı, numaranız artık yeni satıcılara gösterilmiyor."); void load(); }}>Aldım / Talebi kapat</button>}
              {user?.role === "admin" && open && <button className="btn btn-wh btn-block" onClick={async () => {
                try { await api(`/admin/requests/${r.id}/vitrin`, { body: { days: r.is_featured ? 0 : 30 } }); toast(r.is_featured ? "Vitrinden çıkarıldı." : "30 gün vitrinde, en başta görünecek."); void load(); }
                catch (e) { toast((e as Error).message); }
              }}>★ {r.is_featured ? "Vitrinden çıkar" : "Vitrine ekle (30 gün)"}</button>}
              {!r.is_owner && <button className="btn btn-gh btn-sm" onClick={report}><Icon name="flag" size={13} /> Talebi şikayet et</button>}
            </div>
          </div></div>
        </aside>
      </div>
    </div>
  );
}

// Alıcı: her satıcıyla ayrı konuşma.
function OwnerThreads({ r }: { r: RequestDetail }) {
  const { toast, refresh } = useSession();
  const [threads, setThreads] = useState<{ seller_id: string; seller_name: string; blocked: boolean; messages: ChatMsg[] }[] | null>(null);
  const load = useCallback(() => api<{ threads: NonNullable<typeof threads> }>(`/requests/${r.id}/messages`).then((x) => { setThreads(x.threads); void refresh(); }).catch((e) => toast(e.message)), [r.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  if (!threads) return <div className="loading">Yükleniyor…</div>;
  if (!threads.length) return <div className="empty">Henüz mesaj yok. Talebinize uygun satıcılar sizi arayabilir veya buradan mesaj gönderebilir; mesaj gelince size haber vereceğiz.</div>;
  return (
    <div className="box-b">
      {threads.map((t) => (
        <div className="thr" key={t.seller_id}>
          <div className="thr-h"><b>{t.seller_name}</b>{t.blocked && <span className="lbl l-gy">Şikâyet ettiniz</span>}</div>
          <Thread messages={t.messages} canWrite={!t.blocked} label={`${t.seller_name} satıcısına cevap`}
            onSend={async (body) => { try { await api(`/requests/${r.id}/messages`, { body: { body, seller_id: t.seller_id } }); await load(); } catch (e) { toast((e as Error).message); } }} />
        </div>
      ))}
    </div>
  );
}

// Satıcı: iletişimi açtıktan sonra alıcıyla konuşma.
function SellerThread({ r }: { r: RequestDetail }) {
  const { toast } = useSession();
  const [d, setD] = useState<{ can_write: boolean; messages: ChatMsg[] } | null>(null);
  const load = useCallback(() => api<NonNullable<typeof d>>(`/requests/${r.id}/messages`).then(setD).catch((e) => toast(e.message)), [r.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  if (!d) return <div className="loading">Yükleniyor…</div>;
  return (
    <div className="box-b">
      {!d.messages.length && d.can_write && <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Alıcıya elinizdeki ürünü, fiyatınızı ve durumunu yazın. Telefonla da arayabilirsiniz.</p>}
      <Thread messages={d.messages} canWrite={d.can_write} closedText="Alıcı sizinle iletişimi durdurdu." label="Alıcıya mesajınız"
        onSend={async (body) => { try { await api(`/requests/${r.id}/messages`, { body: { body } }); await load(); } catch (e) { toast((e as Error).message); } }} />
    </div>
  );
}

function phoneTxt(p: string) {
  // 905321112233 → 0532 111 22 33
  const d = p.replace(/^90/, "0");
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
}

function SellerContact({ c }: { c: Contact }) {
  const { toast } = useSession();
  const report = async () => {
    const pick = window.prompt("Sorun nedir? Numarasını yazın:\n1 - Numaraya ulaşılamıyor\n2 - Yanlış numara\n3 - Sahte talep");
    const reason = ({ "1": "ulasilamiyor", "2": "yanlis_numara", "3": "sahte_talep" } as Record<string, string>)[(pick ?? "").trim()];
    if (!reason || !c.unlock_id) return;
    const note = window.prompt("Kısaca açıklayın (isteğe bağlı):") ?? "";
    try { await api(`/unlocks/${c.unlock_id}/report`, { body: { reason, note } }); toast("Bildiriminiz alındı. İncelenip haklıysanız krediniz iade edilecek."); }
    catch (e) { toast((e as Error).message); }
  };
  return (
    <>
      <a className="phone-open" href={`tel:+${c.phone}`}><Icon name="phone" size={16} /><span>{phoneTxt(c.phone!)}</span></a>
      <div className="phone-acts">
        <a className="btn btn-wh btn-sm" href={`https://wa.me/${c.phone}`} target="_blank" rel="noreferrer">WhatsApp&apos;tan yaz</a>
        <button className="btn btn-gh btn-sm" onClick={report}>Sorun bildir</button>
      </div>
      <p className="muted" style={{ fontSize: 11.5, margin: "0 0 10px" }}>Numarayı yalnızca bu talep için kullanın. Alıcıyı rahatsız eden satıcıların hesabı kapatılır.</p>
    </>
  );
}

function OwnerContact({ r, c, onChange }: { r: RequestDetail; c: Contact; onChange: () => void }) {
  const { toast } = useSession();
  const setHidden = async (hidden: boolean) => {
    if (hidden && !confirm("Numaranız hiçbir satıcıya gösterilmeyecek ve yeni satıcılar sizi arayamayacak. Devam edilsin mi?")) return;
    try { await api(`/requests/${r.id}/contact`, { body: { hidden } }); toast(hidden ? "Numaranız gizlendi." : "Numaranız yeniden paylaşılıyor."); onChange(); }
    catch (e) { toast((e as Error).message); }
  };
  const complain = async (unlockId: number) => {
    const note = window.prompt("Satıcı sizi nasıl rahatsız etti? (isteğe bağlı)");
    if (note === null) return;
    try { await api(`/unlocks/${unlockId}/report`, { body: { reason: "rahatsiz_etti", note } }); toast("Şikâyetiniz alındı; numaranız bu satıcıdan gizlendi."); onChange(); }
    catch (e) { toast((e as Error).message); }
  };
  return (
    <div className="phone-hidden" style={{ display: "block" }}>
      <div style={{ display: "flex", gap: 8 }}><Icon name="lock" size={15} /><span>{c.hidden ? <b>Numaranız gizli; hiçbir satıcı göremez.</b> : <>Numaranızı şu ana kadar <b>{c.used}</b>{c.limit > 0 && <> / {c.limit}</>} satıcı gördü.</>}</span></div>
      {!!c.viewers?.length && (
        <ul className="viewers">{c.viewers.map((v) => (
          <li key={v.unlock_id}><span>{v.seller_name} <span className="muted">· {ago(v.created_at)}</span></span>
            {v.reported ? <span className="lbl l-gy">Şikâyet edildi</span> : <button className="link" onClick={() => complain(v.unlock_id)}>Rahatsız etti</button>}</li>
        ))}</ul>
      )}
      <button className="link" style={{ fontSize: 12, marginTop: 6 }} onClick={() => setHidden(!c.hidden)}>{c.hidden ? "Numaramı yeniden paylaş" : "Numaramı artık gösterme"}</button>
    </div>
  );
}

function UnlockBox({ r, c, onDone }: { r: RequestDetail; c: Contact; onDone: () => void }) {
  const { user, toast, launchMode, phoneRequired } = useSession();
  const [busy, setBusy] = useState(false);
  const full = c.slots_left === 0;
  const free = (user?.free_unlocks_left ?? 0) > 0 || c.price === 0;
  const go = async () => {
    setBusy(true);
    try {
      const res = await api<{ charged_credits: number; free: boolean }>(`/requests/${r.id}/unlock`, { body: {} });
      toast(res.charged_credits ? `İletişim açıldı, ${res.charged_credits} kredi kullanıldı.` : res.free ? "İletişim açıldı (ücretsiz hakkınızdan)." : "İletişim açıldı.");
      onDone();
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="box-b unlock">
      <div className="unlock-h"><Icon name="lock" size={18} /><b>Alıcıyla iletişime geçin</b></div>
      <ul className="unlock-l">
        <li>Açınca alıcının numarasını görür, hemen arayabilir ya da buradan mesaj gönderebilirsiniz.</li>
        <li>Bu talepte numarayı en fazla <b>{c.limit || "sınırsız"}</b> satıcı görebilir{c.slots_left !== null && <>; <b>{c.slots_left}</b> hak kaldı</>}.</li>
        <li>Ücret: <b>{c.price ? `${c.price} kredi` : launchMode ? "ücretsiz (lansman dönemi)" : "ücretsiz"}</b>{c.price > 0 && <> · Bu ay kalan ücretsiz hakkınız: <b>{user?.free_unlocks_left ?? 0}</b> · Krediniz: <b>{user?.credits ?? 0}</b></>}</li>
      </ul>
      {!user?.phone && phoneRequired
        ? <div className="note n-warn" style={{ display: "block" }}><b>Önce kendi numaranızı doğrulayın.</b> Alıcıların güvenliği için numara görmek isteyen satıcıların telefonu doğrulanmış olmalı.<div style={{ marginTop: 10 }}><PhoneVerify /></div></div>
        : full
        ? <div className="note n-info">Bu talepte numara görme hakları doldu.</div>
        : <button className="btn btn-or btn-lg" disabled={busy} onClick={go}>{busy ? "Açılıyor…" : c.price === 0 ? "Numarayı Gör / Mesaj Yaz (ücretsiz)" : free ? "Numarayı Gör / Mesaj Yaz (ücretsiz hak)" : `Numarayı Gör / Mesaj Yaz (${c.price} kredi)`}</button>}
      {(user?.phone || !phoneRequired) && !full && !free && (user?.credits ?? 0) < c.price && <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Krediniz yetersiz. <Link className="link" href="/bana-ozel?s=kredi">Kredi yükleyin</Link>.</p>}
    </div>
  );
}
