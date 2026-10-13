"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type Media } from "@/lib/api";
import { Icon } from "./Icon";
import { useSession } from "./Session";

export type StockPhoto = { id: number; thumb: string; alt: string; photographer: string; photographer_url: string; page_url: string };
export type PhotoSource = { name: string; url: string };
export type StockItem = { id: number; title: string; category_id: string; marka: string | null; model: string | null; match: "model" | "marka" | "kategori"; media: Media };

// Görselin adı her yerde aynı kuralla: "Marka Model" (araçta), yoksa kategori adı; yöneticinin açıklaması altta.
export function useStockNames() {
  const { categories } = useSession();
  return useMemo(() => {
    const names = new Map<string, string>();
    for (const t of categories) { names.set(t.id, t.name); for (const s of t.subs) names.set(s.id, s.name); }
    const path = (id: string) => {
      const t = categories.find((c) => c.id === id || c.subs.some((s) => s.id === id));
      const s = t?.subs.find((x) => x.id === id);
      return [t?.name, s?.name].filter(Boolean).join(" › ");
    };
    return { label: (it: Pick<StockItem, "marka" | "model" | "category_id">) => [it.marka, it.model].filter(Boolean).join(" ") || names.get(it.category_id) || "Görsel", path };
  }, [categories]);
}

// Talebe uyan hazır görseller: kategori, marka ve model seçildikçe sunucudan yeniden istenir.
export function useStockImages(category: string, attrs: Record<string, unknown>) {
  const [items, setItems] = useState<StockItem[] | null>(null);
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [source, setSource] = useState<PhotoSource | null>(null);
  const key = (Array.isArray(attrs.araclar) ? attrs.araclar as { marka: string; model: string | null }[] : []).map((a) => `${a.marka}:${a.model ?? ""}`).join(",");
  useEffect(() => {
    if (!category) { setItems([]); setPhotos([]); setSource(null); return; }
    let on = true;
    const qs = new URLSearchParams({ category, ...(key ? { araclar: key } : {}) });
    void api<{ items: StockItem[]; photos?: StockPhoto[]; photo_source?: PhotoSource | null }>(`/stock-images?${qs}`)
      .then((r) => { if (on) { setItems(r.items); setPhotos(r.photos ?? []); setSource(r.photo_source ?? null); } }).catch(() => on && setItems([]));
    return () => { on = false; };
  }, [category, key]);
  return { items, photos, source };
}

// Fotoğraf bölümünün altında: girilen bilgilere uyan görseller kendiliğinden çıkar, tek dokunuşla eklenir.
export function StockStrip({ items, photos, source, onPick, onPickPhoto, onMore, busy }: {
  items: StockItem[]; photos: StockPhoto[]; source: PhotoSource | null; onPick: (it: StockItem) => void; onPickPhoto: (p: StockPhoto) => void; onMore: () => void; busy: number | null;
}) {
  const { label } = useStockNames();
  const best = items.filter((x) => x.match !== "kategori");
  // Önce kendi galerimizdeki uyanlar; yoksa ücretsiz fotoğraf kaynağından bulunanlar; o da yoksa kategorinin görselleri.
  const own = best.length ? best : photos.length ? [] : items;
  const shown = own.slice(0, 6);
  const shownPhotos = photos.slice(0, 6 - shown.length);
  if (!shown.length && !shownPhotos.length) return null;
  return (
    <div className="stk-strip">
      <div className="stk-strip-h"><b>{best.length || photos.length ? "Talebinize uygun hazır görseller" : "Bu kategori için hazır görseller"}</b><button type="button" className="link" onClick={onMore}>Tümünü gör ({items.length + photos.length}) ›</button></div>
      <div className="stk-row">{shown.map((it) => (
        <button key={it.id} type="button" className="stk-i" disabled={busy !== null} onClick={() => onPick(it)} aria-label={`${label(it)} görselini ekle`}>
          <img src={it.media.url} alt="" loading="lazy" />
          <span className="stk-t">{label(it)}</span>
          <span className="stk-plus" aria-hidden="true">+</span>
          {busy === it.id && <span className="stk-busy"><span className="spinner" /></span>}
        </button>
      ))}
      {shownPhotos.map((p) => <PhotoTile key={`p${p.id}`} p={p} src={source} busy={busy} onPick={onPickPhoto} />)}
      </div>
      {!!shownPhotos.length && source && <div className="stk-credit">Fotoğraflar: <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> (ücretsiz kullanım)</div>}
    </div>
  );
}

