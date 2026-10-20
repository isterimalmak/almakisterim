"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/components/Session";
import { dateTr } from "@/lib/format";

// Bildirim Gönder: seçilen kitleye site içi bildirim (zil simgesinde görünür).
export function NotifyAdmin() {
  const { toast } = useSession();
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState<"all" | "buyers" | "sellers">("all");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const who = audience === "all" ? "bütün üyelere" : audience === "buyers" ? "talep veren üyelere" : "satıcılara";
    if (!confirm(`Bildirim ${who} gönderilsin mi?`)) return;
    setBusy(true);
    try {
      const r = await api<{ sent: number }>("/admin/notify", { body: { text, link, audience } });
      toast(`${r.sent} üyeye bildirim gönderildi.`);
      setText(""); setLink("");
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="ap-box"><div className="ap-box-h"><h2>Bildirim Gönder</h2></div><div className="ap-box-b">
      <div className="note n-info" style={{ marginBottom: 12 }}><span>Bildirim üyelerin sitedeki zil simgesine düşer. SMS ve e-posta gönderilmez.</span></div>
      <div className="form-grid" style={{ maxWidth: 620 }}>
        <div className="fg full"><label htmlFor="n-text">Bildirim metni *</label><textarea className="txa" id="n-text" rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="Örn. Bu hafta vasıta kategorisinde 120 yeni alıcı var!" /><span className="hint">{text.length}/300</span></div>
        <div className="fg full"><label htmlFor="n-link">Tıklayınca açılacak sayfa (isteğe bağlı)</label><input className="inp" id="n-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/kategori/vasita" /></div>
        <div className="fg full"><label>Kime</label><div className="radio-row">
          {([["all", "Bütün üyeler"], ["buyers", "Talep verenler"], ["sellers", "Satıcılar (numara açan / alarm kuran)"]] as const).map(([k, l]) => (
            <label key={k}><input type="radio" name="aud" checked={audience === k} onChange={() => setAudience(k)} />{l}</label>
          ))}
        </div></div>
      </div>
      <button className="btn btn-or" style={{ marginTop: 12 }} disabled={busy || text.trim().length < 3} onClick={() => void send()}>{busy ? "Gönderiliyor…" : "Bildirimi gönder"}</button>
    </div></div>
  );
}

type Ledger = { id: number; delta: number; reason: string; created_at: string; name: string; phone: string | null; email: string | null };
const REASON: Record<string, string> = { yonetici: "Yönetici tanımladı", numara: "Numara açma", numara_iade: "Numara iadesi" };

// Kredi Hareketleri: son 100 kredi kazanma/harcama kaydı.
export function CreditsAdmin() {
  const [items, setItems] = useState<Ledger[] | null>(null);
  useEffect(() => { void api<{ items: Ledger[] }>("/admin/credits").then((r) => setItems(r.items)).catch(() => setItems([])); }, []);
  return (
    <div className="ap-box"><div className="ap-box-h"><h2>Kredi Hareketleri (son 100)</h2></div>
      {!items ? <div className="loading">Yükleniyor…</div> : !items.length ? <div className="empty">Henüz kredi hareketi yok.</div> : (
        <table className="tbl"><thead><tr><th>Üye</th><th>Açıklama</th><th>Tarih</th><th className="r">Kredi</th></tr></thead><tbody>
          {items.map((l) => <tr key={l.id}><td>{l.name || "—"}<div className="ti-s">{l.phone ?? l.email}</div></td><td data-m="Açıklama">{REASON[l.reason] ?? l.reason}</td>
            <td data-m="Tarih" className="nowrap muted">{dateTr(l.created_at)}</td><td data-m="Kredi" className="r"><b style={{ color: l.delta < 0 ? "var(--red)" : "var(--green)" }}>{l.delta > 0 ? `+${l.delta}` : l.delta}</b></td></tr>)}
        </tbody></table>
      )}
    </div>
  );
}

type IField = { key: string; label: string; secret: boolean; placeholder: string; set: boolean; source: "panel" | "sunucu" | "yok"; updated_at: string | null; value?: string };
type IGroup = { id: string; name: string; note: string; help: string; connected: boolean; fields: IField[] };

