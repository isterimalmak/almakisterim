"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/Session";
import { api } from "@/lib/api";

function Login() {
  const { refresh, toast } = useSession();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("sonra")?.startsWith("/") ? sp.get("sonra")! : "/";
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [target, setTarget] = useState("");
  const [name, setName] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void api<{ google: boolean }>("/auth/providers").then((p) => setGoogle(p.google)).catch(() => {}); }, []);
  useEffect(() => { if (sp.get("hata") === "google") toast("Google ile giriş tamamlanamadı, tekrar deneyin."); }, [sp, toast]);

  const send = async () => {
    setBusy(true);
    try {
      const r = await api<{ sent_to: string }>("/auth/code", { body: { channel, target } });
      setSentTo(r.sent_to);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true);
    try {
      await api("/auth/verify", { body: { channel, target, code, name: name.trim() || undefined } });
      await refresh();
      toast("Giriş yapıldı. Hoş geldiniz.");
      router.push(next);
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="wrap" style={{ maxWidth: 440, padding: "30px 16px 60px" }}>
      <div className="box">
        <div className="box-h"><h2>Giriş Yap veya Hesap Aç</h2></div>
        <div className="box-b">
          {google && (
            <>
              <a className="g-btn" href="/api/auth/google">
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
                Google ile devam et
              </a>
              <div className="or">veya</div>
            </>
          )}
          {!sentTo ? (
            <form onSubmit={(e) => { e.preventDefault(); void send(); }}>
              <div className="res-bar" style={{ border: "1px solid var(--line)", borderRadius: 4, marginBottom: 12, padding: 0 }}>
                <div className="tabs" style={{ width: "100%" }}>
                  <button type="button" style={{ flex: 1 }} className={channel === "sms" ? "on" : ""} onClick={() => { setChannel("sms"); setTarget(""); }}>Cep telefonu</button>
                  <button type="button" style={{ flex: 1 }} className={channel === "email" ? "on" : ""} onClick={() => { setChannel("email"); setTarget(""); }}>E-posta</button>
                </div>
              </div>
              <div className="fg"><label htmlFor="l-v">{channel === "sms" ? "Cep telefonu" : "E-posta adresi"}</label>
                <input className="inp" id="l-v" style={{ height: 42 }} value={target} onChange={(e) => setTarget(e.target.value)} type={channel === "sms" ? "tel" : "email"} inputMode={channel === "sms" ? "tel" : "email"} autoComplete={channel === "sms" ? "tel" : "email"} placeholder={channel === "sms" ? "05xx xxx xx xx" : "ornek@mail.com"} required />
              </div>
              <button className="btn btn-or btn-lg btn-block" style={{ marginTop: 10 }} disabled={busy}>{channel === "sms" ? "SMS ile kod gönder" : "E-posta ile kod gönder"}</button>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); void verify(); }}>
              <p style={{ fontSize: 13, marginBottom: 10 }}><b>{sentTo}</b> adresine gönderilen 6 haneli kodu girin.</p>
              <div className="fg"><label htmlFor="l-c">Doğrulama kodu</label><input ref={codeRef} className="inp" id="l-c" style={{ height: 46, fontSize: 20, letterSpacing: 6, textAlign: "center" }} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required /></div>
              <div className="fg" style={{ marginTop: 10 }}><label htmlFor="l-n">Adınız soyadınız (ilk girişte)</label><input className="inp" id="l-n" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" /></div>
              <button className="btn btn-or btn-lg btn-block" style={{ marginTop: 12 }} disabled={busy || code.length !== 6}>Giriş yap</button>
              <button type="button" className="btn btn-gh btn-sm" style={{ marginTop: 8 }} onClick={() => { setSentTo(""); setCode(""); }}>Numarayı / e-postayı değiştir</button>
            </form>
          )}
          <p className="muted" style={{ fontSize: 11.5, marginTop: 14 }}>Devam ederek Kullanım Koşulları&apos;nı ve KVKK Aydınlatma Metni&apos;ni kabul etmiş olursunuz.</p>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="loading">Yükleniyor…</div>}><Login /></Suspense>;
}