function PhotoTile({ p, src, busy, onPick, add = true }: { p: StockPhoto; src: PhotoSource | null; busy: number | null; onPick: (p: StockPhoto) => void; add?: boolean }) {
  const by = [p.photographer, src?.name].filter(Boolean).join(" / ");
  return (
    <button type="button" className="stk-i" disabled={busy !== null} onClick={() => onPick(p)} aria-label={`${p.alt || "Fotoğraf"} görselini ekle`} title={`Fotoğraf: ${by}`}>
      <img src={p.thumb} alt="" loading="lazy" />
      <span className="stk-t"><small>{by}</small></span>
      {add && <span className="stk-plus" aria-hidden="true">+</span>}
      {busy === -p.id && <span className="stk-busy"><span className="spinner" /></span>}
    </button>
  );
}

// Tüm galeri: kategori adıyla başlık, marka ve model sekmeleriyle gezinme.
export function StockPicker({ category, items, photos, source, onPick, onPickPhoto, onClose, busy }: {
  category: string; items: StockItem[]; photos: StockPhoto[]; source: PhotoSource | null; onPick: (it: StockItem) => void; onPickPhoto: (p: StockPhoto) => void; onClose: () => void; busy: number | null;
}) {
  const { label, path } = useStockNames();
  const best = items.filter((x) => x.match !== "kategori");
  const brands = [...new Set(items.map((x) => x.marka).filter(Boolean))] as string[];
  const [tab, setTab] = useState<string>(best.length ? "__oneri" : "");
  const [model, setModel] = useState("");
  const models = tab && tab !== "__oneri" ? [...new Set(items.filter((x) => x.marka === tab).map((x) => x.model).filter(Boolean))] as string[] : [];
  const list = tab === "__oneri" ? best : tab ? items.filter((x) => x.marka === tab && (!model || x.model === model)) : items;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const chip = (on: boolean, text: string, fn: () => void) => <button type="button" className={"chip" + (on ? " on" : "")} aria-pressed={on} onClick={fn}>{text}</button>;
  return (
    <div className="ov show" onClick={onClose}>
      <div className="modal stk" role="dialog" aria-label="Hazır görsellerden seç" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><div><b>Hazır görseller</b><div className="muted" style={{ fontSize: 12 }}>{path(category)}</div></div><button type="button" className="app-x" aria-label="Kapat" onClick={onClose}>×</button></div>
        {!items.length && !photos.length ? (
          <div className="empty" style={{ padding: "26px 10px" }}><Icon name="camera" size={22} /><br />Bu kategori için henüz hazır görsel yok. Kendi fotoğrafınızı ekleyebilir ya da fotoğrafsız devam edebilirsiniz.</div>
        ) : (
          <>
            {!!items.length && <div className="chips" style={{ marginBottom: 8 }}>
              {!!best.length && chip(tab === "__oneri", `Talebinize uyanlar (${best.length})`, () => { setTab("__oneri"); setModel(""); })}
              {chip(tab === "", `Tümü (${items.length})`, () => { setTab(""); setModel(""); })}
              {brands.map((b) => chip(tab === b, `${b} (${items.filter((x) => x.marka === b).length})`, () => { setTab(b); setModel(""); }))}
            </div>}
            {models.length > 0 && <div className="chips" style={{ marginBottom: 8 }}>{chip(!model, `Tüm ${tab} modelleri`, () => setModel(""))}{models.map((m) => chip(model === m, m, () => setModel(m)))}</div>}
            {!!items.length && <div className="stk-grid">{list.map((it) => (
              <button key={it.id} type="button" className="stk-i" disabled={busy !== null} onClick={() => onPick(it)} aria-label={`${label(it)} seç`}>
                <img src={it.media.url} alt="" loading="lazy" />
                <span className="stk-t">{label(it)}{it.title && it.title !== label(it) && <small>{it.title}</small>}</span>
                {busy === it.id && <span className="stk-busy"><span className="spinner" /></span>}
              </button>
            ))}</div>}
            {!!photos.length && (tab === "" || tab === "__oneri" || !items.length) && (
              <>
                <div className="stk-h">Ücretsiz fotoğraflar{source ? ` (${source.name})` : ""}</div>
                <div className="stk-grid">{photos.map((p) => <PhotoTile key={p.id} p={p} src={source} busy={busy} onPick={onPickPhoto} add={false} />)}</div>
                {source && <div className="stk-credit">Fotoğraflar <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> sitesinden; ücretsiz kullanılabilir.</div>}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
