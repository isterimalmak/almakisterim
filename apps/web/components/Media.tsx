"use client";

import { useRef, useState } from "react";
import { api, uploadFile, type Media } from "@/lib/api";
import { Icon } from "./Icon";

// Sunucudaki sınırların aynısı; kullanıcı beklemeden uyarılsın diye tarayıcıda da kontrol edilir.
const TYPES: Record<string, "image" | "video"> = {
  "image/jpeg": "image", "image/png": "image", "image/webp": "image",
  "video/mp4": "video", "video/quicktime": "video", "video/webm": "video",
};
const MAX_MB = { image: 10, video: 100 };
const MAX_COUNT = { image: 8, video: 1 };

type Pending = { key: string; name: string; pct: number };

export function MediaPicker({ value, onChange, label = "Fotoğraf / video ekle", onError }: {
  value: Media[]; onChange: (m: Media[]) => void; label?: string; onError: (msg: string) => void;
}) {
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
  return (
    <div className="mp">
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
        <button type="button" className="mp-add" onClick={() => input.current?.click()} disabled={images >= MAX_COUNT.image && value.some((m) => m.kind === "video")}>
          <Icon name="plus" size={20} /><span>{label}</span>
        </button>
      </div>
      <input ref={input} type="file" hidden multiple accept={Object.keys(TYPES).join(",")} aria-label={label} onChange={(e) => pick(e.target.files)} />
      <span className="hint">En fazla 8 fotoğraf (10 MB) ve 1 video (100 MB). İlk fotoğraf kapak olur. Fotoğraflarda telefon numarası veya adres görünmesin.</span>
    </div>
  );
}

export function Gallery({ media, fallback }: { media: Media[]; fallback: React.ReactNode }) {
  const [i, setI] = useState(0);
  if (!media.length) return <>{fallback}</>;
  const cur = media[Math.min(i, media.length - 1)]!;
  return (
    <div className="gal">
      <div className="gal-main">
        {cur.kind === "image"
          ? <a href={cur.url} target="_blank" rel="noreferrer"><img src={cur.url} alt="Talep fotoğrafı" /></a>
          : <video src={cur.url} controls playsInline preload="metadata" aria-label="Talep videosu" />}
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

// Satırlarda küçük önizlemeler; tıklayınca dosya yeni sekmede açılır.
export function Thumbs({ media }: { media: Media[] }) {
  if (!media.length) return null;
  return (
    <div className="o-media">
      {media.map((m, k) => (
        <a key={m.id} href={m.url} target="_blank" rel="noreferrer" aria-label={`Ek ${m.kind === "image" ? "fotoğrafı" : "videosu"} ${k + 1}`}>
          {m.kind === "image" ? <img src={m.url} alt="" /> : <span className="gal-vid"><Icon name="play" size={14} /></span>}
        </a>
      ))}
    </div>
  );
}
