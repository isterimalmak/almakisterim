"use client";

import { useEffect, useRef, useState } from "react";
import { ago } from "@/lib/format";

export type ChatMsg = { id: number; mine: boolean; body: string; created_at: string; read: boolean };

// Tek bir konuşma: baloncuklar ve yazma kutusu.
export function Thread({ messages, onSend, canWrite = true, closedText, label = "Mesajınız" }: {
  messages: ChatMsg[]; onSend: (body: string) => Promise<void>; canWrite?: boolean; closedText?: string; label?: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages.length]);
  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try { await onSend(text.trim()); setText(""); } finally { setBusy(false); }
  };
  return (
    <div className="chat">
      {!!messages.length && (
        <div className="chat-list">
          {messages.map((m) => (
            <div key={m.id} className={"bub" + (m.mine ? " me" : "")}>
              <div className="bub-t">{m.body}</div>
              <div className="bub-m">{ago(m.created_at)}{m.mine && (m.read ? " · okundu" : "")}</div>
            </div>
          ))}
          <div ref={end} />
        </div>
      )}
      {canWrite ? (
        <form className="chat-in" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <textarea className="txa" rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} aria-label={label} placeholder="Mesajınızı yazın…"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) { e.preventDefault(); void send(); } }} />
          <button className="btn btn-or" disabled={busy || !text.trim()}>{busy ? "Gönderiliyor…" : "Gönder"}</button>
        </form>
      ) : closedText ? <div className="note n-info">{closedText}</div> : null}
    </div>
  );
}
