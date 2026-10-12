"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Gallery, MediaPicker, Thumbs } from "@/components/Media";
import { CatIcon, Labels } from "@/components/RequestTable";
import { useSession } from "@/components/Session";
import { api, type Media, type Offer, type RequestDetail } from "@/lib/api";
import { ATTRS, DELIVERY } from "@/lib/catalog";
import { ago, budgetTxt, dateTr, fmt, initials, leftParts } from "@/lib/format";

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const { user, toast, refresh } = useSession();
  const [data, setData] = useState<{ request: RequestDetail; offers: Offer[] } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => api<{ request: RequestDetail; offers: Offer[] }>(`/requests/${id}`).then(setData).catch((e) => setError(e.message)), [id]);
  useEffect(() => { void load(); }, [load, user?.id]);

  if (error) return <div className="wrap"><div className="crumb"><Link href="/">Ana Sayfa</Link></div><div className="box"><div className="empty">{error}</div></div></div>;
  if (!data) return <div className="loading">Yükleniyor…</div>;
  const r = data.request;
  const sch = ATTRS[r.top_id] ?? [];
  const lp = leftParts(r.expires_at);
  const open = r.status === "active" && new Date(r.expires_at) > new Date();
  const myOffer = data.offers.find((o) => o.mine);

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
              <tr><th>Konum</th><td>{r.city}{r.district && ` / ${r.district}`}</td></tr>
              <tr><th>Alıcı Tipi</th><td>{r.is_corporate ? "Kurumsal (faturalı alım)" : "Bireysel"}</td></tr>
              <tr><th>Gelen Teklif</th><td>{r.offer_count}</td></tr>
            </tbody></table>
          </div></div>

          <section className="box det-sec">
            <div className="box-h"><h2>Talep Açıklaması</h2><div style={{ display: "flex", gap: 4 }}><Labels r={r} /></div></div>
            <div className="box-b desc">{r.description || <span className="muted">Açıklama eklenmemiş.</span>}</div>
          </section>

          <section className="box det-sec" id="teklifler">
            <div className="box-h"><h2>Teklifler ({r.offer_count})</h2></div>
            {r.is_owner ? <OwnerOffers r={r} offers={data.offers} onChange={load} />
              : myOffer ? <div className="box-b"><div className="note n-ok"><Icon name="check" size={15} sw={3} /><span>Teklifiniz: <b>{fmt(myOffer.price)} TL</b> · Durum: {myOffer.status === "accepted" ? "Kabul edildi 🎉" : myOffer.status === "rejected" ? "Alıcı başka bir teklifi seçti" : "Alıcı inceliyor"}</span></div><Thumbs media={myOffer.media} /></div>
              : !open ? <div className="box-b"><div className="note n-info">Bu talep artık teklif kabul etmiyor.</div></div>
              : user ? <OfferForm r={r} onDone={() => { void load(); void refresh(); }} />
              : <div className="empty">Teklif vermek için <Link className="link" href={`/giris?sonra=/talep/${r.id}`}>giriş yapın</Link>. Teklif fiyatlarını yalnızca talep sahibi görür.</div>}
          </section>
        </div>

        <aside>
          <div className="box"><div className="box-b">
            <div className="who"><span className="av" style={{ width: 42, height: 42, fontSize: 14, background: r.is_corporate ? "var(--navy)" : "#5B6B8C" }}>{initials(r.buyer_name)}</span><div><b>{r.buyer_name}</b><div className="muted" style={{ fontSize: 12 }}>{r.is_corporate ? "Kurumsal alıcı" : "Bireysel alıcı"}</div></div></div>
            <div className="phone-hidden"><Icon name="lock" size={15} /><span>Alıcının telefon numarası gizlidir. Teklifiniz kabul edilirse size bildirim gönderilir.</span></div>
            <div className="muted" style={{ fontSize: 12 }}>Teklif toplama süresinin bitmesine</div>
            <div className="time-left"><div><b>{lp.d}</b><small>gün</small></div><div><b>{lp.h}</b><small>saat</small></div><div><b>{lp.m}</b><small>dakika</small></div></div>
            <div className="act-list">
              {open && !r.is_owner && !myOffer && <a className="btn btn-or btn-lg btn-block" href="#teklifler">Teklif Ver</a>}
              {!r.is_owner && <button className="btn btn-wh btn-block" onClick={fav}><Icon name="heart" size={15} /> {r.is_favorite ? "Favorilerden çıkar" : "Favorilere ekle"}</button>}
              <button className="btn btn-wh btn-block" onClick={alarm}><Icon name="bell" size={15} /> Benzer talepler için alarm kur</button>
              {r.is_owner && open && <button className="btn btn-wh btn-block" onClick={async () => { if (!confirm("Talebi kapatmak istiyor musunuz?")) return; await api(`/requests/${r.id}/close`, { body: {} }); toast("Talep kapatıldı."); void load(); }}>Talebi kapat</button>}
              {!r.is_owner && <button className="btn btn-gh btn-sm" onClick={report}><Icon name="flag" size={13} /> Talebi şikayet et</button>}
            </div>
          </div></div>
        </aside>
      </div>
    </div>
  );
}

