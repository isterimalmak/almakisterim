"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Icon } from "@/components/Icon";

type Totals = { users: number; users_today: number; active_requests: number; pending_review: number; requests_month: number;
  unlocks_month: number; credits_month: number; messages_today: number; open_reports: number };
type Recent = { kind: "uye" | "talep" | "numara" | "mesaj"; text: string; request_id: number | null; created_at: string };
export type DashboardData = { totals: Totals; users_7d: { d: string; n: number }[]; months: { m: string; requests: number; credits: number }[]; recent: Recent[] };

const DAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const KIND: Record<Recent["kind"], { label: string; icon: string; cls: string }> = {
  uye: { label: "Yeni üye", icon: "user", cls: "ak-uye" },
  talep: { label: "Yeni talep", icon: "list", cls: "ak-talep" },
  numara: { label: "Numara açıldı", icon: "phone", cls: "ak-numara" },
  mesaj: { label: "Yeni mesaj", icon: "chat", cls: "ak-mesaj" },
};
const when = (s: string) => new Date(s).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const fmt = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}b` : n.toLocaleString("tr-TR"));

// Sütun grafik: değer üstte, son sütun (bugün / bu ay) koyu renkte.
function Bars({ data, color }: { data: { label: string; n: number }[]; color: "or" | "gr" | "bl" }) {
  const max = Math.max(1, ...data.map((x) => x.n));
  return (
    <div className="ap-bars" role="img" aria-label={data.map((x) => `${x.label}: ${x.n}`).join(", ")}>
      {data.map((x, i) => (
        <div key={i} className="ap-bar">
          <b>{fmt(x.n)}</b>
          <span className={`ap-col c-${color}${i === data.length - 1 ? " last" : ""}`} style={{ height: `${Math.max(4, (x.n / max) * 100)}%` }} />
          <small>{x.label}</small>
        </div>
      ))}
    </div>
  );
}

export function Dashboard({ go }: { go: (section: string) => void }) {
  const [d, setD] = useState<DashboardData | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { void api<DashboardData>("/admin/dashboard").then(setD).catch((e) => setErr((e as Error).message)); }, []);
  if (err) return <div className="note n-warn">{err}</div>;
  if (!d) return <div className="loading">Yükleniyor…</div>;
  const t = d.totals;
  const actions = [
    { key: "den", icon: "check", label: `Talepleri Onayla${t.pending_review ? ` (${t.pending_review})` : ""}`, hot: t.pending_review > 0 },
    { key: "num", icon: "flag", label: `Şikâyetler${t.open_reports ? ` (${t.open_reports})` : ""}`, hot: t.open_reports > 0 },
    { key: "bil", icon: "bell", label: "Bildirim Gönder", hot: false },
    { key: "rek", icon: "play", label: "Reklam Ekle", hot: false },
  ];
  const cards = [
    { icon: "user", label: "Toplam Üye", value: t.users, sub: `Bugün +${t.users_today}`, tone: "or" },
    { icon: "list", label: "Yayındaki Talep", value: t.active_requests, sub: `İncelemede ${t.pending_review}`, tone: "gr" },
    { icon: "bolt", label: "Bu Ay Talep", value: t.requests_month, sub: "Bu ay açılan", tone: "bl" },
    { icon: "phone", label: "Bu Ay Açılan Numara", value: t.unlocks_month, sub: `${t.credits_month} kredi harcandı`, tone: "pu" },
    { icon: "chat", label: "Bugün Mesaj", value: t.messages_today, sub: "Alıcı-satıcı yazışması", tone: "rd" },
  ];
  return (
    <>
      <div className="ap-acts">{actions.map((a) => (
        <button key={a.key} type="button" className={"ap-act" + (a.hot ? " hot" : "")} onClick={() => go(a.key)}>
          <Icon name={a.icon} size={22} /><b>{a.label}</b>
        </button>
      ))}</div>
      <div className="ap-cards">{cards.map((c) => (
        <div key={c.label} className={`ap-card t-${c.tone}`}>
          <span className="ap-ic"><Icon name={c.icon} size={18} /></span>
          <b>{fmt(c.value)}</b>
          <span className="ap-lbl">{c.label}</span>
          <small>{c.sub}</small>
        </div>
      ))}</div>
      <div className="ap-box"><div className="ap-box-h"><h2>Son 7 Gün — Yeni Üye</h2></div>
        <Bars color="or" data={d.users_7d.map((x, i) => ({ label: i === d.users_7d.length - 1 ? "Bugün" : DAYS[new Date(`${x.d}T12:00:00`).getDay()]!, n: x.n }))} />
      </div>
      <div className="ap-grid2">
        <div className="ap-box"><div className="ap-box-h"><h2>Aylık Talepler</h2></div>
          <Bars color="gr" data={d.months.map((x) => ({ label: MONTHS[Number(x.m.slice(5)) - 1]!, n: x.requests }))} />
        </div>
        <div className="ap-box"><div className="ap-box-h"><h2>Aylık Harcanan Kredi</h2></div>
          <Bars color="bl" data={d.months.map((x) => ({ label: MONTHS[Number(x.m.slice(5)) - 1]!, n: x.credits }))} />
        </div>
      </div>
      <div className="ap-box"><div className="ap-box-h"><h2>Son Hareketler</h2></div>
        {d.recent.length ? <ul className="ap-feed">{d.recent.map((r, i) => {
          const k = KIND[r.kind];
          return (
            <li key={i}>
              <span className={`ap-fic ${k.cls}`}><Icon name={k.icon} size={14} /></span>
              <span className="ap-ftx"><b>{k.label}</b>{" "}{r.request_id ? <Link className="link" href={`/talep/${r.request_id}`}>{r.text}</Link> : r.text}</span>
              <time>{when(r.created_at)}</time>
            </li>
          );
        })}</ul> : <div className="empty">Henüz hareket yok.</div>}
      </div>
    </>
  );
}
