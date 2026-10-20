"use client";

import { useEffect, useRef, useState } from "react";
import { api, uploadFile, type Media } from "@/lib/api";
import { Icon } from "./Icon";
import { StockPicker, StockStrip, useStockImages, type StockPhoto, type StockItem } from "./StockPicker";

// Sunucudaki sınırların aynısı; kullanıcı beklemeden uyarılsın diye tarayıcıda da kontrol edilir.
const TYPES: Record<string, "image" | "video"> = {
  "image/jpeg": "image", "image/png": "image", "image/webp": "image",
  "video/mp4": "video", "video/quicktime": "video", "video/webm": "video",
};
const MAX_MB = { image: 10, video: 100 };
const MAX_COUNT = { image: 8, video: 1 };

type Pending = { key: string; name: string; pct: number };
const NO_ATTRS: Record<string, unknown> = {};

export function MediaPicker({ value, onChange, label = "Fotoğraf / video ekle", onError, stock }: {
  value: Media[]; onChange: (m: Media[]) => void; label?: string; onError: (msg: string) => void;
  stock?: { category: string; attrs: Record<string, unknown> };
}) {
  const [gallery, setGallery] = useState(false);
  const [stockBusy, setStockBusy] = useState<number | null>(null);
  const { items: stockItems, photos, source } = useStockImages(stock?.category ?? "", stock?.attrs ?? NO_ATTRS);
  const usePick = async (it: StockItem) => {
    if (value.filter((m) => m.kind === "image").length >= MAX_COUNT.image) { onError(`En fazla ${MAX_COUNT.image} fotoğraf ekleyebilirsiniz.`); return; }
    setStockBusy(it.id);
    try { onChange([...current.current, await api<Media>(`/stock-images/${it.id}/use`, { body: {} })]); setGallery(false); }
    catch (e) { onError((e as Error).message); } finally { setStockBusy(null); }
  };
  const pickPhoto = async (p: StockPhoto) => {
    if (value.filter((m) => m.kind === "image").length >= MAX_COUNT.image) { onError(`En fazla ${MAX_COUNT.image} fotoğraf ekleyebilirsiniz.`); return; }
    setStockBusy(-p.id);
    try { onChange([...current.current, await api<Media>(`/stock-images/photos/${p.id}/use`, { body: {} })]); setGallery(false); }
    catch (e) { onError((e as Error).message); } finally { setStockBusy(null); }
  };
  const hasStock = !!stockItems?.length || photos.length > 0;
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const current = useRef(value);
  current.current = value;

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    const counts = { image: value.filter((m) => m.kind === "image").length, video: value.filter((m) => m.kind === "video").length };
    const ok: File[] = [];
    for (const f of Array.from(files)) {
      const kind = TYPES[f.type];
      if (!kind) { onError(`"${f.name}" desteklenmiyor. JPG, PNG, WEBP fotoğraf veya MP4, MOV, WEBM video seçin.`); continue; }
      if (f.size > MAX_MB[kind] * 1024 * 1024) { onError(`"${f.name}" çok büyük. ${kind === "image" ? "Fotoğraf" : "Video"} en fazla ${MAX_MB[kind]} MB olabilir.`); continue; }
      if (counts[kind] >= MAX_COUNT[kind]) { onError(kind === "image" ? `En fazla ${MAX_COUNT.image} fotoğraf ekleyebilirsiniz.` : "En fazla 1 video ekleyebilirsiniz."); continue; }
      counts[kind]++;
      ok.push(f);
    }
    if (input.current) input.current.value = "";
    await Promise.all(ok.map(async (f) => {
      const key = `${f.name}-${Math.random()}`;
      setPending((p) => [...p, { key, name: f.name, pct: 0 }]);
      try {
        const m = await uploadFile(f, (pct) => setPending((p) => p.map((x) => (x.key === key ? { ...x, pct } : x))));
        onChange([...current.current, m]);
      } catch (e) {
        onError((e as Error).message);
      } finally {
        setPending((p) => p.filter((x) => x.key !== key));
      }
    }));
  };

  const remove = async (m: Media) => {
    onChange(value.filter((x) => x.id !== m.id));
    await api(`/media/${m.id}`, { method: "DELETE" }).catch(() => { /* zaten silinmiş olabilir; günlük temizlik halleder */ });
  };

  const images = value.filter((m) => m.kind === "image").length;
  const full = images >= MAX_COUNT.image;
  const strip = stock && hasStock && !full && <StockStrip items={stockItems ?? []} photos={photos} source={source} busy={stockBusy} onPick={(it) => void usePick(it)} onPickPhoto={(p) => void pickPhoto(p)} onMore={() => setGallery(true)} />;
  return (
    // Talep verirken tek fotoğraf alanı: kendi fotoğrafını yükle ya da talebe uyan hazır görsellerden seç.
    <div className={stock ? "mp mp-one" : "mp"}>
      {stock && (
        <div className="mp-acts">
          <button type="button" className="mp-act" onClick={() => input.current?.click()} disabled={full && value.some((m) => m.kind === "video")}>
            <Icon name="camera" size={22} /><span><b>Kendi fotoğrafını yükle</b><small>Telefondan veya bilgisayardan</small></span>
          </button>
          {hasStock && (
            <button type="button" className="mp-act mp-act-st" onClick={() => setGallery(true)} disabled={full}>
              <Icon name="search" size={22} /><span><b>Hazır görsellerden seç</b><small>Ürününüz elinizde değilse örnek görsel</small></span>
            </button>
          )}
        </div>
      )}
      {strip}
      {(!stock || value.length > 0 || pending.length > 0) && (
        <div className="mp-grid">
          {value.map((m, i) => (
            <div key={m.id} className="mp-item">
              {m.kind === "image" ? <img src={m.url} alt={`Eklenen fotoğraf ${i + 1}`} /> : <video src={m.url} muted playsInline preload="metadata" aria-label="Eklenen video" />}
              {m.kind === "video" && <span className="mp-badge">Video</span>}
              {i === 0 && m.kind === "image" && <span className="mp-badge mp-cover">Kapak</span>}
              <button type="button" className="mp-x" aria-label="Kaldır" onClick={() => remove(m)}>×</button>
            </div>
          ))}
          {pending.map((p) => (
            <div key={p.key} className="mp-item mp-up" aria-label={`${p.name} yükleniyor`}><span className="spinner" /><small>%{p.pct}</small></div>
          ))}
          {!stock && (
            <button type="button" className="mp-add" onClick={() => input.current?.click()} disabled={full && value.some((m) => m.kind === "video")}>
              <Icon name="plus" size={20} /><span>{label}</span>
            </button>
          )}
        </div>
      )}
      {gallery && stock && <StockPicker category={stock.category} items={stockItems ?? []} photos={photos} source={source} busy={stockBusy} onClose={() => setGallery(false)} onPick={(it) => void usePick(it)} onPickPhoto={(p) => void pickPhoto(p)} />}
      <input ref={input} type="file" hidden multiple accept={Object.keys(TYPES).join(",")} aria-label={label} onChange={(e) => pick(e.target.files)} />
      <span className="hint">En fazla 8 fotoğraf (10 MB) ve 1 video (100 MB). İlk fotoğraf kapak olur. Fotoğraflarda telefon numarası veya adres görünmesin.</span>
    </div>
  );
}

