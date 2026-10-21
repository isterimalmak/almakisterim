"use client";

import { useEffect, useRef, useState } from "react";
import { AdMedia } from "@/components/Ads";
import { useSession } from "@/components/Session";
import { catVitrinItems } from "@/components/HomeBlocks";
import { api, uploadFile, type Ad, type RequestItem } from "@/lib/api";
import { fmt } from "@/lib/format";
import { BUILTIN_NAMES, BUILTIN_TEXTS, blockName, FIXED_IDS, saveHomeBlocks, SHOW_TXT, SIDE_IDS, SPEEDS, type BuiltinId, type HomeBlock, type Show, type Tone } from "@/lib/home";

type Custom = Exclude<HomeBlock, { type: "builtin" }>;
const TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"];
const TONES: [Tone, string][] = [["acik", "Beyaz"], ["lacivert", "Lacivert"], ["turuncu", "Turuncu"], ["yesil", "Yeşil"]];
const newId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const ADD: { type: Custom["type"]; icon: string; name: string; desc: string; make: () => Custom }[] = [
  { type: "text", icon: "📝", name: "Yazı / duyuru", desc: "Başlık, metin ve düğme", make: () => ({ type: "text", id: newId("yazi"), hidden: false, title: "Duyuru", text: "", cta: "", href: null, tone: "lacivert", align: "orta" }) },
  { type: "banner", icon: "🖼", name: "Afiş (resim / video)", desc: "Tek geniş görsel ya da yan yana kutular", make: () => ({ type: "banner", id: newId("afis"), hidden: false, title: "", ad_ids: [] }) },
  { type: "catvitrin", icon: "🗂", name: "Kategori vitrini", desc: "Seçtiğiniz kategorinin talepleri kendiliğinden gelir; elle ekleyip çıkarırsınız", make: () => ({ type: "catvitrin", id: newId("katvit"), hidden: false, title: "Elektronik Talepleri", top: "elektronik", limit: 12, include_ids: [], exclude_ids: [] }) },
  { type: "showcase", icon: "🛍", name: "Kayan vitrin", desc: "Seçtiğiniz talepler tek satırda sağdan sola akar", make: () => ({ type: "showcase", id: newId("vitrin"), hidden: false, title: "Öne Çıkan Talepler", request_ids: [], speed: 2 }) },
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
  const update = (b: HomeBlock) => void save(blocks.map((x) => (x.id === b.id ? b : x)), "Kaydedildi.");
  const setShow = (b: HomeBlock, show: Show) => void save(blocks.map((x) => (x.id === b.id ? { ...x, show } : x)), `${blockName(b)}: ${SHOW_TXT[show].toLowerCase()} görünür.`);
  // Önizleme: kaydedince yenilenir (Marka Bahçem'deki gibi telefon/bilgisayar).
  const [view, setView] = useState<"mobile" | "desktop">("mobile");
  const [stamp, setStamp] = useState(0);
  useEffect(() => { setStamp((x) => x + 1); }, [homeBlocks]);
  const reset = () => {
    if (!confirm("Hazır bölümler ilk sıraya dönsün mü? Eklediğiniz bölümler en üstte kalır.")) return;
    const custom = blocks.filter((b) => b.type !== "builtin" && !FIXED_IDS.includes(b.id));
    // Vasıta / Emlak Talepleri de hazır bölümdür: Ana Sayfa Vitrini'nin hemen altına döner.
    const fixed = blocks.filter((b) => FIXED_IDS.includes(b.id));
    const ready = (Object.keys(BUILTIN_NAMES) as BuiltinId[]).flatMap((id) => [blocks.find((b) => b.id === id) ?? { type: "builtin" as const, id, hidden: false }, ...(id === "vitrin" ? fixed : [])]);
    void save([...custom, ...ready], "Hazır bölümler ilk sıraya döndü.");
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

      <div className="hl-wrap">
      <ol className="hl-list">
        {blocks.map((b, i) => (
          <li key={b.id} className={(b.hidden ? "off" : "") + (b.type !== "builtin" ? " custom" : "") + (open === b.id ? " open" : "")}>
            <div className="hl-row">
              <span className="hl-n">{i + 1}</span>
              {/* Bölümün adına tıklayınca düzenleme kutusu açılır */}
              <button type="button" className="hl-t" aria-expanded={open === b.id} aria-label={`${blockName(b)} düzenle`} onClick={() => setOpen(open === b.id ? null : b.id)}>
                <b>{blockName(b)}</b>
                <small>{b.hidden ? "Gizli" : "Görünüyor"} · {SHOW_TXT[b.show ?? "all"]}{b.type === "builtin" && SIDE_IDS.includes(b.id) ? " · bilgisayarda sağ sütunda" : ""}</small>
              </button>
              <button type="button" className="btn btn-wh btn-sm" disabled={i === 0} aria-label={`${blockName(b)} yukarı taşı`} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="btn btn-wh btn-sm" disabled={i === blocks.length - 1} aria-label={`${blockName(b)} aşağı taşı`} onClick={() => move(i, 1)}>↓</button>
              <button type="button" className={"btn btn-sm " + (b.hidden ? "btn-or" : "btn-wh")} aria-label={`${blockName(b)} ${b.hidden ? "göster" : "gizle"}`} onClick={() => flip(b)}>{b.hidden ? "Göster" : "Gizle"}</button>
              {b.type !== "builtin" && !FIXED_IDS.includes(b.id) && <button type="button" className="btn btn-gh btn-sm" aria-label={`${blockName(b)} sil`} onClick={() => remove(b)}>Sil</button>}
            </div>
            {open === b.id && (
              <div className="hl-ed">
                <div className="fg" style={{ marginBottom: 10 }}><label>Nerede görünsün</label>
                  <div className="seg" role="group" aria-label={`${blockName(b)} nerede görünsün`}>{(["all", "mobile", "desktop"] as Show[]).map((k) => (
                    <button key={k} type="button" className={(b.show ?? "all") === k ? "on" : ""} aria-pressed={(b.show ?? "all") === k} onClick={() => setShow(b, k)}>{SHOW_TXT[k]}</button>
                  ))}</div></div>
                {b.type === "builtin" ? <BuiltinEditor b={b} onSave={update} /> : <Editor b={b} ads={ads} onSave={update} onAds={loadAds} />}
              </div>
            )}
          </li>
        ))}
      </ol>
      <aside className="hl-prev" aria-label="Önizleme">
        <div className="seg">{([["mobile", "📱 Telefon"], ["desktop", "🖥 Bilgisayar"]] as const).map(([k, l]) => <button key={k} type="button" className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>)}
          <button type="button" onClick={() => setStamp((x) => x + 1)}>↻ Yenile</button></div>
        <div className={"hl-frame " + view}><iframe key={`${view}-${stamp}`} src="/?onizleme=1" title="Ana sayfa önizlemesi" /></div>
        <small className="muted">Değişiklikler kaydedilince önizleme yenilenir. Ziyaretçiler de aynı anda yeni hâli görür.</small>
      </aside>
      </div>
      <button type="button" className="btn btn-gh btn-sm" style={{ marginTop: 10 }} onClick={reset}>Hazır bölümleri ilk sıraya döndür</button>
    </div></div>
  );
}

