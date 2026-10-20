"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { STATUS_CLASS, tl } from "@/components/Safe";
import { useSession } from "@/components/Session";
import { api } from "@/lib/api";
import { dateTr } from "@/lib/format";

type Row = {
  id: number; request_id: number | null; title: string; price: number; seller_fee: number; buyer_fee: number; payout: number; status: string; status_text: string;
  created_at: string; paid_at: string | null; seller_name: string; seller_phone: string | null; iban: string | null; iban_name: string | null;
  buyer_name: string; buyer_phone: string | null; cargo_company: string | null; tracking_no: string | null; dispute_reason: string | null;
  payout_at: string | null; payout_note: string | null; admin_note: string | null; release_at: string | null;
};
type Settings = { safe_enabled: boolean; safe_seller_pct: number; safe_buyer_pct: number; safe_min_fee: number; safe_max_fee: number; safe_max_price: number; safe_ship_days: number; safe_confirm_days: number; safe_tops: string[] };
type Data = { mode: string; totals: { held: number; to_pay: number; earned: number; disputes: number }; settings: Settings; items: Row[] };

const FILTERS: [string, string][] = [["", "Tümü"], ["sorunlu", "Sorunlu"], ["odenecek", "Satıcıya ödenecek"], ["odendi", "Kargo bekleyen"], ["kargoda", "Kargoda"], ["odeme_bekliyor", "Ödeme bekleyen"], ["tamamlandi", "Tamamlanan"], ["iade", "İade"]];
const TOPS: [string, string][] = [["elektronik", "Elektronik"], ["ev", "Ev & Yaşam"], ["yedek", "Yedek Parça"], ["moda", "Moda & Giyim"], ["bebek", "Anne & Bebek"], ["spor", "Spor & Hobi"], ["toptan", "Toptan"], ["sanayi", "İş Makineleri & Sanayi"]];

