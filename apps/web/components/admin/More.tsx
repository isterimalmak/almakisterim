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

type Integ = { key: string; name: string; connected: boolean; note: string };

// Entegrasyonlar: hangi dış hizmet bağlı; anahtarlar burada görünmez, Secret Manager'dan eklenir.
export function IntegrationsAdmin() {
  const [items, setItems] = useState<Integ[] | null>(null);
  useEffect(() => { void api<{ items: Integ[] }>("/admin/integrations").then((r) => setItems(r.items)).catch(() => setItems([])); }, []);
  return (
    <div className="ap-box"><div className="ap-box-h"><h2>Entegrasyonlar</h2></div><div className="ap-box-b">
      <div className="note n-info" style={{ marginBottom: 12 }}><span>Anahtarlar güvenlik için burada gösterilmez ve buradan girilmez; Google Cloud'daki anahtar kasasına eklenir, sonraki "Canlıya al"da bağlanır.</span></div>
      {!items ? <div className="loading">Yükleniyor…</div> : (
        <div className="ap-integ">{items.map((i) => (
          <div key={i.key} className={"ap-int" + (i.connected ? " on" : "")}>
            <span className="ap-dot" aria-hidden="true" />
            <div><b>{i.name}</b><small>{i.note}</small></div>
            <span className={"lbl " + (i.connected ? "l-gr" : "l-gy")}>{i.connected ? "Bağlı" : "Bağlı değil"}</span>
          </div>
        ))}</div>
      )}
    </div></div>
  );
}
