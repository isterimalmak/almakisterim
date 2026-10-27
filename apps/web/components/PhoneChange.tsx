"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { PhoneVerify } from "./PhoneVerify";
import { useSession } from "./Session";

const fmt = (p: string) => p.replace(/^90(\d{3})(\d{3})(\d{2})(\d{2})$/, "0$1 $2 $3 $4");
const maskPhone = (p: string) => p.replace(/^90(\d{3})\d{3}(\d{2})(\d{2})$/, "0$1 *** $2 $3");
const maskMail = (e: string) => e.replace(/^(.{2}).*(@.*)$/, "$1***$2");

/**
 * Kayıtlı numarayı değiştirme: 1) mevcut numaraya ya da e-postaya gelen kodla kimlik doğrulanır,
 * 2) 15 dakika içinde yeni numaraya gelen kod girilir. Eski numaraya ve e-postaya bilgi gider; 7 günde bir değiştirilebilir.
 */
export function PhoneChange() {
  const { user, toast, refresh } = useSession();
  const [step, setStep] = useState<"idle" | "choose" | "code" | "new">("idle");
  const [via, setVia] = useState<"sms" | "email">("sms");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user?.phone) return null;
  const start = async (v: "sms" | "email") => {
    setBusy(true);
    try { await api("/me/phone/change/start", { body: { via: v } }); setVia(v); setCode(""); setStep("code"); toast(v === "sms" ? "Kod mevcut numaranıza gönderildi." : "Kod e-posta adresinize gönderildi."); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const confirm = async () => {
    setBusy(true);
    try { await api("/me/phone/change/confirm", { body: { via, code } }); setStep("new"); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <p>Doğrulanmış numaranız: <b>{fmt(user.phone)}</b>{step === "idle" && <> · <button type="button" className="link" onClick={() => setStep("choose")}>Numarayı değiştir</button></>}</p>
      {step === "choose" && (
        <div className="phone-change">
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>Güvenliğiniz için önce bu hesabın size ait olduğunu doğrulayalım. Doğrulama kodu nereye gönderilsin?</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-bl" disabled={busy} onClick={() => void start("sms")}>Mevcut numarama ({maskPhone(user.phone)})</button>
            {user.email && <button type="button" className="btn btn-wh" disabled={busy} onClick={() => void start("email")}>E-postama ({maskMail(user.email)})</button>}
            <button type="button" className="btn btn-gh" onClick={() => setStep("idle")}>Vazgeç</button>
          </div>
          {!user.email && <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Eski numaranıza erişiminiz yoksa <a className="link" href="/sayfa/iletisim">destek ekibimize</a> yazın.</p>}
        </div>
      )}
      {step === "code" && (
        <div className="phone-change form-grid" style={{ maxWidth: 520 }}>
          <div className="fg"><label htmlFor="pc-code">{via === "sms" ? "Mevcut numaranıza gelen kod" : "E-postanıza gelen kod"}</label>
            <input className="inp" id="pc-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
          <div className="fg"><label>&nbsp;</label><div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-bl" disabled={busy || code.length !== 6} onClick={() => void confirm()}>Doğrula</button>
            <button type="button" className="btn btn-gh" onClick={() => setStep("idle")}>Vazgeç</button></div></div>
        </div>
      )}
      {step === "new" && (
        <div className="phone-change">
          <div className="note n-ok" style={{ marginBottom: 10 }}><span>Kimliğiniz doğrulandı. 15 dakika içinde yeni numaranızı yazıp ona gelen kodu girin.</span></div>
          <PhoneVerify onDone={() => { setStep("idle"); void refresh(); toast("Telefon numaranız değiştirildi."); }} />
          <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Değişiklikten sonra eski numaranıza ve e-postanıza bilgilendirme gönderilir. Numaranızı 7 günde bir değiştirebilirsiniz.</p>
        </div>
      )}
    </>
  );
}