function OwnerOffers({ r, offers, onChange }: { r: RequestDetail; offers: Offer[]; onChange: () => void }) {
  const { toast } = useSession();
  const [sort, setSort] = useState("smart");
  if (!offers.length) return <div className="empty">Henüz teklif yok. Bu kategorideki satıcılara bildirim gönderildi; ilk teklif geldiğinde size haber vereceğiz.</div>;
  const lo = Math.min(...offers.map((o) => o.price)), hi = Math.max(...offers.map((o) => o.price));
  const maxSales = Math.max(1, ...offers.map((o) => o.seller_sales));
  const score = (o: Offer) => (hi === lo ? 1 : 1 - (o.price - lo) / (hi - lo)) * 0.6 + (o.seller_sales / maxSales) * 0.25 + (o.warranty ? 0.15 : 0);
  const active = offers.filter((o) => o.status === "active");
  const best = active.length ? active.reduce((a, b) => (score(b) > score(a) ? b : a)) : null;
  const ord = [...offers].sort(sort === "price" ? (a, b) => a.price - b.price : sort === "new" ? (a, b) => +new Date(b.created_at) - +new Date(a.created_at) : (a, b) => score(b) - score(a));
  const avg = offers.reduce((a, o) => a + o.price, 0) / offers.length;
  const accept = async (o: Offer) => {
    if (!confirm(`${o.seller_name} satıcısının ${fmt(o.price)} TL teklifini kabul ediyor musunuz? Diğer teklifler reddedilecek ve talep kapanacak.`)) return;
    try { await api(`/offers/${o.id}/accept`, { body: {} }); toast("Teklif kabul edildi. Satıcıya bildirim gönderildi."); onChange(); }
    catch (e) { toast((e as Error).message); }
  };
  return (
    <>
      <div className="offer-sum">
        <div><small>Teklif sayısı</small><b>{offers.length}</b></div>
        <div className="g"><small>En düşük teklif</small><b>{fmt(lo)} TL</b></div>
        <div><small>Ortalama teklif</small><b>{fmt(avg)} TL</b></div>
        <div><small>Üst bütçeye göre</small><b>%{Math.max(0, Math.round((1 - lo / r.budget_max) * 100))} daha düşük</b></div>
      </div>
      {best && <div className="ai-line"><span className="ai-i">AI</span><div><b>Öneri:</b> Fiyat, satıcının tamamladığı satışlar{best.warranty ? " ve garanti" : ""} birlikte değerlendirildiğinde en dengeli teklif <b>{best.seller_name}</b> tarafından verildi ({fmt(best.price)} TL). <span className="muted">Karar sizindir.</span></div></div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", gap: 8, flexWrap: "wrap", borderBottom: "1px solid var(--line-2)" }}>
        <span className="muted" style={{ fontSize: 12.5, display: "flex", gap: 5, alignItems: "center" }}><Icon name="lock" size={13} /> Teklif fiyatlarını yalnızca siz görürsünüz.</span>
        <select className="sel" style={{ width: "auto", height: 30, fontSize: 12.5 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Teklif sıralaması">
          <option value="smart">Önerilen sıralama</option><option value="price">Fiyat (önce en düşük)</option><option value="new">Önce en yeni</option>
        </select>
      </div>
      <table className="tbl otbl"><thead><tr><th>Satıcı</th><th>Ürün / Açıklama</th><th>Teslimat</th><th className="r">Teklif</th><th></th></tr></thead><tbody>
        {ord.map((o) => {
          const diff = Math.round((1 - o.price / r.budget_max) * 100);
          return (
            <tr key={o.id} className={o.status === "accepted" ? "acc" : best?.id === o.id ? "best" : ""}>
              <td><div className="s-cell"><span className="s-logo" style={{ background: o.seller_is_corporate ? "#2E4FB3" : "#3F7D58" }}>{initials(o.seller_name)}</span><div><div className="s-name">{o.seller_name}</div><div className="muted" style={{ fontSize: 12 }}>{o.seller_is_corporate ? "Mağaza" : "Bireysel"} · {o.seller_sales} tamamlanan satış</div></div></div></td>
              <td data-m="Durum"><b style={{ fontSize: 12.5 }}>{o.condition || "—"}</b>{o.warranty && <> <span className="lbl l-gr">Garantili</span></>}{best?.id === o.id && <> <span className="lbl l-soft">Önerilen</span></>}{o.price === lo && <> <span className="lbl l-or">En düşük</span></>}<div className="o-note">{o.note}</div><Thumbs media={o.media} /><div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>{ago(o.created_at)}</div></td>
              <td data-m="Teslimat" className="nowrap">{o.delivery || "—"}</td>
              <td className="r"><div className="o-price">{fmt(o.price)} TL</div><div className="o-diff" style={{ color: diff >= 0 ? "var(--green)" : "var(--red)" }}>{diff >= 0 ? `bütçenin %${diff} altında` : `bütçenin %${-diff} üstünde`}</div></td>
              <td className="r act-cell">{o.status === "active" && r.status === "active" ? <button className="btn btn-bl btn-sm" onClick={() => accept(o)}>Kabul et</button> : o.status === "accepted" ? <span className="lbl l-soft">Kabul edildi</span> : <span className="muted" style={{ fontSize: 12 }}>—</span>}</td>
            </tr>
          );
        })}
      </tbody></table>
    </>
  );
}

function OfferForm({ r, onDone }: { r: RequestDetail; onDone: () => void }) {
  const { user, toast } = useSession();
  const conds = r.condition === "Hizmet" ? ["Malzeme + işçilik", "Sadece işçilik", "Paket fiyat"] : ["Sıfır, kapalı kutu", "İkinci el, çok iyi", "İkinci el, iyi", "Yenilenmiş"];
  const dels = DELIVERY[r.top_id] ?? DELIVERY.def!;
  const [price, setPrice] = useState("");
  const [cond, setCond] = useState(conds[0]!);
  const [del, setDel] = useState(dels[0]!);
  const [war, setWar] = useState(false);
  const [note, setNote] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!(Number(price) > 0)) return toast("Geçerli bir teklif fiyatı yazın.");
    setBusy(true);
    try {
      const res = await api<{ charged_credit: boolean }>(`/requests/${r.id}/offers`, { body: { price: Math.round(Number(price)), condition: cond, delivery: del, warranty: war, note, media_ids: media.map((m) => m.id) } });
      toast(res.charged_credit ? "Teklifiniz gönderildi. 1 kredi kullanıldı." : "Teklifiniz gönderildi.");
      onDone();
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="box-b">
      <div className="note n-info" style={{ marginBottom: 12 }}><span>Diğer satıcıların fiyatlarını göremezsiniz, en iyi fiyatınızı verin. Bu ay kalan ücretsiz teklif hakkınız: <b>{user?.free_offers_left ?? 0}</b>, krediniz: <b>{user?.credits ?? 0}</b>.</span></div>
      <div className="form-grid">
        <div className="fg"><label htmlFor="o-price">Teklif fiyatınız (TL)</label><input className="inp" id="o-price" type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={`Örn. ${fmt(Math.round(r.budget_max * 0.93))}`} /><span className="hint">Alıcının bütçesi: {budgetTxt(r.budget_min, r.budget_max)}</span></div>
        <div className="fg"><label htmlFor="o-cond">Ürün durumu</label><select className="sel" id="o-cond" value={cond} onChange={(e) => setCond(e.target.value)}>{conds.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="fg"><label htmlFor="o-del">Teslimat</label><select className="sel" id="o-del" value={del} onChange={(e) => setDel(e.target.value)}>{dels.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="fg"><label>&nbsp;</label><label className="chk" style={{ height: 34 }}><input type="checkbox" checked={war} onChange={(e) => setWar(e.target.checked)} />Garantili ürün / hizmet</label></div>
        <div className="fg full"><label htmlFor="o-note">Alıcıya mesajınız</label><textarea className="txa" id="o-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ürünün özellikleri, garanti ve iade koşulları..." /><span className="hint">Telefon numarası ve e-posta yazmayın, otomatik gizlenir.</span></div>
        <div className="fg full"><label>Ürünün fotoğrafları / videosu</label><MediaPicker value={media} onChange={setMedia} onError={toast} label="Fotoğraf / video ekle" /><span className="hint">Gerçek ürün fotoğrafı olan teklifler alıcıların ilgisini çok daha fazla çeker. Fotoğrafları yalnızca alıcı görür.</span></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button className="btn btn-or btn-lg" disabled={busy} onClick={send}>{busy ? "Gönderiliyor…" : "Teklifi Gönder"}</button></div>
    </div>
  );
}
