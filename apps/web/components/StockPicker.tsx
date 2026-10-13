"use client";

import { useEffect, useState } from "react";
import { api, type Media } from "@/lib/api";
import { Icon } from "./Icon";

type Item = { id: number; title: string; marka: string | null; model: string | null; match: "model" | "marka" | "kategori"; media: Media };

// Alıcının elinde ürün yok: hayalindeki arabanın / evin görselini hazır galeriden seçer.
// Talepteki kategori ve araç seçimlerine uyan görseller önce gelir.
export function StockPicker({ category, attrs, onPick, onClose, onError }: {
  category: string; attrs: Record<string, unknown>; onPick: (m: Media) => void; onClose: () => void; onError: (msg: string) => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => {
    const araclar = (Array.isArray(attrs.araclar) ? attrs.araclar as { marka: string; model: string | null }[] : []).map((a) => `${a.marka}:${a.model ?? ""}`).join(",");
    const qs = new URLSearchParams({ category, ...(araclar ? { araclar } : {}) });
    void api<{ items: Item[] }>(`/stock-images?${qs}`).then((r) => setItems(r.items)).catch((e) => { onError((e as Error).message); setItems([]); });
  }, [category, attrs, onError]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const pick = async (it: Item) => {
    setBusy(it.id);
    try { onPick(await api<Media>(`/stock-images/${it.id}/use`, { body: {} })); onClose(); }
    catch (e) { onError((e as Error).message); } finally { setBusy(null); }
  };
  const best = items?.filter((x) => x.match !== "kategori") ?? [];
  const rest = items?.filter((x) => x.match === "kategori") ?? [];
  const grid = (list: Item[]) => (
    <div className="stk-grid">{list.map((it) => (
      <button key={it.id} type="button" className="stk-i" disabled={busy !== null} onClick={() => void pick(it)} aria-label={`${it.title || "Görsel"} seç`}>
        <img src={it.media.url} alt="" loading="lazy" />
        {(it.title || it.marka) && <span className="stk-t">{it.title || [it.marka, it.model].filter(Boolean).join(" ")}</span>}
        {busy === it.id && <span className="stk-busy"><span className="spinner" /></span>}
      </button>
    ))}</div>
  );
  return (
    <div className="ov show" onClick={onClose}>
      <div className="modal stk" role="dialog" aria-label="Hazır görsellerden seç" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><b>Hazır görsellerden seçin</b><button type="button" className="app-x" aria-label="Kapat" onClick={onClose}>×</button></div>
        <p className="muted" style={{ fontSize: 12.5, margin: "0 0 10px" }}>Elinizde fotoğraf yoksa almak istediğinize benzeyen bir görsel seçin; satıcılar ne aradığınızı hemen anlasın.</p>
        {!items ? <div className="loading">Yükleniyor…</div> : !items.length ? (
          <div className="empty" style={{ padding: "26px 10px" }}><Icon name="camera" size={22} /><br />Bu kategori için henüz hazır görsel yok. Kendi fotoğrafınızı ekleyebilir ya da fotoğrafsız devam edebilirsiniz.</div>
        ) : (
          <>
            {!!best.length && <><div className="stk-h">Talebinize uyanlar</div>{grid(best)}</>}
            {!!rest.length && <><div className="stk-h">{best.length ? "Bu kategorideki diğer görseller" : "Bu kategorideki görseller"}</div>{grid(rest)}</>}
          </>
        )}
      </div>
    </div>
  );
}
