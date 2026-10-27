"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "./Session";

// Üyelik Sözleşmesi'nin yürürlükteki sürümünü onaylamamış üyeye (yeni üye ya da metin güncellendi) gösterilir.
// Onay sürüm, tarih ve IP ile kaydedilir; onay olmadan talep verme, numara açma ve Güvenli Al kullanılamaz.
export function TermsGate() {
  const { user, refresh, toast } = useSession();
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!user || user.terms_ok !== false) return null;
  const save = async () => {
    setBusy(true);
    try {
      await api("/me/consents", { body: { terms: true, ...(marketing && !user.marketing ? { marketing: true } : {}), context: "onay-penceresi" } });
      await refresh();
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const logout = async () => { await api("/auth/logout", { body: {} }).catch(() => {}); window.location.href = "/"; };
  const doc = (slug: string, text: string) => <a className="link" href={`/sozlesmeler/${slug}`} target="_blank" rel="noreferrer">{text}</a>;
  return (
    <div className="terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-h">
      <div className="box"><div className="box-h"><h2 id="terms-h" style={{ fontSize: 16, color: "var(--navy)" }}>Sözleşme onayı</h2></div>
        <div className="box-b">
          <p style={{ lineHeight: 1.6 }}>almakisterim.com&apos;u kullanmaya devam etmek için Üyelik Sözleşmesi&apos;ni onaylamanız gerekiyor. Sözleşme şu ekleri de kapsar:</p>
          <ul>
            <li>{doc("talep-verme-kurallari", "Talep Verme Kuralları")}</li>
            <li>{doc("yasakli-urunler", "Yasaklı Ürün ve Hizmetler Listesi")}</li>
            <li>{doc("satici-kurallari", "Satıcı Kuralları")}</li>
          </ul>
          <label className="chk"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} aria-label="Üyelik Sözleşmesi'ni onaylıyorum" />
            <span>{doc("uyelik-sozlesmesi", "Üyelik Sözleşmesi")}&apos;ni ve eklerini okudum, kabul ediyorum. *</span></label>
          {!user.marketing && (
            <label className="chk"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} aria-label="Kampanya iletileri almak istiyorum" />
              <span>Kampanya ve yeniliklerden e-posta, SMS ve bildirimle haberdar olmak istiyorum ({doc("ticari-elektronik-ileti-onayi", "Ticari Elektronik İleti Onay Metni")}). <span className="muted">İsteğe bağlı.</span></span></label>
          )}
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>Kişisel verilerinizin nasıl işlendiğini {doc("kvkk-aydinlatma-metni", "KVKK Aydınlatma Metni")}&apos;nde ve {doc("cerez-politikasi", "Çerez Politikası")}&apos;nda okuyabilirsiniz.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" className="btn btn-or" disabled={!terms || busy} onClick={() => void save()}>{busy ? "Kaydediliyor…" : "Onayla ve devam et"}</button>
            <button type="button" className="btn btn-gh" onClick={() => void logout()}>Çıkış yap</button>
          </div>
        </div>
      </div>
    </div>
  );
}