// Entegrasyonlar: anahtarlar buradan girilir. Gizli alanlar kaydedildikten sonra bir daha gösterilmez (yalnızca "kayıtlı" yazar).
export function IntegrationsAdmin() {
  const [groups, setGroups] = useState<IGroup[] | null>(null);
  const load = async () => {
    try { setGroups((await api<{ groups: IGroup[] }>("/admin/integrations")).groups); }
    catch { setGroups([]); }
  };
  useEffect(() => { void load(); }, []);
  return (
    <>
      <div className="note n-info" style={{ marginBottom: 12 }}><span>
        Anahtarları ilgili hizmetin sitesinden kopyalayıp buraya yapıştırın ve <b>Kaydet</b>&apos;e basın; yaklaşık 1 dakika içinde devreye girer, yeniden yayına gerek yok.
        Güvenlik için kaydedilen anahtarlar şifreli saklanır ve bir daha gösterilmez. Sonra <b>Test et</b> ile çalıştığını görün.
      </span></div>
      {!groups ? <div className="loading">Yükleniyor…</div> : (
        <div className="integ-list">
          {groups.map((g) => <IntegCard key={g.id} g={g} reload={load} />)}
        </div>
      )}
    </>
  );
}

function IntegCard({ g, reload }: { g: IGroup; reload: () => Promise<void> }) {
  const { toast } = useSession();
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(g.fields.map((f) => [f.key, f.secret ? "" : f.value ?? ""])));
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const changed = g.fields.filter((f) => (vals[f.key] ?? "").trim() !== "" && (f.secret || (vals[f.key] ?? "").trim() !== (f.value ?? "")));
  const save = async () => {
    setBusy(true);
    try {
      for (const f of changed) await api(`/admin/integrations/${f.key}`, { method: "PUT", body: { value: vals[f.key] } });
      toast("Kaydedildi.");
      setVals((v) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, g.fields.find((f) => f.key === k)?.secret ? "" : x])));
      await reload();
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async (f: IField) => {
    if (!confirm(`"${f.label}" panelden silinsin mi?${f.source === "panel" ? " Sunucuda ayrı bir değer varsa o kullanılır." : ""}`)) return;
    try { await api(`/admin/integrations/${f.key}`, { method: "DELETE" }); toast("Silindi."); await reload(); } catch (e) { toast((e as Error).message); }
  };
  const run = async () => {
    setBusy(true); setTest(null);
    try { setTest(await api<{ ok: boolean; message: string }>(`/admin/integrations/${g.id}/test`, { body: {} })); }
    catch (e) { setTest({ ok: false, message: (e as Error).message }); } finally { setBusy(false); }
  };
  return (
    <div className={"ap-box integ-card" + (g.connected ? " on" : "")}>
      <div className="integ-h"><span className="ap-dot" aria-hidden="true" /><div><b>{g.name}</b><small>{g.note}</small></div>
        <span className={"lbl " + (g.connected ? "l-gr" : "l-gy")}>{g.connected ? "Bağlı" : "Bağlı değil"}</span></div>
      <div className="integ-b">
        <p className="integ-help">{g.help}</p>
        <div className="form-grid">
          {g.fields.map((f) => (
            <div key={f.key} className="fg">
              <label htmlFor={`i-${f.key}`}>{f.label}</label>
              <input id={`i-${f.key}`} className="inp" type={f.secret ? "password" : "text"} autoComplete="off" spellCheck={false} value={vals[f.key] ?? ""}
                placeholder={f.secret && f.set ? "•••••••• kayıtlı (değiştirmek için yenisini yazın)" : f.placeholder}
                onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} />
              <span className="hint">
                {f.set ? (f.source === "panel" ? `Kayıtlı · panelden${f.updated_at ? `, ${dateTr(f.updated_at)}` : ""}` : "Kayıtlı · sunucu ayarından") : "Girilmemiş"}
                {f.source === "panel" && <> · <button type="button" className="link" onClick={() => void remove(f)}>Sil</button></>}
              </span>
            </div>
          ))}
        </div>
        <div className="integ-act">
          <button type="button" className="btn btn-or" disabled={busy || !changed.length} onClick={() => void save()}>Kaydet</button>
          <button type="button" className="btn btn-bl" disabled={busy} onClick={() => void run()}>{busy ? "Bekleyin…" : "Test et"}</button>
        </div>
        {test && <div className={"note " + (test.ok ? "n-ok" : "n-warn")} style={{ marginTop: 10 }}><span><b>{test.ok ? "Çalışıyor." : "Çalışmıyor."}</b> {test.message}</span></div>}
      </div>
    </div>
  );
}