// Hazır bölümün yazıları: boş bırakılan alan varsayılan yazıyla görünür.
function BuiltinEditor({ b, onSave }: { b: Extract<HomeBlock, { type: "builtin" }>; onSave: (b: HomeBlock) => void }) {
  const fields = BUILTIN_TEXTS[b.id] ?? [];
  const [t, setT] = useState<Record<string, string>>(b.texts ?? {});
  if (!fields.length) return <p className="muted" style={{ fontSize: 12.5 }}>Bu bölümün yazısı yok; yalnızca yerini, nerede görüneceğini ve görünürlüğünü değiştirebilirsiniz.{b.id === "center_ads" || b.id === "ads_m" ? " Görselleri Reklam Alanları bölümünden eklersiniz." : ""}</p>;
  return (
    <div className="form-grid">
      {fields.map((f) => (
        <div key={f.k} className={"fg" + (f.long ? " full" : "")}><label htmlFor={`bt-${b.id}-${f.k}`}>{f.l}</label>
          {f.long
            ? <textarea id={`bt-${b.id}-${f.k}`} className="txa" rows={2} maxLength={400} value={t[f.k] ?? ""} placeholder={f.d} onChange={(e) => setT({ ...t, [f.k]: e.target.value })} />
            : <input id={`bt-${b.id}-${f.k}`} className="inp" maxLength={400} value={t[f.k] ?? ""} placeholder={f.d} onChange={(e) => setT({ ...t, [f.k]: e.target.value })} />}
        </div>
      ))}
      <div className="fg full" style={{ flexDirection: "row", gap: 8 }}>
        <button type="button" className="btn btn-or" onClick={() => onSave({ ...b, texts: Object.fromEntries(Object.entries(t).filter(([, v]) => v.trim())) })}>Kaydet</button>
        <button type="button" className="btn btn-gh btn-sm" onClick={() => { setT({}); onSave({ ...b, texts: {} }); }}>Varsayılan yazılara dön</button>
      </div>
      <span className="hint full" style={{ gridColumn: "1/-1" }}>Boş bıraktığınız alanlarda soluk yazan varsayılan metin görünür.</span>
    </div>
  );
}

