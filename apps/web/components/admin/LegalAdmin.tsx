"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/Session";
import { api } from "@/lib/api";
import { dateTr } from "@/lib/format";

type Doc = { slug: string; title: string; summary: string; version: string; effective: string; consent?: boolean; sections: { h: string; p: string[] }[] };
type Version = { version: string; effective: string; reconsent: boolean; note: string | null; created_at: string | null };
// Düzenlerken her bölüm: başlık + paragraflar (aralarında boş satır).
type Sec = { h: string; text: string };
const toSecs = (d: Doc): Sec[] => d.sections.map((x) => ({ h: x.h, text: x.p.join("\n\n") }));
const fromSecs = (xs: Sec[]) => xs.map((x) => ({ h: x.h.trim(), p: x.text.split(/\n\s*\n/).map((t) => t.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean) }));

/** Bir sözleşme metninin maddelerini düzenler; her kayıt yeni sürüm olur, eski sürümler saklanır. */
function LegalEditor() {
  const { toast } = useSession();
  const [list, setList] = useState<{ slug: string; title: string }[]>([]);
  const [slug, setSlug] = useState("uyelik-sozlesmesi");
  const [doc, setDoc] = useState<Doc | null>(null);
  const [secs, setSecs] = useState<Sec[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [change, setChange] = useState<"kucuk" | "esasli">("kucuk");
  const [effective, setEffective] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api<{ items: { slug: string; title: string }[] }>("/legal?tum=1").then((d) => setList(d.items)).catch(() => {}); }, []);
  useEffect(() => {
    void api<{ doc: Doc; versions: Version[] }>(`/admin/legal/${slug}`).then((d) => { setDoc(d.doc); setSecs(toSecs(d.doc)); setVersions(d.versions); setNote(""); setEffective(""); setChange("kucuk"); })
      .catch((e) => toast((e as Error).message));
  }, [slug, toast]);
  if (!doc) return null;
  const set = (i: number, x: Partial<Sec>) => setSecs(secs.map((y, k) => (k === i ? { ...y, ...x } : y)));
  const mv = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= secs.length) return; const ys = [...secs]; [ys[i], ys[j]] = [ys[j]!, ys[i]!]; setSecs(ys); };
  const save = async () => {
    if (change === "esasli" && doc.consent && !confirm("Esaslı değişiklik: bütün üyelerden bu metni yeniden onaylamaları istenecek. Devam edilsin mi?")) return;
    setBusy(true);
    try {
      const d = await api<{ doc: Doc; versions: Version[] }>(`/admin/legal/${slug}`, { method: "PUT", body: { title: doc.title, summary: doc.summary, sections: fromSecs(secs), change, ...(effective ? { effective } : {}), ...(note.trim() ? { note: note.trim() } : {}) } });
      setDoc(d.doc); setSecs(toSecs(d.doc)); setVersions(d.versions); setNote("");
      toast(`Kaydedildi: sürüm ${d.doc.version}.`);
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="box" style={{ marginBottom: 14 }}><div className="box-h"><h2>Metinleri düzenle</h2><a className="link" href={`/sozlesmeler/${slug}`} target="_blank" rel="noreferrer">Sitede görüntüle »</a></div><div className="box-b">
      <div className="form-grid">
        <div className="fg"><label htmlFor="le-doc">Metin</label><select id="le-doc" className="sel" value={slug} onChange={(e) => setSlug(e.target.value)}>{list.map((d) => <option key={d.slug} value={d.slug}>{d.title}</option>)}</select></div>
        <div className="fg"><label>Yürürlükteki sürüm</label><div style={{ padding: "8px 0" }}><b>{doc.version}</b> · {doc.effective}{doc.consent ? " · üye onayı gerektirir" : ""}</div></div>
        <div className="fg full"><label htmlFor="le-t">Başlık</label><input id="le-t" className="inp" maxLength={150} value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} /></div>
        <div className="fg full"><label htmlFor="le-s">Kısa açıklama</label><input id="le-s" className="inp" maxLength={400} value={doc.summary} onChange={(e) => setDoc({ ...doc, summary: e.target.value })} /></div>
      </div>
      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>Paragraflar arasında bir boş satır bırakın; madde işaretli satırı &quot;• &quot; ile başlatın. <code>{"{{UNVAN}}"}</code>, <code>{"{{ADRES}}"}</code>, <code>{"{{EPOSTA}}"}</code>, <code>{"{{KEP}}"}</code>, <code>{"{{MERSIS}}"}</code>, <code>{"{{VERGI}}"}</code>, <code>{"{{TELEFON}}"}</code>, <code>{"{{YETKILI_YER}}"}</code> şirket bilgileriyle; <code>{"{{GA_SATICI}}"}</code> gibi olanlar Güvenli Al ayarlarıyla doldurulur.</p>
      {secs.map((x, i) => (
        <div key={i} className="le-sec">
          <div className="ft-row">
            <input className="inp" aria-label={`${i + 1}. bölüm başlığı`} value={x.h} maxLength={200} onChange={(e) => set(i, { h: e.target.value })} />
            <button type="button" className="btn btn-wh btn-sm" aria-label={`${i + 1}. bölümü yukarı al`} onClick={() => mv(i, -1)}>↑</button>
            <button type="button" className="btn btn-wh btn-sm" aria-label={`${i + 1}. bölümü aşağı al`} onClick={() => mv(i, 1)}>↓</button>
            <button type="button" className="btn btn-wh btn-sm" aria-label={`${i + 1}. bölümü sil`} onClick={() => { if (confirm(`"${x.h}" bölümü silinsin mi?`)) setSecs(secs.filter((_, k) => k !== i)); }}>✕</button>
          </div>
          <textarea className="txa" aria-label={`${i + 1}. bölüm metni`} rows={Math.min(14, 3 + x.text.split("\n").length)} value={x.text} onChange={(e) => set(i, { text: e.target.value })} />
        </div>
      ))}
      <button type="button" className="btn btn-wh btn-sm" onClick={() => setSecs([...secs, { h: `${secs.length + 1}. Yeni bölüm`, text: "" }])}>+ Bölüm ekle</button>
      <div className="le-save">
        <div className="radio-row">
          <label><input type="radio" name="le-c" checked={change === "kucuk"} onChange={() => setChange("kucuk")} />Küçük düzeltme (yazım, açıklama) — sürüm {doc.version.split(".")[0]}.{Number(doc.version.split(".")[1] ?? 0) + 1}, yeniden onay istenmez</label>
          <label><input type="radio" name="le-c" checked={change === "esasli"} onChange={() => setChange("esasli")} />Esaslı değişiklik (hak ve yükümlülükler) — sürüm {Number(doc.version.split(".")[0]) + 1}.0{doc.consent ? ", üyelerden yeniden onay istenir" : ""}</label>
        </div>
        {change === "esasli" && doc.consent && <div className="note n-warn"><span>Üyelik Sözleşmesi&apos;nin 15. maddesi gereği esaslı değişiklikleri yürürlükten en az 7 gün önce üyelere duyurun (Bildirim Gönder veya E-posta Stüdyosu) ve yürürlük tarihini buna göre seçin.</span></div>}
        <div className="form-grid">
          <div className="fg"><label htmlFor="le-e">Yürürlük tarihi</label><input id="le-e" className="inp" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} /><span className="hint">Boş bırakılırsa bugün.</span></div>
          <div className="fg"><label htmlFor="le-n">Değişiklik notu (yalnızca yönetimde)</label><input id="le-n" className="inp" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. Güvenli Al iade süresi güncellendi" /></div>
        </div>
        <button type="button" className="btn btn-or" disabled={busy} onClick={() => void save()}>{busy ? "Kaydediliyor…" : "Yeni sürüm olarak kaydet"}</button>
      </div>
      <h3 style={{ fontSize: 14, margin: "16px 0 6px" }}>Sürüm geçmişi</h3>
      <table className="tbl"><tbody>{versions.map((v) => (
        <tr key={v.version}><td><a className="link" href={`/sozlesmeler/${slug}?v=${v.version}`} target="_blank" rel="noreferrer">Sürüm {v.version}</a>{v.reconsent && <span className="lbl l-acil" style={{ marginLeft: 6 }}>Yeniden onay</span>}</td><td>{v.effective}</td><td className="muted">{v.note ?? ""}</td></tr>
      ))}</tbody></table>
    </div></div>
  );
}

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
      <LegalEditor />
      <div className="box" style={{ marginBottom: 14 }}><div className="box-h"><h2>Şirket bilgileri</h2><Link className="link" href="/sozlesmeler" target="_blank">Sözleşmeleri görüntüle »</Link></div><div className="box-b">
        <p className="muted" style={{ marginTop: 0, lineHeight: 1.6 }}>Bu bilgiler Üyelik Sözleşmesi, KVKK Aydınlatma Metni, Güvenli Al ve Mesafeli Satış Sözleşmesi gibi bütün metinlerde kullanılır. Boş bıraktığınız alanlar metinlerde köşeli parantezle görünür. Metinler yayından önce bir hukukçuya kontrol ettirilmelidir.</p>
        {missing.length > 0 && fields && <div className="note n-warn" style={{ marginBottom: 10 }}><span>Eksik: {missing.map((k) => fields[k]).join(", ")}</span></div>}
        {fields && <div className="form-grid">{Object.entries(fields).map(([k, label]) => (
          <div key={k} className={"fg" + (k === "adres" || k === "unvan" ? " full" : "")}><label htmlFor={`lg-${k}`}>{label}</label>
            <input id={`lg-${k}`} className="inp" maxLength={300} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></div>
        ))}</div>}
        <button type="button" className="btn btn-or" style={{ marginTop: 10 }} disabled={busy || !fields} onClick={() => void save()}>{busy ? "Kaydediliyor…" : "Şirket bilgilerini kaydet"}</button>
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