// Tam ekran görüntüleyici: sayfadan çıkmadan büyük fotoğraf; oklar, kaydırma, Esc ve × ile kapanır.
export function Lightbox({ media, start, onClose }: { media: Media[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const n = media.length;
  const go = (d: number) => setI((k) => (k + d + n) % n);
  const touch = useRef<number | null>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); else if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", key);
    const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = o; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = media[i]!;
  return (
    <div className="lbx" role="dialog" aria-modal="true" aria-label="Fotoğraf görüntüleyici" onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={(e) => { touch.current = e.touches[0]!.clientX; }}
      onTouchEnd={(e) => { const x = touch.current; touch.current = null; if (x === null || n < 2) return; const dx = e.changedTouches[0]!.clientX - x; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}>
      <div className="lbx-top"><span>{i + 1} / {n}</span><button type="button" className="lbx-x" aria-label="Kapat" onClick={onClose}>×</button></div>
      <div className="lbx-stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {cur.kind === "image" ? <img src={cur.url} alt={`Fotoğraf ${i + 1}`} /> : <video src={cur.url} controls autoPlay playsInline aria-label="Video" />}
      </div>
      {n > 1 && <>
        <button type="button" className="lbx-nav l" aria-label="Önceki" onClick={() => go(-1)}><Icon name="chevl" size={26} sw={2.4} /></button>
        <button type="button" className="lbx-nav r" aria-label="Sonraki" onClick={() => go(1)}><Icon name="chevr" size={26} sw={2.4} /></button>
        <div className="lbx-thumbs">{media.map((m, k) => (
          <button key={m.id} type="button" className={k === i ? "on" : ""} aria-label={`${k + 1}. görsel`} onClick={() => setI(k)}>
            {m.kind === "image" ? <img src={m.url} alt="" /> : <span className="gal-vid"><Icon name="play" size={14} /></span>}
          </button>
        ))}</div>
      </>}
    </div>
  );
}

export function Gallery({ media, fallback }: { media: Media[]; fallback: React.ReactNode }) {
  const [i, setI] = useState(0);
  const [big, setBig] = useState(false);
  if (!media.length) return <>{fallback}</>;
  const cur = media[Math.min(i, media.length - 1)]!;
  return (
    <div className="gal">
      {big && <Lightbox media={media} start={Math.min(i, media.length - 1)} onClose={() => setBig(false)} />}
      <div className="gal-main">
        {cur.kind === "image"
          ? <button type="button" className="gal-open" aria-label="Fotoğrafı büyüt" onClick={() => setBig(true)}><img src={cur.url} alt="Talep fotoğrafı" /></button>
          : <video src={cur.url} controls playsInline preload="metadata" aria-label="Talep videosu" />}
        {media.length > 1 && <>
          <button type="button" className="gal-nav l" aria-label="Önceki görsel" onClick={() => setI((k) => (k - 1 + media.length) % media.length)}><Icon name="chevl" size={20} sw={2.4} /></button>
          <button type="button" className="gal-nav r" aria-label="Sonraki görsel" onClick={() => setI((k) => (k + 1) % media.length)}><Icon name="chevr" size={20} sw={2.4} /></button>
        </>}
        <span className="gal-count"><Icon name="camera" size={13} sw={2} /> {Math.min(i, media.length - 1) + 1}/{media.length}</span>
      </div>
      {media.length > 1 && (
        <div className="gal-thumbs">
          {media.map((m, k) => (
            <button key={m.id} type="button" className={k === i ? "on" : ""} onClick={() => setI(k)} aria-label={`${k + 1}. ${m.kind === "image" ? "fotoğraf" : "video"}`}>
              {m.kind === "image" ? <img src={m.url} alt="" /> : <span className="gal-vid"><Icon name="play" size={16} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Satırlarda küçük önizlemeler; tıklayınca tam ekran görüntüleyici açılır.
export function Thumbs({ media }: { media: Media[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!media.length) return null;
  return (
    <div className="o-media">
      {open !== null && <Lightbox media={media} start={open} onClose={() => setOpen(null)} />}
      {media.map((m, k) => (
        <button key={m.id} type="button" onClick={(e) => { e.stopPropagation(); setOpen(k); }} aria-label={`Ek ${m.kind === "image" ? "fotoğrafı" : "videosu"} ${k + 1}`}>
          {m.kind === "image" ? <img src={m.url} alt="" /> : <span className="gal-vid"><Icon name="play" size={14} /></span>}
        </button>
      ))}
    </div>
  );
}