function Editor({ b, ads, onSave, onAds }: { b: Custom; ads: Ad[]; onSave: (b: HomeBlock) => void; onAds: () => Promise<void> }) {
  const { toast } = useSession();
  const [d, setD] = useState<Custom>(b);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const set = (p: Partial<Custom>) => setD((x) => ({ ...x, ...p } as Custom));
  const href = (v: string) => (v.trim() ? v.trim() : null);

  if (d.type === "text") return (
    <div className="form-grid">
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
    <div className="form-grid">
      <div className="fg full"><label htmlFor={`m-${d.id}`}>Kayan yazı</label><input id={`m-${d.id}`} className="inp" maxLength={160} value={d.text} onChange={(e) => set({ text: e.target.value })} /></div>
      <div className="fg"><label htmlFor={`bg-${d.id}`}>Zemin rengi</label><input id={`bg-${d.id}`} type="color" className="inp" value={d.bg} onChange={(e) => set({ bg: e.target.value.toUpperCase() })} /></div>
      <div className="fg"><label htmlFor={`fg-${d.id}`}>Yazı rengi</label><input id={`fg-${d.id}`} type="color" className="inp" value={d.fg} onChange={(e) => set({ fg: e.target.value.toUpperCase() })} /></div>
      <div className="fg full"><label htmlFor={`mh-${d.id}`}>Tıklayınca gideceği adres (isteğe bağlı)</label><input id={`mh-${d.id}`} className="inp" value={d.href ?? ""} onChange={(e) => set({ href: href(e.target.value) })} placeholder="/talep-ver" /></div>
      <div className="fg full"><button type="button" className="btn btn-or" onClick={() => onSave(d)}>Kaydet</button></div>
    </div>
  );

  if (d.type === "showcase") return <ShowcaseEditor b={d} onSave={(x) => { setD(x); onSave(x); }} />;
  if (d.type === "catvitrin") return <CatVitrinEditor b={d} onSave={(x) => { setD(x); onSave(x); }} />;

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
    <div>
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

// Kayan vitrin: adı, talepleri (başlık veya talep no ile aranır) ve hızı yönetici seçer.
function ShowcaseEditor({ b, onSave }: { b: Extract<HomeBlock, { type: "showcase" }>; onSave: (b: Extract<HomeBlock, { type: "showcase" }>) => void }) {
  const { toast } = useSession();
  const [title, setTitle] = useState(b.title);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<RequestItem[] | null>(null);
  const [chosen, setChosen] = useState<RequestItem[]>([]);
  const key = b.request_ids.join(",");
  useEffect(() => {
    if (!key) { setChosen([]); return; }
    void api<{ items: RequestItem[] }>(`/requests?ids=${key}&per=40`)
      .then((r) => setChosen(b.request_ids.map((id) => r.items.find((x) => x.id === id)).filter((x): x is RequestItem => !!x))).catch(() => {});
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const search = async () => {
    try { setFound((await api<{ items: RequestItem[] }>(`/requests?per=12${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : "&sort=vitrin"}`)).items); }
    catch (e) { toast((e as Error).message); }
  };
  useEffect(() => { void search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const put = (ids: number[]) => onSave({ ...b, title, request_ids: ids });
  const addR = (r: RequestItem) => {
    if (b.request_ids.includes(r.id)) return;
    if (b.request_ids.length >= 40) return toast("Bir vitrine en fazla 40 talep eklenebilir.");
    put([...b.request_ids, r.id]);
  };
  // Seçilmiş ama artık yayında olmayan talepler (süresi doldu, kapandı) listede görünmez; vitrinde de çıkmaz.
  const gone = b.request_ids.length - chosen.length;
  return (
    <div>
      <div className="form-grid">
        <div className="fg"><label htmlFor={`sct-${b.id}`}>Vitrinin adı</label><input id={`sct-${b.id}`} className="inp" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== b.title && put(b.request_ids)} placeholder="Örn. Öne Çıkan Talepler" /></div>
        <div className="fg"><label>Kayma hızı</label>
          <div className="seg" role="group" aria-label="Kayma hızı">{SPEEDS.map(([n, l]) => (
            <button key={n} type="button" className={b.speed === n ? "on" : ""} aria-pressed={b.speed === n} onClick={() => onSave({ ...b, title, speed: n })}>{l}</button>
          ))}</div></div>
      </div>
      <b style={{ display: "block", margin: "12px 0 6px" }}>Vitrindeki talepler ({chosen.length})</b>
      {!chosen.length ? <p className="muted" style={{ fontSize: 12.5 }}>Henüz talep eklenmedi. Aşağıdan arayıp <b>Ekle</b>&apos;ye basın.</p> : (
        <ul className="sc-pick">{chosen.map((r, i) => (
          <li key={r.id}>
            <span className="sc-pick-t"><b>{r.title}</b><small>No {r.id} · {fmt(r.budget_max)} TL · {r.city}</small></span>
            <button type="button" className="btn btn-wh btn-sm" disabled={i === 0} aria-label={`${r.title} sola al`} onClick={() => { const ids = chosen.map((x) => x.id); [ids[i - 1], ids[i]] = [ids[i]!, ids[i - 1]!]; put(ids); }}>↑</button>
            <button type="button" className="btn btn-gh btn-sm" aria-label={`${r.title} vitrinden çıkar`} onClick={() => put(b.request_ids.filter((x) => x !== r.id))}>Çıkar</button>
          </li>
        ))}</ul>
      )}
      {gone > 0 && <p className="muted" style={{ fontSize: 12 }}>{gone} talep artık yayında değil; vitrinde görünmüyor.</p>}
      <form className="sc-search" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <input className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Başlık veya talep no ile ara" aria-label="Vitrine eklenecek talebi ara" />
        <button type="submit" className="btn btn-bl">Ara</button>
      </form>
      {found && (!found.length ? <p className="muted" style={{ fontSize: 12.5 }}>Talep bulunamadı.</p> : (
        <ul className="sc-pick">{found.map((r) => (
          <li key={r.id}>
            <span className="sc-pick-t"><b>{r.title}</b><small>No {r.id} · {fmt(r.budget_max)} TL · {r.city}</small></span>
            {b.request_ids.includes(r.id) ? <span className="muted" style={{ fontSize: 12 }}>Eklendi</span>
              : <button type="button" className="btn btn-or btn-sm" aria-label={`${r.title} vitrine ekle`} onClick={() => addR(r)}>Ekle</button>}
          </li>
        ))}</ul>
      ))}
    </div>
  );
}

// Kategori vitrini: kategorinin talepleri kendiliğinden gelir; yönetici başka talep ekler (en başta) ya da istemediğini çıkarır.
function CatVitrinEditor({ b, onSave }: { b: Extract<HomeBlock, { type: "catvitrin" }>; onSave: (b: Extract<HomeBlock, { type: "catvitrin" }>) => void }) {
  const { toast, categories } = useSession();
  const [title, setTitle] = useState(b.title);
  const [shown, setShown] = useState<RequestItem[] | null>(null);
  const [gone, setGone] = useState<RequestItem[]>([]);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<RequestItem[] | null>(null);
  const key = JSON.stringify([b.top, b.limit, b.include_ids, b.exclude_ids]);
  useEffect(() => {
    void catVitrinItems(b).then((r) => setShown(r.items)).catch(() => setShown([]));
    if (b.exclude_ids.length) void api<{ items: RequestItem[] }>(`/requests?ids=${b.exclude_ids.slice(0, 40).join(",")}&per=40`).then((r) => setGone(r.items)).catch(() => setGone([]));
    else setGone([]);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const put = (p: Partial<typeof b>) => onSave({ ...b, title, ...p });
  const search = async () => {
    try { setFound((await api<{ items: RequestItem[] }>(`/requests?per=12${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : `&top=${b.top}`}`)).items); }
    catch (e) { toast((e as Error).message); }
  };
  const add = (r: RequestItem) => {
    if (b.include_ids.includes(r.id)) return;
    if (b.include_ids.length >= 24) return toast("En fazla 24 talep elle eklenebilir.");
    put({ include_ids: [...b.include_ids, r.id], exclude_ids: b.exclude_ids.filter((x) => x !== r.id) });
  };
  const remove = (r: RequestItem) => put({ include_ids: b.include_ids.filter((x) => x !== r.id), exclude_ids: b.include_ids.includes(r.id) ? b.exclude_ids : [...b.exclude_ids, r.id].slice(-200) });
  const row = (r: RequestItem, act: React.ReactNode) => (
    <li key={r.id}><span className="sc-pick-t"><b>{r.title}</b><small>No {r.id} · {fmt(r.budget_max)} TL · {r.city}{b.include_ids.includes(r.id) ? " · elle eklendi" : ""}</small></span>{act}</li>
  );
  return (
    <div>
      <div className="form-grid">
        <div className="fg"><label htmlFor={`cvt-${b.id}`}>Bölümün adı</label><input id={`cvt-${b.id}`} className="inp" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== b.title && put({})} /></div>
        <div className="fg"><label htmlFor={`cvc-${b.id}`}>Kategori (talepler buradan kendiliğinden gelir)</label>
          <select id={`cvc-${b.id}`} className="sel" value={b.top} disabled={FIXED_IDS.includes(b.id)} onChange={(e) => put({ top: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="fg"><label htmlFor={`cvl-${b.id}`}>Kaç talep görünsün</label>
          <select id={`cvl-${b.id}`} className="sel" value={b.limit} onChange={(e) => put({ limit: Number(e.target.value) })}>{[4, 6, 8, 12, 16, 20, 24].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
      </div>
      <b style={{ display: "block", margin: "12px 0 6px" }}>Şu an vitrinde ({shown?.length ?? "…"})</b>
      {shown && !shown.length && <p className="muted" style={{ fontSize: 12.5 }}>Bu kategoride henüz yayında talep yok; bölüm ana sayfada boş görünmez, gizli kalır.</p>}
      {!!shown?.length && <ul className="sc-pick">{shown.map((r) => row(r, <button type="button" className="btn btn-gh btn-sm" aria-label={`${r.title} vitrinden çıkar`} onClick={() => remove(r)}>Çıkar</button>))}</ul>}
      {!!gone.length && <>
        <b style={{ display: "block", margin: "12px 0 6px" }}>Çıkardıklarınız ({gone.length})</b>
        <ul className="sc-pick">{gone.map((r) => row(r, <button type="button" className="btn btn-wh btn-sm" aria-label={`${r.title} geri al`} onClick={() => put({ exclude_ids: b.exclude_ids.filter((x) => x !== r.id) })}>Geri al</button>))}</ul>
      </>}
      <b style={{ display: "block", margin: "12px 0 6px" }}>Elle talep ekle</b>
      <form className="sc-search" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <input className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Başlık veya talep no ile ara" aria-label={`${b.title} bölümüne eklenecek talebi ara`} />
        <button type="submit" className="btn btn-bl">Ara</button>
      </form>
      {found && (!found.length ? <p className="muted" style={{ fontSize: 12.5 }}>Talep bulunamadı.</p> : (
        <ul className="sc-pick">{found.map((r) => row(r, b.include_ids.includes(r.id) ? <span className="muted" style={{ fontSize: 12 }}>Eklendi</span>
          : <button type="button" className="btn btn-or btn-sm" aria-label={`${r.title} bölüme ekle`} onClick={() => add(r)}>Ekle</button>))}</ul>
      ))}
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Elle eklenen talepler en başta görünür; çıkardığınız talep bu bölümde bir daha görünmez (Geri al ile geri gelir). Bölümü göstermek/gizlemek için yukarıdaki Göster/Gizle düğmesini kullanın.</p>
    </div>
  );
}
