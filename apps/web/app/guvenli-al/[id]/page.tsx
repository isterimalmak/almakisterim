"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { STATUS_CLASS, tl } from "@/components/Safe";
import { useSession } from "@/components/Session";
import { api } from "@/lib/api";
import { dateTr } from "@/lib/format";

type Sale = {
  id: number; request_id: number | null; title: string; description: string; role: "alici" | "satici" | "yonetici";
  price: number; buyer_fee: number; total: number; seller_fee?: number; payout?: number; status: string; status_text: string; mode: string;
  seller_name: string; buyer_name: string; ship: { name: string | null; phone: string | null; city: string | null; address: string | null } | null;
  cargo_company: string | null; tracking_no: string | null; dispute_reason: string | null;
  created_at: string; paid_at: string | null; shipped_at: string | null; release_at: string | null; completed_at: string | null; refunded_at: string | null; payout_at: string | null;
  ship_deadline: string | null; events: { kind: string; note: string; created_at: string }[];
};

const EVENT: Record<string, string> = {
  olusturuldu: "Satıcı satışı başlattı", odendi: "Alıcı ödemeyi yaptı", kargolandi: "Satıcı kargoya verdi", sorun: "Alıcı sorun bildirdi",
  onaylandi: "Alıcı ürünü aldığını onayladı", otomatik_onay: "Onay süresi doldu, satış tamamlandı", yonetici_onayi: "Ekibimiz satışı onayladı",
  iade: "Para alıcıya iade edildi", iptal: "Satış iptal edildi", saticiya_odendi: "Satıcıya ödeme gönderildi",
};
const CARGO = ["Yurtiçi Kargo", "Aras Kargo", "MNG Kargo", "PTT Kargo", "Sürat Kargo", "HepsiJet", "UPS", "Trendyol Express", "Kolay Gelsin", "Diğer"];
const STEPS = [["odeme_bekliyor", "Ödeme"], ["odendi", "Kargolama"], ["kargoda", "Teslim ve onay"], ["tamamlandi", "Tamamlandı"]] as const;