// Yönetim → Güvenli Al: bekleyen para, sorunlu satışlar (iade/ödeme kararı), satıcıya havale işaretleme ve komisyon ayarları.
export function SafeAdmin() {
  const { toast } = useSession();
  const [filter, setFilter] = useState("");
  const [d, setD] = useState<Data | null>(null);
  const [st, setSt] = useState<Settings | null>(null);
  const load = useCallback(async () => {
    try { const r = await api<Data>(`/admin/safe${filter ? `?status=${filter}` : ""}`); setD(r); setSt((x) => x ?? r.settings); }
    catch (e) { toast((e as Error).message); }
  }, [filter, toast]);
  useEffect(() => { void load(); }, [load]);

  const resolve = async (r: Row, action: "refund" | "release") => {
    const q = action === "refund" ? `${tl(r.price + r.buyer_fee)} alıcıya (${r.buyer_name}) iade edilsin mi?` : `Satış onaylansın ve ${tl(r.payout)} satıcıya (${r.seller_name}) ödenecek olarak işaretlensin mi?`;
    const note = window.prompt(q + "\n\nKısa not (isteğe bağlı):", "");
    if (note === null) return;
    try { await api(`/admin/safe/${r.id}/resolve`, { body: { action, note } }); toast(action === "refund" ? "İade yapıldı." : "Satış tamamlandı."); void load(); }
    catch (e) { toast((e as Error).message); }
  };
  const payout = async (r: Row) => {
    const note = window.prompt(`${tl(r.payout)} şu hesaba gönderildi mi?\n${r.iban ?? "IBAN yok"} · ${r.iban_name ?? ""}\n\nHavale açıklaması / dekont no (isteğe bağlı):`, "");
    if (note === null) return;
    try { await api(`/admin/safe/${r.id}/payout`, { body: { note } }); toast("Satıcıya ödendi olarak işaretlendi; satıcıya haber verildi."); void load(); }
    catch (e) { toast((e as Error).message); }
  };
  const save = async () => {
    if (!st) return;
    try { await api("/admin/safe/settings", { method: "PUT", body: st }); toast("Güvenli Al ayarları kaydedildi."); void load(); }
    catch (e) { toast((e as Error).message); }
  };
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setSt((x) => (x ? { ...x, [k]: Number(e.target.value.replace(",", ".")) } : x));

  if (!d) return <div className="loading">Yükleniyor…</div>;
  return (
    <>
      {d.mode !== "iyzico" && <div className="note n-warn" style={{ marginBottom: 12 }}><span>
        {d.mode === "test" ? <><b>Deneme modu:</b> gerçek para çekilmiyor.</> : <><b>Güvenli Al kapalı:</b> ödeme altyapısı bağlı değil.</>} Gerçek ödemeler için
        {" "}<b>Entegrasyonlar → Güvenli Al ödemeleri (iyzico)</b> bölümüne iyzico anahtarlarını girip <b>Test et</b>&apos;e basın.
      </span></div>}
      <div className="kpis">
        <div className="kpi"><small>Bekletilen para</small><b>{tl(d.totals.held)}</b></div>
        <div className="kpi"><small>Satıcılara ödenecek</small><b>{tl(d.totals.to_pay)}</b></div>
        <div className="kpi"><small>Kazanılan komisyon</small><b>{tl(d.totals.earned)}</b></div>
        <div className="kpi"><small>Sorunlu satış</small><b style={{ color: d.totals.disputes ? "var(--red)" : undefined }}>{d.totals.disputes}</b></div>
      </div>

      <div className="ap-box" style={{ marginBottom: 14 }}>
        <div className="ap-box-h"><h2>Satışlar</h2></div>
        <div className="ap-box-b" style={{ paddingBottom: 6 }}><div className="radio-row">
          {FILTERS.map(([k, l]) => <label key={k}><input type="radio" name="sf" checked={filter === k} onChange={() => setFilter(k)} />{l}</label>)}
        </div></div>
        {!d.items.length ? <div className="empty">Bu durumda satış yok.</div> : (
          <table className="tbl"><thead><tr><th>Satış</th><th>Satıcı / Alıcı</th><th className="r">Tutar</th><th>Durum</th><th></th></tr></thead><tbody>
            {d.items.map((r) => (
              <tr key={r.id}>
                <td><Link className="ti-t" href={`/guvenli-al/${r.id}`}>{r.title}</Link><div className="ti-s">No {r.id} · {dateTr(r.created_at)}{r.request_id && <> · <Link className="link" href={`/talep/${r.request_id}`}>talep</Link></>}</div>
                  {r.cargo_company && <div className="ti-s">{r.cargo_company} · {r.tracking_no}</div>}
                  {r.dispute_reason && <div className="note n-warn" style={{ marginTop: 6 }}><span>{r.dispute_reason}</span></div>}
                  {r.admin_note && <div className="ti-s">Not: {r.admin_note}</div>}</td>
                <td data-m="Taraflar"><div>{r.seller_name} <span className="muted">{r.seller_phone}</span></div>{r.iban && <div className="ti-s">{r.iban} · {r.iban_name}</div>}<div className="ti-s">Alıcı: {r.buyer_name} {r.buyer_phone}</div></td>
                <td data-m="Tutar" className="r nowrap">{tl(r.price + r.buyer_fee)}<div className="ti-s">Satıcıya {tl(r.payout)}</div><div className="ti-s">Komisyon {tl(r.seller_fee + r.buyer_fee)}</div></td>
                <td data-m="Durum"><span className={"lbl " + (STATUS_CLASS[r.status] ?? "l-gy")}>{r.status_text}</span>
                  {r.status === "tamamlandi" && <div className="ti-s">{r.payout_at ? `Ödendi ${dateTr(r.payout_at)}${r.payout_note ? ` · ${r.payout_note}` : ""}` : "Satıcıya ödenmedi"}</div>}</td>
                <td className="nowrap">
                  {["odendi", "kargoda", "sorunlu"].includes(r.status) && <>
                    <button type="button" className="btn btn-wh btn-sm" onClick={() => void resolve(r, "refund")}>Alıcıya iade</button>{" "}
                    <button type="button" className="btn btn-wh btn-sm" onClick={() => void resolve(r, "release")}>Satıcıya onayla</button></>}
                  {r.status === "tamamlandi" && !r.payout_at && <button type="button" className="btn btn-or btn-sm" onClick={() => void payout(r)}>Havale yaptım</button>}
                </td>
              </tr>
            ))}
          </tbody></table>
        )}
      </div>

      {st && (
        <div className="ap-box"><div className="ap-box-h"><h2>Komisyon ve kurallar</h2></div><div className="ap-box-b">
          <div className="form-grid" style={{ maxWidth: 720 }}>
            <div className="fg full"><label className="chk"><input type="checkbox" checked={st.safe_enabled} onChange={(e) => setSt({ ...st, safe_enabled: e.target.checked })} />Güvenli Al açık (satıcılar satış başlatabilir)</label></div>
            <div className="fg"><label htmlFor="sa-sp">Satıcı komisyonu (%)</label><input id="sa-sp" className="inp" inputMode="decimal" value={st.safe_seller_pct} onChange={num("safe_seller_pct")} /></div>
            <div className="fg"><label htmlFor="sa-bp">Alıcı hizmet bedeli (%)</label><input id="sa-bp" className="inp" inputMode="decimal" value={st.safe_buyer_pct} onChange={num("safe_buyer_pct")} /><span className="hint">iyzico&apos;nun kart komisyonunu karşılamak için önerilen %1,5</span></div>
            <div className="fg"><label htmlFor="sa-min">Satıcı komisyonu en az (TL)</label><input id="sa-min" className="inp" inputMode="decimal" value={st.safe_min_fee} onChange={num("safe_min_fee")} /></div>
            <div className="fg"><label htmlFor="sa-max">Satıcı komisyonu en fazla (TL)</label><input id="sa-max" className="inp" inputMode="decimal" value={st.safe_max_fee} onChange={num("safe_max_fee")} /></div>
            <div className="fg"><label htmlFor="sa-mp">Tek satışta en yüksek tutar (TL)</label><input id="sa-mp" className="inp" inputMode="numeric" value={st.safe_max_price} onChange={num("safe_max_price")} /></div>
            <div className="fg"><label htmlFor="sa-sd">Kargolama süresi (gün)</label><input id="sa-sd" className="inp" inputMode="numeric" value={st.safe_ship_days} onChange={num("safe_ship_days")} /><span className="hint">Geçerse para alıcıya otomatik iade edilir.</span></div>
            <div className="fg"><label htmlFor="sa-cd">Alıcı onay süresi (gün, kargodan sonra)</label><input id="sa-cd" className="inp" inputMode="numeric" value={st.safe_confirm_days} onChange={num("safe_confirm_days")} /><span className="hint">Geçerse satış otomatik tamamlanır.</span></div>
            <div className="fg full"><label>Güvenli Al kullanılabilen kategoriler</label><div className="radio-row">
              {TOPS.map(([k, l]) => <label key={k}><input type="checkbox" checked={st.safe_tops.includes(k)} onChange={(e) => setSt({ ...st, safe_tops: e.target.checked ? [...st.safe_tops, k] : st.safe_tops.filter((x) => x !== k) })} />{l}</label>)}
            </div><span className="hint">Emlak, vasıta, hizmet ve özel ders kargoyla gönderilemediği için listede yok.</span></div>
          </div>
          <button type="button" className="btn btn-or" style={{ marginTop: 12 }} onClick={() => void save()}>Kaydet</button>
        </div></div>
      )}
    </>
  );
}
