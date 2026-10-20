"use client";

import { useEffect, useRef, useState } from "react";
import { AdMedia } from "@/components/Ads";
import { useSession } from "@/components/Session";
import { api, uploadFile, type Ad } from "@/lib/api";
import { BUILTIN_NAMES, blockName, saveHomeBlocks, SIDE_IDS, type BuiltinId, type HomeBlock, type Tone } from "@/lib/home";

type Custom = Exclude<HomeBlock, { type: "builtin" }>;
const TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"];
const TONES: [Tone, string][] = [["acik", "Beyaz"], ["lacivert", "Lacivert"], ["turuncu", "Turuncu"], ["yesil", "Yeşil"]];
const newId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const ADD: { type: Custom["type"]; icon: string; name: string; desc: string; make: () => Custom }[] = [
  { type: "text", icon: "📝", name: "Yazı / duyuru", desc: "Başlık, metin ve düğme", make: () => ({ type: "text", id: newId("yazi"), hidden: false, title: "Duyuru", text: "", cta: "", href: null, tone: "lacivert", align: "orta" }) },
  { type: "banner", icon: "🖼", name: "Afiş (resim / video)", desc: "Tek geniş görsel ya da yan yana kutular", make: () => ({ type: "banner", id: newId("afis"), hidden: false, title: "", ad_ids: [] }) },
  { type: "marquee", icon: "〰️", name: "Kayan yazı bandı", desc: "\"Ücretsiz talep ver • …\" diye akan şerit", make: () => ({ type: "marquee", id: newId("bant"), hidden: false, text: "Almak istediğinizi yazın, satıcılar size gelsin", bg: "#F26B1D", fg: "#FFFFFF", href: "/talep-ver" }) },
];

