"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/components/Session";
import { dateTr } from "@/lib/format";

type Row = { id: number; title: string; status: string; created_at: string; expires_at: string; budget_max: number; city: string; district: string | null;
  is_urgent: boolean; is_featured: boolean; buyer_name: string; buyer_phone: string | null; buyer_email: string | null; unlocks: number; messages: number };
type Status = "all" | "active" | "pending_review" | "expired" | "closed" | "rejected";
const FILTERS: [Status, string][] = [["all", "Tümü"], ["active", "Yayında"], ["pending_review", "İncelemede"], ["expired", "Süresi dolan"], ["closed", "Kapatılan"], ["rejected", "Kaldırılan"]];

function statusOf(r: Row): [string, string] {
  if (r.status === "active" && new Date(r.expires_at) <= new Date()) return ["Süresi doldu", "l-gy"];
  return ({ active: ["Yayında", "l-gr"], pending_review: ["İncelemede", "l-am"], expired: ["Süresi doldu", "l-gy"], closed: ["Kapatıldı", "l-gy"], rejected: ["Kaldırıldı", "l-acil"] } as Record<string, [string, string]>)[r.status] ?? [r.status, "l-gy"];
}

// Yönetim → Talepler: bütün talepler; arama, durum süzgeci, vitrine alma ve yayından kaldırma.
export function RequestsAdmin() {
  const { toast } = useSession();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Row[]; total: number } | null>(null);

  const load = useCallback(async (p = 1, append = false) => {
    const r = await api<{ items: Row[]; total: number }>(`/admin/requests?${new URLSearchParams({ q, status, page: String(p) })}`);
    setData((old) => (append && old ? { items: [...old.items, ...r.items], total: r.total } : r));
    setPage(p);
  }, [q, status]);
  useEffect(() => { void load().catch((e) => toast((e as Error).message)); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast(msg); await load(); } catch (e) { toast((e as Error).message); }
  };
  const remove = (r: Row) => { if (confirm(`"${r.title}" yayından kaldırılsın mı?`)) void run(() => api(`/admin/requests/${r.id}/remove`, { body: {} }), "Talep yayından kaldırıldı."); };
  const approve = (r: Row) => void run(() => api(`/admin/requests/${r.id}/approve`, { body: {} }), "Talep onaylandı ve yayına alındı.");
  const vitrin = (r: Row) => void run(() => api(`/admin/requests/${r.id}/vitrin`, { body: { days: r.is_featured ? 0 : 7 } }), r.is_featured ? "Vitrinden çıkarıldı." : "7 gün vitrine alındı.");

  return (
    <div className="ap-box">
      <div className="ap-box-h"><h2>Talepler{data ? ` (${data.total})` : ""}</h2></div>
      <div className="ap-box-b">
        <form className="ap-search" onSubmit={(e) => { e.preventDefault(); void load(); }}>
          <input className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Başlık, alıcı adı veya talep no" aria-label="Yönetimde talep ara" />
          <button className="btn btn-bl">Ara</button>
        </form>
        <div className="chips" style={{ margin: "10px 0" }}>{FILTERS.map(([k, l]) => (
          <button key={k} type="button" className={"chip" + (status === k ? " on" : "")} onClick={() => setStatus(k)}>{l}</button>
        ))}</div>
        {!data ? <div className="loading">Yükleniyor…</div> : !data.items.length ? <div className="empty">Bu süzgece uyan talep yok.</div> : (
          <table className="tbl">
            <thead><tr><th>Talep</th><th>Alıcı</th><th>Durum</th><th className="r">Numara / Mesaj</th><th></th></tr></thead>
            <tbody>{data.items.map((r) => {
              const [st, cls] = statusOf(r);
              const live = r.status === "active" && new Date(r.expires_at) > new Date();
              return (
                <tr key={r.id}>
                  <td><Link className="ti-t" href={`/talep/${r.id}`}>{r.title}</Link>
                    <div className="ti-s">#{r.id} · {r.budget_max.toLocaleString("tr-TR")} TL · {r.city}{r.district ? ` / ${r.district}` : ""} · {dateTr(r.created_at)}</div>
                    <div className="ti-l">{r.is_urgent && <span className="lbl l-acil">ACİL</span>}{r.is_featured && <span className="lbl l-kur">Vitrinde</span>}</div></td>
                  <td data-m="Alıcı">{r.buyer_name || "—"}<div className="ti-s">{r.buyer_phone ?? r.buyer_email}</div></td>
                  <td data-m="Durum"><span className={`lbl ${cls}`}>{st}</span></td>
                  <td data-m="Numara / Mesaj" className="r">{r.unlocks} / {r.messages}</td>
                  <td className="r act-cell nowrap">
                    {r.status === "pending_review" && <button className="btn btn-wh btn-sm" onClick={() => approve(r)}>Onayla</button>}{" "}
                    {live && <button className="btn btn-wh btn-sm" onClick={() => vitrin(r)}>{r.is_featured ? "Vitrinden çıkar" : "Vitrine al"}</button>}{" "}
                    {(live || r.status === "pending_review") && <button className="btn btn-gh btn-sm" onClick={() => remove(r)}>Kaldır</button>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
        {data && data.items.length < data.total && <button className="btn btn-wh" style={{ marginTop: 10 }} onClick={() => void load(page + 1, true)}>Daha fazla göster</button>}
      </div>
    </div>
  );
}
