"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useSession } from "@/components/Session";
import { api } from "@/lib/api";

// Güvenli Al: ortak tipler, tutar biçimi ve talep sayfasındaki "Güvenli Al ile sat" kutusu.

export type SafeInfo = {
  enabled: boolean; mode: "test" | "iyzico" | "kapali"; seller_pct: number; buyer_pct: number; min_fee: number; max_fee: number; max_price: number;
  ship_days: number; confirm_days: number; tops: string[]; iban: string | null; iban_name: string | null;
};
export type SafeListItem = { id: number; request_id: number | null; title: string; role: "alici" | "satici"; price: number; total: number; payout?: number; status: string; status_text: string; other_name: string; created_at: string };

// Kuruş → "18.270 TL" / "18.270,50 TL"
export const tl = (k: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: k % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(k / 100) + " TL";

// Sunucudaki hesaplamanın aynısı (önizleme için): satıcı payı en az/en fazla sınırıyla, alıcı hizmet bedeli yüzde.
export function feePreview(priceTl: number, i: Pick<SafeInfo, "seller_pct" | "buyer_pct" | "min_fee" | "max_fee">) {
  const price = Math.round(priceTl * 100);
  const seller = Math.min(price, Math.max(i.min_fee * 100, Math.min(Math.round((price * i.seller_pct) / 100), i.max_fee * 100)));
  const buyer = Math.round((price * i.buyer_pct) / 100);
  return { price, seller, buyer, total: price + buyer, payout: price - seller };
}

export const STATUS_CLASS: Record<string, string> = {
  odeme_bekliyor: "l-am", odendi: "l-or", kargoda: "l-or", sorunlu: "l-am", tamamlandi: "l-gr", iade: "l-gy", iptal: "l-gy",
};

export function useSafeInfo() {
  const [info, setInfo] = useState<SafeInfo | null>(null);
  const { user } = useSession();
  useEffect(() => { void api<SafeInfo>("/safe/info").then(setInfo).catch(() => setInfo(null)); }, [user?.id]);
  return info;
}

// Talep sayfası: bu talepteki Güvenli Al satışlarım (alıcı ve satıcı için).
export function SafeSalesForRequest({ requestId }: { requestId: number }) {
  const [items, setItems] = useState<SafeListItem[]>([]);
  useEffect(() => { void api<{ items: SafeListItem[] }>(`/safe/sales?request_id=${requestId}`).then((r) => setItems(r.items)).catch(() => {}); }, [requestId]);
  if (!items.length) return null;
  return (
    <div className="safe-mini">
      {items.map((s) => (
        <Link key={s.id} href={`/guvenli-al/${s.id}`} className="safe-mini-i">
          <Icon name="shield" size={18} />
          <span><b>Güvenli Al: {s.title}</b><small>{tl(s.role === "alici" ? s.total : s.price)} · {s.role === "alici" ? `Satıcı ${s.other_name}` : `Alıcı ${s.other_name}`}</small></span>
          <span className={"lbl " + (STATUS_CLASS[s.status] ?? "l-gy")}>{s.status_text}</span>
        </Link>
      ))}
    </div>
  );
}

// Satıcı: alıcıyla anlaştıktan sonra Güvenli Al ile satış başlatır.
export function SafeSellBox({ requestId, title, info }: { requestId: number; title: string; info: SafeInfo }) {
  const { toast } = useSession();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title, price: "", description: "", iban: info.iban ?? "", iban_name: info.iban_name ?? "" });
  const [busy, setBusy] = useState(false);
  const [accept, setAccept] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const p = Number(f.price.replace(/\./g, "").replace(",", "."));
  const fee = p > 0 ? feePreview(p, info) : null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const go = async () => {
    setBusy(true);
    try {
      const r = await api<{ id: number }>("/safe/sales", { body: { request_id: requestId, title: f.title, description: f.description, price: p, accept: true, ...(f.iban !== (info.iban ?? "") || !info.iban ? { iban: f.iban, iban_name: f.iban_name } : {}) } });
      setDone(r.id);
      toast("Satış başlatıldı. Alıcıya ödeme bağlantısı gönderildi.");
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  if (done) return <div className="note n-ok safe-sell"><Icon name="shield" size={16} /><span>Güvenli Al satışı başlatıldı. Alıcı ödeyince size haber vereceğiz. <Link className="link" href={`/guvenli-al/${done}`}>Satışı görüntüle »</Link></span></div>;
  if (!open) return (
    <div className="safe-sell safe-cta">
      <Icon name="shield" size={22} />
      <div><b>Alıcıyla anlaştınız mı? Güvenli Al ile satın.</b><small>Alıcı kartla öder, para sitede bekler; ürünü teslim alıp onaylayınca hesabınıza geçer. Kargo dolandırıcılığına son.</small></div>
      <button type="button" className="btn btn-or" onClick={() => setOpen(true)}>Güvenli Al ile sat</button>
    </div>
  );
  return (
    <div className="safe-sell safe-form">
      <div className="safe-form-h"><Icon name="shield" size={18} /><b>Güvenli Al ile satış başlat</b><button type="button" className="link" onClick={() => setOpen(false)}>Vazgeç</button></div>
      <div className="form-grid">
        <div className="fg full"><label htmlFor="sf-t">Ürün</label><input id="sf-t" className="inp" maxLength={120} value={f.title} onChange={set("title")} /></div>
        <div className="fg"><label htmlFor="sf-p">Anlaştığınız fiyat (TL)</label><input id="sf-p" className="inp" inputMode="decimal" value={f.price} onChange={set("price")} placeholder="Örn. 18000" /></div>
        <div className="fg"><label>&nbsp;</label>{fee && <span className="hint">Alıcı öder: <b>{tl(fee.total)}</b> · Size geçer: <b>{tl(fee.payout)}</b></span>}</div>
        <div className="fg full"><label htmlFor="sf-d">Ürün durumu ve kargo notu (isteğe bağlı)</label><textarea id="sf-d" className="txa" rows={2} maxLength={1000} value={f.description} onChange={set("description")} placeholder="Örn. Kutulu, faturalı. Yurtiçi Kargo ile 1 gün içinde gönderirim." /></div>
        <div className="fg"><label htmlFor="sf-i">Paranızın gönderileceği IBAN</label><input id="sf-i" className="inp" value={f.iban} onChange={set("iban")} placeholder="TR00 0000 0000 0000 0000 0000 00" autoComplete="off" /></div>
        <div className="fg"><label htmlFor="sf-n">Hesap sahibinin adı</label><input id="sf-n" className="inp" maxLength={80} value={f.iban_name} onChange={set("iban_name")} /></div>
      </div>
      {fee && (
        <table className="safe-fee"><tbody>
          <tr><th>Ürün bedeli</th><td>{tl(fee.price)}</td></tr>
          <tr><th>Güvenli Al komisyonu (%{info.seller_pct}, en az {info.min_fee} TL)</th><td>− {tl(fee.seller)}</td></tr>
          <tr className="sum"><th>Hesabınıza geçecek</th><td>{tl(fee.payout)}</td></tr>
        </tbody></table>
      )}
      <p className="muted" style={{ fontSize: 12, margin: "8px 0" }}>Alıcı ödeyince size haber veririz; ürünü <b>{info.ship_days} gün</b> içinde kargolayıp takip numarasını girin. Alıcı onaylayınca (ya da kargodan {info.confirm_days} gün sonra) para hesabınıza gönderilir.</p>
      <label className="chk" style={{ marginBottom: 8 }}><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} /><span><a className="link" href="/sozlesmeler/guvenli-al-sozlesmesi" target="_blank" rel="noreferrer">Güvenli Al Hizmet Sözleşmesi</a>&apos;ni okudum, kabul ediyorum.</span></label>
      <button type="button" className="btn btn-or" disabled={busy || !fee || !accept || f.title.trim().length < 3} onClick={() => void go()}>{busy ? "Başlatılıyor…" : "Satışı başlat ve alıcıya gönder"}</button>
    </div>
  );
}