function SalePage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { user, ready, toast } = useSession();
  const [s, setS] = useState<Sale | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => api<Sale>(`/safe/sales/${id}`).then(setS).catch((e) => setError(e.message)), [id]);
  useEffect(() => { if (user) void load(); }, [load, user]);

  if (!ready) return <div className="loading">Yükleniyor…</div>;
  if (!user) return <div className="wrap"><div className="box" style={{ marginTop: 16 }}><div className="empty">Satışı görmek için <Link className="link" href={`/giris?sonra=/guvenli-al/${id}`}>giriş yapın</Link>.</div></div></div>;
  if (error) return <div className="wrap"><div className="box" style={{ marginTop: 16 }}><div className="empty">{error}</div></div></div>;
  if (!s) return <div className="loading">Yükleniyor…</div>;

  const act = async (path: string, body: Record<string, unknown> = {}, msg = "") => {
    try { setS(await api<Sale>(`/safe/sales/${s.id}/${path}`, { body })); if (msg) toast(msg); }
    catch (e) { toast((e as Error).message); }
  };
  const stepIdx = s.status === "sorunlu" ? 2 : STEPS.findIndex(([k]) => k === s.status);
  const closed = s.status === "iade" || s.status === "iptal";
  const back = sp.get("odeme");

  return (
    <div className="wrap safe-page">
      <div className="crumb"><Link href="/">Ana Sayfa</Link> › <Link href="/guvenli-al">Güvenli Al</Link> › Satış No {s.id}</div>
      <div className="det-title"><h1><Icon name="shield" size={22} style={{ color: "var(--green)", verticalAlign: -3 }} /> {s.title}</h1>
        <span className={"lbl " + (STATUS_CLASS[s.status] ?? "l-gy")}>{s.status_text}</span></div>
      {back === "tamam" && s.status !== "odeme_bekliyor" && <div className="note n-ok" style={{ marginBottom: 12 }}><span><b>Ödemeniz alındı.</b> Paranız ürünü teslim alıp onaylayana kadar güvende bekliyor.</span></div>}
      {back === "hata" && s.status === "odeme_bekliyor" && <div className="note n-bad" style={{ marginBottom: 12 }}><span><b>Ödeme tamamlanmadı.</b> Kartınızdan para çekilmedi; tekrar deneyebilirsiniz.</span></div>}
      {s.mode === "test" && !closed && <div className="note n-warn" style={{ marginBottom: 12 }}><span><b>Deneme modu:</b> ödeme altyapısı henüz bağlanmadığı için gerçek para çekilmez.</span></div>}

      {!closed && (
        <ol className="safe-steps" aria-label="Satış adımları">
          {STEPS.map(([k, l], i) => <li key={k} className={i < stepIdx ? "done" : i === stepIdx ? "on" : ""}><b>{i < stepIdx ? <Icon name="check" size={13} sw={3} /> : i + 1}</b><span>{l}</span></li>)}
        </ol>
      )}

      <div className="det">
        <div>
          <section className="box det-sec" style={{ marginTop: 0 }}>
            <div className="box-h"><h2>{s.role === "satici" ? "Yapmanız gereken" : s.role === "alici" ? "Yapmanız gereken" : "Durum"}</h2></div>
            <div className="box-b"><Action s={s} act={act} reload={load} token={sp.get("deneme_odeme")} /></div>
          </section>
          <section className="box det-sec">
            <div className="box-h"><h2>Geçmiş</h2></div>
            <ul className="safe-ev">{s.events.map((e, i) => <li key={i}><b>{EVENT[e.kind] ?? e.kind}</b>{e.note && <span> · {e.note}</span>}<small>{dateTr(e.created_at)} {new Date(e.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</small></li>)}</ul>
          </section>
        </div>
        <aside>
          <div className="box"><div className="box-b">
            <table className="info"><tbody>
              <tr><th>Satış No</th><td>{s.id}</td></tr>
              {s.request_id && <tr><th>Talep</th><td><Link className="link" href={`/talep/${s.request_id}`}>{s.request_id}</Link></td></tr>}
              <tr><th>Satıcı</th><td>{s.seller_name}</td></tr>
              <tr><th>Alıcı</th><td>{s.buyer_name}</td></tr>
              <tr><th>Ürün bedeli</th><td>{tl(s.price)}</td></tr>
              {s.role !== "satici" && <tr><th>Hizmet bedeli</th><td>{tl(s.buyer_fee)}</td></tr>}
              {s.role !== "satici" && <tr><th>Alıcının ödediği</th><td><b>{tl(s.total)}</b></td></tr>}
              {s.seller_fee !== undefined && <tr><th>Komisyon</th><td>− {tl(s.seller_fee)}</td></tr>}
              {s.payout !== undefined && <tr><th>Satıcıya geçecek</th><td><b>{tl(s.payout)}</b></td></tr>}
              {s.cargo_company && <tr><th>Kargo</th><td>{s.cargo_company}<div className="muted">Takip no: <b>{s.tracking_no}</b></div></td></tr>}
            </tbody></table>
            {s.description && <p className="desc" style={{ fontSize: 13, marginTop: 8 }}>{s.description}</p>}
          </div></div>
          <div className="box safe-guard"><div className="box-b">
            <b><Icon name="shield" size={15} /> Paranız güvende</b>
            <p>Alıcının ödemesi satıcıya hemen geçmez; ürün teslim alınıp onaylanınca aktarılır. Sorun olursa ekibimiz inceler, haklıysanız paranız iade edilir.</p>
            <p>Güvenliğiniz için ödemeyi yalnızca bu sayfadan yapın; satıcıya ayrıca havale/EFT göndermeyin.</p>
          </div></div>
        </aside>
      </div>
    </div>
  );
}

function Action({ s, act, reload, token }: { s: Sale; act: (path: string, body?: Record<string, unknown>, msg?: string) => Promise<void>; reload: () => Promise<void>; token: string | null }) {
  const { toast } = useSession();
  const [accept, setAccept] = useState(false);
  const [addr, setAddr] = useState({ ship_name: s.ship?.name ?? "", ship_phone: s.ship?.phone ?? "", ship_city: s.ship?.city ?? "", ship_address: s.ship?.address ?? "" });
  const [cargo, setCargo] = useState({ cargo_company: CARGO[0]!, other: "", tracking_no: "" });
  const [dispute, setDispute] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const date = (iso: string | null) => (iso ? dateTr(iso) : "");

  const disputeBox = dispute !== null ? (
    <div className="safe-dispute">
      <label htmlFor="sd-r"><b>Sorun nedir?</b></label>
      <textarea id="sd-r" className="txa" rows={3} maxLength={1000} value={dispute} onChange={(e) => setDispute(e.target.value)} placeholder="Örn. Ürün gelmedi / ilandakinden farklı / kırık çıktı. Varsa fotoğrafları mesajla iletin." />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" className="btn btn-or" disabled={busy || dispute.trim().length < 10} onClick={() => void run(() => act("dispute", { reason: dispute }, "Sorun bildiriminiz alındı. Para, inceleme bitene kadar bekletilir."))}>Sorunu bildir</button>
        <button type="button" className="btn btn-wh" onClick={() => setDispute(null)}>Vazgeç</button>
      </div>
    </div>
  ) : <button type="button" className="btn btn-gh btn-sm" onClick={() => setDispute("")}>Sorun var</button>;

  if (s.status === "iptal") return <div className="note n-info"><span>Bu satış iptal edildi; ödeme alınmadı.</span></div>;
  if (s.status === "iade") return <div className="note n-info"><span>Ödeme alıcıya iade edildi ({date(s.refunded_at)}). Kartınıza yansıması bankanıza göre birkaç gün sürebilir.</span></div>;
  if (s.status === "sorunlu") return <div className="note n-warn"><span><b>Sorun bildirildi, ekibimiz inceliyor.</b> {s.dispute_reason && <>“{s.dispute_reason}” · </>}Para bu sürede kimseye aktarılmaz. İki tarafla da iletişime geçeceğiz.{s.role === "alici" && <> Sorun çözüldüyse <button type="button" className="link" onClick={() => { if (confirm("Ürünü sorunsuz teslim aldığınızı onaylıyor musunuz? Para satıcıya gönderilecek.")) void act("confirm", {}, "Onayınız için teşekkürler. Satış tamamlandı."); }}>ürünü aldım, onaylıyorum</button>.</>}</span></div>;
  if (s.status === "tamamlandi") return s.role === "satici"
    ? <div className="note n-ok"><span><b>Satış tamamlandı.</b> {s.payout_at ? <>{tl(s.payout ?? 0)} hesabınıza gönderildi ({date(s.payout_at)}).</> : <>{tl(s.payout ?? 0)} en geç 2 iş günü içinde IBAN&apos;ınıza gönderilecek.</>}</span></div>
    : <div className="note n-ok"><span><b>Satış tamamlandı.</b> Güvenli Al&apos;ı kullandığınız için teşekkürler.</span></div>;

  if (s.status === "odeme_bekliyor") {
    if (s.role !== "alici") return (
      <><p>Alıcının ödeme yapması bekleniyor. Ödeme gelince size site bildirimi ve e-postayla haber vereceğiz; o zamana kadar ürünü göndermeyin.</p>
        <button type="button" className="btn btn-gh btn-sm" style={{ marginTop: 8 }} onClick={() => { if (confirm("Satış iptal edilsin mi?")) void act("cancel", {}, "Satış iptal edildi."); }}>Satışı iptal et</button></>
    );
    if (token && s.mode === "test") return (
      <div className="safe-testpay">
        <b>Deneme ödeme ekranı</b>
        <p className="muted">Gerçek ödeme altyapısı bağlanınca burada iyzico&apos;nun güvenli kart sayfası açılacak. Şimdilik ödemeyi deneme olarak tamamlayabilirsiniz; karttan para çekilmez.</p>
        <button type="button" className="btn btn-or btn-lg" disabled={busy} onClick={() => void run(async () => {
          await act("test-pay", { token }, "Ödemeniz alındı (deneme).");
          history.replaceState(null, "", `/guvenli-al/${s.id}`);
        })}>{tl(s.total)} öde (deneme)</button>
      </div>
    );
    const ok = addr.ship_name.trim().length >= 3 && addr.ship_phone.trim().length >= 10 && addr.ship_city.trim().length >= 2 && addr.ship_address.trim().length >= 10;
    return (
      <>
        <p style={{ marginBottom: 10 }}>Satıcı bu ürünü size <b>{tl(s.price)}</b>&apos;ye Güvenli Al ile satıyor. Teslimat adresinizi yazın ve kartla ödeyin; paranız ürünü teslim alıp onaylayana kadar bizde bekler.</p>
        <div className="form-grid">
          <div className="fg"><label htmlFor="pa-n">Ad soyad</label><input id="pa-n" className="inp" maxLength={80} value={addr.ship_name} onChange={(e) => setAddr({ ...addr, ship_name: e.target.value })} autoComplete="name" /></div>
          <div className="fg"><label htmlFor="pa-p">Telefon</label><input id="pa-p" className="inp" maxLength={20} inputMode="tel" value={addr.ship_phone} onChange={(e) => setAddr({ ...addr, ship_phone: e.target.value })} autoComplete="tel" /></div>
          <div className="fg"><label htmlFor="pa-c">İl</label><input id="pa-c" className="inp" maxLength={40} value={addr.ship_city} onChange={(e) => setAddr({ ...addr, ship_city: e.target.value })} /></div>
          <div className="fg full"><label htmlFor="pa-a">Açık adres</label><textarea id="pa-a" className="txa" rows={2} maxLength={400} value={addr.ship_address} onChange={(e) => setAddr({ ...addr, ship_address: e.target.value })} placeholder="Mahalle, sokak, bina ve daire no, ilçe" autoComplete="street-address" /></div>
        </div>
        <table className="safe-fee"><tbody>
          <tr><th>Ürün bedeli</th><td>{tl(s.price)}</td></tr>
          <tr><th>Güvenli Al hizmet bedeli</th><td>{tl(s.buyer_fee)}</td></tr>
          <tr className="sum"><th>Ödenecek</th><td>{tl(s.total)}</td></tr>
        </tbody></table>
        <label className="chk" style={{ marginTop: 10 }}><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} /><span><a className="link" href="/sozlesmeler/guvenli-al-sozlesmesi" target="_blank" rel="noreferrer">Güvenli Al Hizmet Sözleşmesi</a>&apos;ni okudum, kabul ediyorum.</span></label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <button type="button" className="btn btn-or btn-lg" disabled={busy || !ok || !accept} onClick={() => void run(async () => {
            try { const r = await api<{ url: string }>(`/safe/sales/${s.id}/pay`, { body: { ...addr, accept: true } }); window.location.href = r.url; }
            catch (e) { toast((e as Error).message); }
          })}><Icon name="lock" size={16} /> {busy ? "Ödeme sayfası açılıyor…" : `Güvenli Öde · ${tl(s.total)}`}</button>
          <button type="button" className="btn btn-gh btn-sm" onClick={() => { if (confirm("Satış iptal edilsin mi?")) void act("cancel", {}, "Satış iptal edildi."); }}>İptal et</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Kart bilgileriniz almakisterim&apos;e gelmez; ödeme lisanslı ödeme kuruluşunun güvenli sayfasında yapılır. Taksit seçenekleri ödeme sayfasında görünür.</p>
      </>
    );
  }

  if (s.status === "odendi") {
    if (s.role === "satici") {
      const company = cargo.cargo_company === "Diğer" ? cargo.other : cargo.cargo_company;
      return (
        <>
          <div className="note n-ok" style={{ marginBottom: 10 }}><span><b>Ödeme alındı, ürünü kargolayabilirsiniz.</b> Son gün: <b>{date(s.ship_deadline)}</b>. Bu tarihe kadar takip numarası girilmezse para alıcıya iade edilir.</span></div>
          {s.ship && <div className="safe-addr"><small>Teslimat adresi</small><b>{s.ship.name}</b><span>{s.ship.address}</span><span>{s.ship.city} · {s.ship.phone}</span></div>}
          <div className="form-grid" style={{ marginTop: 10 }}>
            <div className="fg"><label htmlFor="sh-c">Kargo firması</label><select id="sh-c" className="sel" value={cargo.cargo_company} onChange={(e) => setCargo({ ...cargo, cargo_company: e.target.value })}>{CARGO.map((c) => <option key={c}>{c}</option>)}</select></div>
            {cargo.cargo_company === "Diğer" && <div className="fg"><label htmlFor="sh-o">Firma adı</label><input id="sh-o" className="inp" maxLength={40} value={cargo.other} onChange={(e) => setCargo({ ...cargo, other: e.target.value })} /></div>}
            <div className="fg"><label htmlFor="sh-t">Kargo takip numarası</label><input id="sh-t" className="inp" maxLength={40} value={cargo.tracking_no} onChange={(e) => setCargo({ ...cargo, tracking_no: e.target.value })} /></div>
          </div>
          <button type="button" className="btn btn-or" style={{ marginTop: 10 }} disabled={busy || company.trim().length < 2 || cargo.tracking_no.trim().length < 4}
            onClick={() => void run(() => act("ship", { cargo_company: company, tracking_no: cargo.tracking_no }, "Kargo bilgisi alıcıya iletildi."))}>Kargoya verdim</button>
        </>
      );
    }
    return <><p>Ödemeniz alındı ve güvende. Satıcının ürünü <b>{date(s.ship_deadline)}</b> tarihine kadar kargolaması bekleniyor; kargolanmazsa paranız otomatik iade edilir.</p><div style={{ marginTop: 8 }}>{s.role === "alici" && disputeBox}</div></>;
  }

  // Kargoda
  if (s.role === "alici") return (
    <>
      <p>Ürün kargoda: <b>{s.cargo_company}</b>, takip no <b>{s.tracking_no}</b>. Ürünü teslim alınca kontrol edin; sorun yoksa onaylayın, para satıcıya geçsin.</p>
      <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 10px" }}><b>{date(s.release_at)}</b> tarihine kadar onay ya da sorun bildirimi gelmezse satış otomatik tamamlanır.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn btn-or btn-lg" disabled={busy} onClick={() => { if (confirm("Ürünü teslim aldınız ve sorun yok mu? Onaylayınca para satıcıya gönderilir, geri alınamaz.")) void run(() => act("confirm", {}, "Onayınız için teşekkürler. Satış tamamlandı.")); }}>
          <Icon name="check" size={16} sw={2.6} /> Ürünü aldım, onaylıyorum</button>
        {dispute === null && disputeBox}
      </div>
      {dispute !== null && disputeBox}
    </>
  );
  return <p>Kargo bilgisi alıcıya iletildi ({s.cargo_company} · {s.tracking_no}). Alıcı onaylayınca ya da <b>{date(s.release_at)}</b> tarihinde satış tamamlanır ve para hesabınıza gönderilir. <button type="button" className="link" onClick={() => void reload()}>Yenile</button></p>;
}

export default function Page() {
  return <Suspense fallback={<div className="loading">Yükleniyor…</div>}><SalePage /></Suspense>;
}
