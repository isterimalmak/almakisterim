"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, uploadFile, type Ad } from "@/lib/api";
import { useSession } from "./Session";

const TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"];

// Yönetim paneli: ana sayfada sol sütundaki reklam kutuları. İstenildiği kadar eklenir, sırası değiştirilir.
export function AdsAdmin() {
  const { toast } = useSession();
  const [items, setItems] = useState<Ad[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => setItems((await api<{ items: Ad[] }>("/admin/ads")).items), []);
  useEffect(() => { void load().catch((e) => toast((e as Error).message)); }, [load, toast]);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    let ok = 0;
    for (const f of Array.from(files)) {
      if (!TYPES.includes(f.type)) { toast(`"${f.name}" desteklenmiyor. JPG, PNG, WEBP resim veya MP4, MOV, WEBM video seçin.`); continue; }
      try {
        setBusy(`${f.name} yükleniyor… %0`);
        const m = await uploadFile(f, (pct) => setBusy(`${f.name} yükleniyor… %${pct}`));
        await api("/admin/ads", { body: { media_id: m.id, title: f.name.replace(/\.[^.]+$/, "") } });
        ok++;
      } catch (e) { toast((e as Error).message); }
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    if (ok) toast(ok > 1 ? `${ok} reklam eklendi; ana sayfada görünüyor.` : "Reklam eklendi; ana sayfada görünüyor.");
    await load();
  };

  const patch = async (a: Ad, body: Partial<Pick<Ad, "title" | "link_url" | "is_active">>) => {
    try { await api(`/admin/ads/${a.id}`, { method: "PATCH", body }); await load(); }
    catch (e) { toast((e as Error).message); }
  };
  const move = async (i: number, d: -1 | 1) => {
    if (!items) return;
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    setItems(next);
    await api("/admin/ads/order", { body: { ids: next.map((x) => x.id) } }).catch((e) => toast((e as Error).message));
  };
  const remove = async (a: Ad) => {
    if (!confirm("Bu reklam ve dosyası silinsin mi?")) return;
    await api(`/admin/ads/${a.id}`, { method: "DELETE" }).catch((e) => toast((e as Error).message));
    toast("Reklam silindi.");
    await load();
  };

  return (
    <div className="box"><div className="box-h"><h2>Reklam Alanları</h2></div><div className="box-b">
      <div className="note n-info" style={{ marginBottom: 12 }}><span>Eklediğiniz resim ve videolar ana sayfada soldaki kategorilerin altında, buradaki sırayla alt alta görünür (telefonda kategorilerin altında). İstediğiniz kadar ekleyebilirsiniz. Önerilen boyut: 460×300 veya 460×600 piksel; video sessiz ve döngüde oynar.</span></div>
      <input ref={input} type="file" accept={TYPES.join(",")} multiple hidden onChange={(e) => void add(e.target.files)} aria-label="Reklam dosyası seç" />
      <button className="btn btn-or" disabled={!!busy} onClick={() => input.current?.click()}>+ Resim veya video ekle</button>
      {busy && <span className="muted" style={{ marginLeft: 10 }}>{busy}</span>}
      {!items ? <div className="loading">Yükleniyor…</div> : !items.length ? <div className="empty">Henüz reklam yok.</div> : (
        <div className="ad-list">
          {items.map((a, i) => (
            <div key={a.id} className={"ad-row" + (a.is_active ? "" : " off")}>
              <div className="ad-prev">{a.media.kind === "video" ? <video src={a.media.url} muted playsInline preload="metadata" /> : <img src={a.media.url} alt="" />}</div>
              <div className="ad-f">
                <label>Başlık<input className="inp" defaultValue={a.title} aria-label={`${i + 1}. reklam başlığı`} onBlur={(e) => e.target.value !== a.title && void patch(a, { title: e.target.value })} /></label>
                <label>Tıklayınca gideceği adres (isteğe bağlı)<input className="inp" defaultValue={a.link_url ?? ""} placeholder="https://… veya /kategori/vasita" aria-label={`${i + 1}. reklam bağlantısı`} onBlur={(e) => e.target.value !== (a.link_url ?? "") && void patch(a, { link_url: e.target.value })} /></label>
              </div>
              <div className="ad-act">
                <button className={"sw" + (a.is_active ? " on" : "")} role="switch" aria-checked={a.is_active} aria-label={`${i + 1}. reklam yayında`} onClick={() => void patch(a, { is_active: !a.is_active })} />
                <span className="muted" style={{ fontSize: 12 }}>{a.is_active ? "Yayında" : "Kapalı"}</span>
                <button className="btn btn-wh btn-sm" disabled={i === 0} aria-label="Yukarı taşı" onClick={() => void move(i, -1)}>↑</button>
                <button className="btn btn-wh btn-sm" disabled={i === items.length - 1} aria-label="Aşağı taşı" onClick={() => void move(i, 1)}>↓</button>
                <button className="btn btn-gh btn-sm" onClick={() => void remove(a)}>Sil</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div></div>
  );
}
