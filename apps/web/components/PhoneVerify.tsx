"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "./Session";

// Hesaba SMS koduyla telefon ekler. Talep vermek için doğrulanmış numara gerekir.
export function PhoneVerify({ onDone }: { onDone?: () => void }) {
  const { toast, refresh } = useSession();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try { await api("/me/phone/code", { body: { phone } }); setSent(true); toast("Doğrulama kodu SMS ile gönderildi."); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true);
    try { await api("/me/phone/verify", { body: { phone, code } }); toast("Telefon numaranız doğrulandı."); await refresh(); onDone?.(); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="form-grid" style={{ maxWidth: 520 }}>
      <div className="fg"><label htmlFor="pv-phone">Cep telefonu</label><input className="inp" id="pv-phone" inputMode="tel" placeholder="05xx xxx xx xx" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent} /></div>
      {sent
        ? <div className="fg"><label htmlFor="pv-code">SMS doğrulama kodu</label><input className="inp" id="pv-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
        : <div className="fg"><label>&nbsp;</label><button type="button" className="btn btn-bl" disabled={busy || phone.replace(/\D/g, "").length < 10} onClick={send}>Kod gönder</button></div>}
      {sent && (
        <div className="fg full" style={{ flexDirection: "row", gap: 8, display: "flex" }}>
          <button type="button" className="btn btn-bl" disabled={busy || code.length !== 6} onClick={verify}>Doğrula</button>
          <button type="button" className="btn btn-wh" onClick={() => { setSent(false); setCode(""); }}>Numarayı değiştir</button>
        </div>
      )}
    </div>
  );
}
