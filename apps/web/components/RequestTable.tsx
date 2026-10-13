"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RequestItem } from "@/lib/api";
import { attrLine, theme } from "@/lib/catalog";
import { budgetTxt, dateTr, fmt, isNew, leftTxt } from "@/lib/format";
import { Icon } from "./Icon";
import { useSession } from "./Session";

export function CatIcon({ top, cls = "ti-ic" }: { top: string; cls?: string }) {
  const { categories } = useSession();
  const t = theme(top);
  const icon = categories.find((c) => c.id === top)?.icon ?? "box";
  return <span className={cls} style={{ background: t.c, color: t.fc }}><Icon name={icon} sw={1.7} /></span>;
}

export function Labels({ r }: { r: Pick<RequestItem, "is_urgent" | "is_corporate" | "created_at" | "status"> }) {
  return (
    <>
      {r.is_urgent && <span className="lbl l-acil">Acil</span>}
      {r.is_corporate && <span className="lbl l-kur">Kurumsal</span>}
      {isNew(r.created_at) && <span className="lbl l-new">Yeni</span>}
      {r.status === "closed" && <span className="lbl l-gy">Anlaşıldı</span>}
    </>
  );
}

export function RequestTable({ items, empty = "Bu kriterlere uygun talep bulunamadı." }: { items: RequestItem[]; empty?: string }) {
  const router = useRouter();
  if (!items.length) return <div className="empty">{empty}</div>;
  return (
    <table className="tbl">
      <thead><tr><th>Talep</th><th>Bütçe</th><th>Kalan Süre</th><th>Talep Tarihi</th><th>İl / İlçe</th></tr></thead>
      <tbody>
        {items.map((r) => (
          <tr key={r.id} className={"row" + (r.is_urgent ? " urgent" : "")} onClick={() => router.push(`/talep/${r.id}`)}>
            <td>
              <div className="ti">
                {r.cover_url ? <img className="ti-ic ti-img" src={r.cover_url} alt="" loading="lazy" /> : <CatIcon top={r.top_id} />}
                <div>
                  <Link href={`/talep/${r.id}`} className="ti-t" onClick={(e) => e.stopPropagation()}>{r.title}</Link>
                  <div className="ti-s">{r.category_name} · {attrLine(r.top_id, r.condition, r.attrs, r.category_id)}</div>
                  <div className="ti-l"><Labels r={r} />{r.media_count > 0 && <span className="lbl l-gy" title="Fotoğraflı"><Icon name="camera" size={11} /> {r.media_count}</span>}</div>
                </div>
              </div>
            </td>
            <td className="budget-cell"><div className="budget">{budgetTxt(r.budget_min, r.budget_max)}<small>bütçe</small></div></td>
            <td data-m="Kalan" className="nowrap">{leftTxt(r.expires_at)}</td>
            <td data-m="Tarih" className="nowrap muted">{dateTr(r.created_at)}</td>
            <td data-m="Konum" className="loc">{r.city}{r.district && <span className="loc-d muted">{r.district}{r.neighbourhood && ` / ${r.neighbourhood}`}</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function VitrinCard({ r }: { r: RequestItem }) {
  const t = theme(r.top_id);
  const { categories } = useSession();
  const icon = categories.find((c) => c.id === r.top_id)?.icon ?? "box";
  return (
    <Link className="vc" href={`/talep/${r.id}`}>
      <div className="vc-img" style={{ background: t.c, color: t.fc }}>{r.cover_url ? <img src={r.cover_url} alt="" loading="lazy" /> : <Icon name={icon} sw={1.5} />}<span className="vc-tag"><Labels r={r} /></span></div>
      <div className="vc-b">
        <div className="vc-t">{r.title}</div>
        <div className="vc-p">{fmt(r.budget_max)} TL&apos;ye kadar</div>
        <div className="vc-m"><span>{r.city}{r.district && ` / ${r.district}`}</span></div>
      </div>
    </Link>
  );
}

// Ana sayfa vitrini: sahibinden vitrini gibi küçük kare kutucuk + tek satır başlık.
export function VitrinTile({ r }: { r: RequestItem }) {
  const t = theme(r.top_id);
  const { categories } = useSession();
  const icon = categories.find((c) => c.id === r.top_id)?.icon ?? "box";
  return (
    <Link className="vt-i" href={`/talep/${r.id}`} title={r.title}>
      <span className="vt-img" style={{ background: t.c, color: t.fc }}>
        {r.cover_url ? <img src={r.cover_url} alt="" loading="lazy" /> : <Icon name={icon} size={34} sw={1.4} />}
        {r.is_featured && <span className="vt-star" aria-label="Öne çıkan">★</span>}
      </span>
      <span className="vt-t">{r.title}</span>
      <span className="vt-p">{fmt(r.budget_max)} TL</span>
    </Link>
  );
}
