"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/Session";
import { api } from "@/lib/api";
import { dateTr } from "@/lib/format";

type Card = {
  user: { id: string; name: string; email: string | null; phone: string | null; role: string; credits: number; is_corporate: boolean; created_at: string; google: boolean; apple: boolean };
  edits: { id: number; field: string; old_value: string | null; new_value: string | null; note: string; created_at: string; admin_name: string | null }[];
  phone_changes: { old_phone: string; new_phone: string; identity_via: "sms" | "email"; completed_at: string }[];
};
const FIELD: Record<string, string> = { name: "Ad soyad", email: "E-posta", phone: "Telefon", is_corporate: "Kurumsal" };
// 905321234567 → 0532 123 45 67
const phoneTr = (p: string | null) => (p && /^90\d{10}$/.test(p) ? `0${p.slice(2, 5)} ${p.slice(5, 8)} ${p.slice(8, 10)} ${p.slice(10)}` : p ?? "");

// Yönetim → Üyeler: üyenin bilgilerini düzeltme. Neden yazmak zorunlu; her değişiklik geçmişte kalır.
export function UserEdit({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useSession();
  const [card, setCard] = useState<Card | null>(null);
  const [f, setF] = useState({ name: "", email: "", phone: "", is_corporate: false, note: "", logout: false });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const c = await api<Card>(`/admin/users/${id}`);
    setCard(c);
    setF({ name: c.user.name, email: c.user.email ?? "", phone: phoneTr(c.user.phone), is_corporate: c.user.is_corporate, note: "", logout: false });
  };
  useEffect(() => { void load().catch((e) => toast((e as Error).message)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!card) return <div className="box" style={{ marginBottom: 14 }}><div className="box-b muted">Yükleniyor…</div></div>;
  const u = card.user;
  const contactChanged = f.email.trim().toLowerCase() !== (u.email ?? "") || f.phone.replace(/\D/g, "").replace(/^0/, "90") !== (u.phone ?? "");

  const save = async () => {
    setBusy(true);
    try {
      // Yalnızca değişen alanlar gönderilir.
      const body: Record<string, unknown> = { note: f.note, logout: f.logout };
      if (f.name.trim() !== u.name) body.name = f.name;
      if (f.email.trim().toLowerCase() !== (u.email ?? "")) body.email = f.email;
      if (f.phone !== phoneTr(u.phone)) body.phone = f.phone;
      if (f.is_corporate !== u.is_corporate) body.is_corporate = f.is_corporate;
      const r = await api<{ changed: string[] }>(`/admin/users/${id}`, { method: "PATCH", body });
      toast(`Kaydedildi: ${r.changed.join(", ")}`);
      await load();
      onSaved();
    } catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="box" style={{ marginBottom: 14 }} role="region" aria-label="Üye bilgilerini düzenle">
      <div className="box-h"><h2>Üye bilgilerini düzenle: {u.name || "—"}</h2><button className="link" onClick={onClose}>Kapat</button></div>
      <div className="box-b">
        <div className="ti-s" style={{ marginBottom: 10 }}>Üyelik: {dateTr(u.created_at)} · Kredi: {u.credits}{u.google && " · Google ile bağlı"}{u.apple && " · Apple ile bağlı"}</div>
        <div className="form-grid" style={{ maxWidth: 640 }}>
          <div className="fg"><label htmlFor="ue-name">Ad soyad</label><input className="inp" id="ue-name" maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="fg"><label htmlFor="ue-phone">Cep telefonu</label><input className="inp" id="ue-phone" inputMode="tel" maxLength={30} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="05xx xxx xx xx" /></div>
          <div className="fg"><label htmlFor="ue-email">E-posta</label><input className="inp" id="ue-email" type="email" maxLength={254} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="fg"><label className="chk" style={{ marginTop: 26 }}><input type="checkbox" checked={f.is_corporate} onChange={(e) => setF({ ...f, is_corporate: e.target.checked })} />Kurumsal üye</label></div>
          <div className="fg full"><label htmlFor="ue-note">Değişikliğin nedeni (zorunlu)</label><input className="inp" id="ue-note" maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ör. Üye kimlik belgesiyle başvurdu, eski hattı kapandı" /></div>
          <div className="fg full"><label className="chk"><input type="checkbox" checked={f.logout} onChange={(e) => setF({ ...f, logout: e.target.checked })} />Üyenin açık oturumlarını kapat (bütün cihazlardan çıkış yapılır)</label></div>
        </div>
        {contactChanged && (
          <div className="note n-warn" style={{ margin: "10px 0" }}><span>Telefon veya e-postayı değiştirmeden önce kişinin hesabın gerçek sahibi olduğundan emin olun (ör. kayıtlı e-postadan yazması, kimlik belgesi). Değişiklik yapılınca eski numaraya / e-postaya bilgi mesajı gider.</span></div>
        )}
        <button className="btn btn-or" style={{ marginTop: 10 }} disabled={busy} onClick={save}>Üye bilgilerini kaydet</button>

        <h3 style={{ margin: "20px 0 8px", fontSize: 15 }}>Değişiklik geçmişi</h3>
        {card.edits.length || card.phone_changes.length ? (
          <table className="tbl"><thead><tr><th>Tarih</th><th>Bilgi</th><th>Eski → Yeni</th><th>Kim / Neden</th></tr></thead><tbody>
            {card.edits.map((e) => <tr key={`e${e.id}`}><td>{dateTr(e.created_at)}</td><td data-m="Bilgi">{FIELD[e.field] ?? e.field}</td>
              <td data-m="Eski → Yeni">{(e.field === "phone" ? phoneTr(e.old_value) : e.old_value) || "—"} → <b>{(e.field === "phone" ? phoneTr(e.new_value) : e.new_value) || "—"}</b></td>
              <td data-m="Kim / Neden">{e.admin_name || "Yönetici"}<div className="ti-s">{e.note}</div></td></tr>)}
            {card.phone_changes.map((p, i) => <tr key={`p${i}`}><td>{dateTr(p.completed_at)}</td><td data-m="Bilgi">Telefon</td>
              <td data-m="Eski → Yeni">{phoneTr(p.old_phone)} → <b>{phoneTr(p.new_phone)}</b></td>
              <td data-m="Kim / Neden">Üyenin kendisi<div className="ti-s">{p.identity_via === "sms" ? "Eski numarayla" : "E-postayla"} kimlik doğruladı</div></td></tr>)}
          </tbody></table>
        ) : <div className="muted">Henüz değişiklik yapılmadı.</div>}
      </div>
    </div>
  );
}
