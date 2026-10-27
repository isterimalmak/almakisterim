"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/Session";
import { api } from "@/lib/api";
import { dateTr } from "@/lib/format";

type Consent = { doc: string; title: string; version: string; granted: boolean; context: string | null; ip: string | null; user_agent: string | null; created_at: string };

/** Yönetim → Sözleşmeler: metinlerde görünen şirket bilgileri ve bir üyenin onay geçmişi. */
export function LegalAdmin() {
  const { toast } = useSession();
  const [fields, setFields] = useState<Record<string, string> | null>(null);
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [who, setWho] = useState<{ name: string; items: Consent[] } | null>(null);
  useEffect(() => {
    void api<{ fields: Record<string, string>; value: Record<string, string> }>("/admin/legal-info").then((d) => { setFields(d.fields); setV(d.value); }).catch((e) => toast((e as Error).message));
  }, [toast]);
  const save = async () => {
    setBusy(true);
    try { const d = await api<{ value: Record<string, string> }>("/admin/legal-info", { method: "PUT", body: v }); setV(d.value); toast("Şirket bilgileri kaydedildi; bütün sözleşmelerde görünür."); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const lookup = async () => {
    try {
      const u = (await api<{ items: { id: string; name: string }[] }>(`/admin/users?q=${encodeURIComponent(q)}`)).items[0];
      if (!u) { toast("Üye bulunamadı."); return; }
      setWho({ name: u.name, items: (await api<{ items: Consent[] }>(`/admin/users/${u.id}/consents`)).items });
    } catch (e) { toast((e as Error).message); }
  };
  const missing = fields ? Object.keys(fields).filter((k) => !v[k]?.trim()) : [];
  return (
    <>
      <div className="box" style={{ marginBottom: 14 }}><div className="box-h"><h2>Şirket bilgileri</h2><Link className="link" href="/sozlesmeler" target="_blank">Sözleşmeleri görüntüle »</Link></div><div className="box-b">
        <p className="muted" style={{ marginTop: 0, lineHeight: 1.6 }}>Bu bilgiler Üyelik Sözleşmesi, KVKK Aydınlatma Metni, Güvenli Al ve Mesafeli Satış Sözleşmesi gibi bütün metinlerde kullanılır. Boş bıraktığınız alanlar metinlerde köşeli parantezle görünür. Metinler yayından önce bir hukukçuya kontrol ettirilmelidir.</p>
        {missing.length > 0 && fields && <div className="note n-warn" style={{ marginBottom: 10 }}><span>Eksik: {missing.map((k) => fields[k]).join(", ")}</span></div>}
        {fields && <div className="form-grid">{Object.entries(fields).map(([k, label]) => (
          <div key={k} className={"fg" + (k === "adres" || k === "unvan" ? " full" : "")}><label htmlFor={`lg-${k}`}>{label}</label>
            <input id={`lg-${k}`} className="inp" maxLength={300} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></div>
        ))}</div>}
        <button type="button" className="btn btn-or" style={{ marginTop: 10 }} disabled={busy || !fields} onClick={() => void save()}>{busy ? "Kaydediliyor…" : "Kaydet"}</button>
      </div></div>
      <div className="box"><div className="box-h"><h2>Üye onay geçmişi</h2></div><div className="box-b">
        <form style={{ display: "flex", gap: 8, marginBottom: 12 }} onSubmit={(e) => { e.preventDefault(); void lookup(); }}>
          <input className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Üyenin telefonu, e-postası veya adı" aria-label="Onay geçmişi için üye" /><button className="btn btn-bl">Göster</button>
        </form>
        {who && (who.items.length ? (
          <table className="tbl"><thead><tr><th>{who.name}</th><th>Sürüm</th><th>Nerede</th><th>Tarih / IP</th></tr></thead><tbody>
            {who.items.map((c, i) => <tr key={i}><td><b>{c.title}</b> <span className={"lbl " + (c.granted ? "l-soft" : "l-acil")}>{c.granted ? "Onay" : "Geri alındı"}</span></td><td data-m="Sürüm">{c.version}</td><td data-m="Nerede">{c.context ?? "—"}</td>
              <td data-m="Tarih / IP">{dateTr(c.created_at)}<div className="ti-s" title={c.user_agent ?? ""}>{c.ip ?? "—"}</div></td></tr>)}
          </tbody></table>) : <div className="muted">{who.name} için onay kaydı yok.</div>)}
      </div></div>
    </>
  );
}