// Yönetim → Ana Sayfa Düzeni (Marka Bahçem vitrinindeki gibi): bölümler oklarla sıralanır, gizlenir; yazı, afiş ve kayan yazı eklenir.
// Telefonda bütün bölümler bu sırayla alt alta görünür; bilgisayarda yan kutular sağ sütunda aynı sırayla durur.
export function HomeLayoutAdmin() {
  const { homeBlocks, refresh, toast } = useSession();
  const [blocks, setBlocks] = useState<HomeBlock[]>(homeBlocks);
  const [open, setOpen] = useState<string | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  useEffect(() => { setBlocks(homeBlocks); }, [homeBlocks]);
  const loadAds = () => api<{ blok?: Ad[] }>("/tanitim").then((r) => setAds(r.blok ?? [])).catch(() => {});
  useEffect(() => { void loadAds(); }, []);

  const save = async (next: HomeBlock[], msg?: string) => {
    setBlocks(next);
    try { await saveHomeBlocks(next); await refresh(); if (msg) toast(msg); }
    catch (e) { toast((e as Error).message); setBlocks(homeBlocks); }
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...blocks];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    void save(next, `${blockName(blocks[i]!)} ${d < 0 ? "yukarı" : "aşağı"} taşındı.`);
  };
  const flip = (b: HomeBlock) => void save(blocks.map((x) => (x.id === b.id ? { ...x, hidden: !x.hidden } : x)), `${blockName(b)} ${b.hidden ? "ana sayfada gösteriliyor." : "ziyaretçilerden gizlendi."}`);
  const remove = (b: HomeBlock) => { if (confirm(`"${blockName(b)}" bölümü silinsin mi?`)) void save(blocks.filter((x) => x.id !== b.id), "Bölüm silindi."); };
  const add = (make: () => Custom) => { const b = make(); setOpen(b.id); void save([b, ...blocks], "Bölüm en üste eklendi; aşağıdan düzenleyin, oklarla yerini seçin."); };
  const update = (b: Custom) => void save(blocks.map((x) => (x.id === b.id ? b : x)), "Kaydedildi.");
  const reset = () => {
    if (!confirm("Hazır bölümler ilk sıraya dönsün mü? Eklediğiniz bölümler en üstte kalır.")) return;
    const custom = blocks.filter((b) => b.type !== "builtin");
    void save([...custom, ...(Object.keys(BUILTIN_NAMES) as BuiltinId[]).map((id) => ({ type: "builtin" as const, id, hidden: blocks.find((b) => b.id === id)?.hidden ?? false }))], "Hazır bölümler ilk sıraya döndü.");
  };

  return (
    <div className="ap-box"><div className="ap-box-h"><h2>Ana Sayfa Düzeni</h2></div><div className="ap-box-b">
      <div className="note n-info" style={{ marginBottom: 12 }}><span>
        Ana sayfadaki bölümler aşağıdaki sırayla görünür; <b>telefonda hepsi bu sırayla alt alta</b> dizilir. Okla yukarı/aşağı taşıyın, istemediğinizi gizleyin; değişiklik hemen kaydedilir.
        Bilgisayarda &quot;Lansman&quot;, &quot;Nasıl çalışır?&quot; ve &quot;Güvenli alışveriş&quot; kutuları sağ sütunda durur.
        Ana sayfada gizli bölümlerin yerini ve &quot;Göster&quot; düğmesini yalnızca siz görürsünüz.
      </span></div>

      <div className="hl-add">
        <b>Bölüm ekle</b>
        <div className="hl-add-g">{ADD.map((a) => (
          <button key={a.type} type="button" className="hl-add-i" onClick={() => add(a.make)}><span aria-hidden="true">{a.icon}</span><span><b>{a.name}</b><small>{a.desc}</small></span></button>
        ))}</div>
      </div>

      <ol className="hl-list">
        {blocks.map((b, i) => (
          <li key={b.id} className={(b.hidden ? "off" : "") + (b.type !== "builtin" ? " custom" : "")}>
            <div className="hl-row">
              <span className="hl-n">{i + 1}</span>
              <span className="hl-t"><b>{blockName(b)}</b><small>{b.hidden ? "Gizli" : "Görünüyor"}{b.type === "builtin" && SIDE_IDS.includes(b.id) ? " · bilgisayarda sağ sütunda" : ""}</small></span>
              <button type="button" className="btn btn-wh btn-sm" disabled={i === 0} aria-label={`${blockName(b)} yukarı taşı`} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="btn btn-wh btn-sm" disabled={i === blocks.length - 1} aria-label={`${blockName(b)} aşağı taşı`} onClick={() => move(i, 1)}>↓</button>
              <button type="button" className={"btn btn-sm " + (b.hidden ? "btn-or" : "btn-wh")} aria-label={`${blockName(b)} ${b.hidden ? "göster" : "gizle"}`} onClick={() => flip(b)}>{b.hidden ? "Göster" : "Gizle"}</button>
              {b.type !== "builtin" && <button type="button" className="btn btn-wh btn-sm" aria-expanded={open === b.id} onClick={() => setOpen(open === b.id ? null : b.id)}>{open === b.id ? "Kapat" : "Düzenle"}</button>}
              {b.type !== "builtin" && <button type="button" className="btn btn-gh btn-sm" aria-label={`${blockName(b)} sil`} onClick={() => remove(b)}>Sil</button>}
            </div>
            {open === b.id && b.type !== "builtin" && <Editor b={b} ads={ads} onSave={update} onAds={loadAds} />}
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-gh btn-sm" style={{ marginTop: 10 }} onClick={reset}>Hazır bölümleri ilk sıraya döndür</button>
    </div></div>
  );
}

function Editor({ b, ads, onSave, onAds }: { b: Custom; ads: Ad[]; onSave: (b: Custom) => void; onAds: () => Promise<void> }) {
  const { toast } = useSession();
  const [d, setD] = useState<Custom>(b);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const set = (p: Partial<Custom>) => setD((x) => ({ ...x, ...p } as Custom));
  const href = (v: string) => (v.trim() ? v.trim() : null);

  if (d.type === "text") return (
    <div className="hl-ed form-grid">
      <div className="fg full"><label htmlFor={`t-${d.id}`}>Başlık</label><input id={`t-${d.id}`} className="inp" maxLength={120} value={d.title} onChange={(e) => set({ title: e.target.value })} /></div>
      <div className="fg full"><label htmlFor={`x-${d.id}`}>Metin</label><textarea id={`x-${d.id}`} className="txa" rows={3} maxLength={1000} value={d.text} onChange={(e) => set({ text: e.target.value })} /></div>
      <div className="fg"><label htmlFor={`c-${d.id}`}>Düğme yazısı (isteğe bağlı)</label><input id={`c-${d.id}`} className="inp" maxLength={40} value={d.cta} onChange={(e) => set({ cta: e.target.value })} placeholder="Örn. Ücretsiz talep ver" /></div>
      <div className="fg"><label htmlFor={`h-${d.id}`}>Düğmenin gideceği adres</label><input id={`h-${d.id}`} className="inp" value={d.href ?? ""} onChange={(e) => set({ href: href(e.target.value) })} placeholder="/talep-ver veya https://…" /></div>
      <div className="fg"><label>Renk</label><div className="radio-row">{TONES.map(([k, l]) => <label key={k}><input type="radio" name={`tone-${d.id}`} checked={d.tone === k} onChange={() => set({ tone: k })} />{l}</label>)}</div></div>
      <div className="fg"><label>Hizalama</label><div className="radio-row">{([["orta", "Ortada"], ["sol", "Solda"]] as const).map(([k, l]) => <label key={k}><input type="radio" name={`al-${d.id}`} checked={d.align === k} onChange={() => set({ align: k })} />{l}</label>)}</div></div>
      <div className="fg full"><button type="button" className="btn btn-or" onClick={() => onSave(d)}>Kaydet</button></div>
    </div>
  );
  if (d.type === "marquee") return (
    <div className="hl-ed form-grid">
      <div className="fg full"><label htmlFor={`m-${d.id}`}>Kayan yazı</label><input id={`m-${d.id}`} className="inp" maxLength={160} value={d.text} onChange={(e) => set({ text: e.target.value })} /></div>
      <div className="fg"><label htmlFor={`bg-${d.id}`}>Zemin rengi</label><input id={`bg-${d.id}`} type="color" className="inp" value={d.bg} onChange={(e) => set({ bg: e.target.value.toUpperCase() })} /></div>
      <div className="fg"><label htmlFor={`fg-${d.id}`}>Yazı rengi</label><input id={`fg-${d.id}`} type="color" className="inp" value={d.fg} onChange={(e) => set({ fg: e.target.value.toUpperCase() })} /></div>
      <div className="fg full"><label htmlFor={`mh-${d.id}`}>Tıklayınca gideceği adres (isteğe bağlı)</label><input id={`mh-${d.id}`} className="inp" value={d.href ?? ""} onChange={(e) => set({ href: href(e.target.value) })} placeholder="/talep-ver" /></div>
      <div className="fg full"><button type="button" className="btn btn-or" onClick={() => onSave(d)}>Kaydet</button></div>
    </div>
  );

  // Afiş: görseller reklam olarak ('blok') yüklenir; bağlantı her görsel için ayrı.
  const items = d.ad_ids.map((id) => ads.find((a) => a.id === id)).filter((a): a is Ad => !!a);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const ids = [...d.ad_ids];
    for (const f of Array.from(files)) {
      if (!TYPES.includes(f.type)) { toast(`"${f.name}" desteklenmiyor. JPG, PNG, WEBP resim veya MP4, MOV, WEBM video seçin.`); continue; }
      if (ids.length >= 8) { toast("Bir afişe en fazla 8 görsel eklenebilir."); break; }
      try {
        setBusy(`${f.name} yükleniyor… %0`);
        const m = await uploadFile(f, (p) => setBusy(`${f.name} yükleniyor… %${p}`));
        const ad = await api<{ id: number }>("/admin/tanitim", { body: { media_id: m.id, title: f.name.replace(/\.[^.]+$/, ""), placement: "blok" } });
        ids.push(ad.id);
      } catch (e) { toast((e as Error).message); }
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    await onAds();
    const next = { ...d, ad_ids: ids };
    setD(next); onSave(next);
  };
  const link = async (a: Ad, v: string) => {
    try { await api(`/admin/tanitim/${a.id}`, { method: "PATCH", body: { link_url: v } }); await onAds(); toast("Bağlantı kaydedildi."); }
    catch (e) { toast((e as Error).message); }
  };
  return (
    <div className="hl-ed">
      <div className="form-grid">
        <div className="fg full"><label htmlFor={`bt-${d.id}`}>Başlık (isteğe bağlı)</label><input id={`bt-${d.id}`} className="inp" maxLength={120} value={d.title} onChange={(e) => set({ title: e.target.value })} onBlur={() => onSave(d)} /></div>
      </div>
      <input ref={input} type="file" multiple hidden accept={TYPES.join(",")} aria-label="Afiş görseli seç" onChange={(e) => void upload(e.target.files)} />
      <div className="hl-ban">
        {items.map((a, k) => (
          <div key={a.id} className="hl-ban-i">
            <div className="yk"><AdMedia a={a} /></div>
            <input className="inp" defaultValue={a.link_url ?? ""} placeholder="Tıklayınca gideceği adres (isteğe bağlı)" aria-label={`${k + 1}. görselin bağlantısı`} onBlur={(e) => e.target.value !== (a.link_url ?? "") && void link(a, e.target.value)} />
            <button type="button" className="btn btn-gh btn-sm" onClick={() => { const next = { ...d, ad_ids: d.ad_ids.filter((x) => x !== a.id) }; setD(next); onSave(next); }}>Görseli çıkar</button>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-or" disabled={!!busy} onClick={() => input.current?.click()}>+ Resim veya video ekle</button>
      {busy && <span className="muted" style={{ marginLeft: 10 }}>{busy}</span>}
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Tek görsel geniş afiş olur; birden fazla görsel yan yana kutular hâlinde dizilir. Video sessiz başlar.</p>
    </div>
  );
}
