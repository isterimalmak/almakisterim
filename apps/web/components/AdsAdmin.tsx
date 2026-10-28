"use client";

import { saveHomeBlocks, withHidden } from "@/lib/home";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, uploadFile, type Ad } from "@/lib/api";
import { useSession } from "./Session";

const TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"];

// Yönetim paneli: ana sayfada sol sütundaki reklam kutuları. İstenildiği kadar eklenir, sırası değiştirilir.
export function AdsAdmin() {
  const { toast, homeVitrin, homeLatest, homeBlocks, refresh } = useSession();
  // Yüklenecek dosyanın yeri: ana sayfanın ortası, sol sütun ya da yalnız açılış penceresi.
  const [target, setTarget] = useState<"sol" | "orta" | "acilis">("orta");
  const section = async (key: "home_vitrin" | "home_latest", on: boolean) => {
    try {
      await saveHomeBlocks(withHidden(homeBlocks, key === "home_vitrin" ? "vitrin" : "latest", !on));
      await refresh();
      toast(`${key === "home_vitrin" ? "Ana Sayfa Vitrini" : "Son Eklenen Talepler"} ${on ? "ana sayfada gösteriliyor." : "ana sayfada gizlendi."}`);
    } catch (e) { toast((e as Error).message); }
  };
  const [items, setItems] = useState<Ad[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => setItems((await api<{ items: Ad[] }>("/admin/tanitim")).items), []);
  useEffect(() => { void load().catch((e) => toast((e as Error).message)); }, [load, toast]);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    let ok = 0;
    for (const f of Array.from(files)) {
      if (!TYPES.includes(f.type)) { toast(`"${f.name}" desteklenmiyor. JPG, PNG, WEBP resim veya MP4, MOV, WEBM video seçin.`); continue; }
      try {
        setBusy(`${f.name} yükleniyor… %0`);
        const m = await uploadFile(f, (pct) => setBusy(`${f.name} yükleniyor… %${pct}`));
        const welcomeOnly = target === "acilis";
        await api("/admin/tanitim", { body: { media_id: m.id, title: f.name.replace(/\.[^.]+$/, ""), placement: welcomeOnly ? "yok" : target, is_welcome: welcomeOnly } });
        ok++;
      } catch (e) { toast((e as Error).message); }
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    if (ok) toast(target === "acilis" ? "Reklam eklendi; siteye girişte açılış penceresinde görünüyor." : ok > 1 ? `${ok} reklam eklendi; ana sayfada görünüyor.` : "Reklam eklendi; ana sayfada görünüyor.");
    await load();
  };

  const patch = async (a: Ad, body: Partial<Pick<Ad, "title" | "link_url" | "is_active" | "is_welcome" | "placement" | "device">>) => {
    try { await api(`/admin/tanitim/${a.id}`, { method: "PATCH", body }); await load(); }
    catch (e) { toast((e as Error).message); }
  };
  const move = async (i: number, d: -1 | 1) => {
    if (!items) return;
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    setItems(next);
    await api("/admin/tanitim/order", { body: { ids: next.map((x) => x.id) } }).catch((e) => toast((e as Error).message));
  };
  const remove = async (a: Ad) => {
    if (!confirm("Bu reklam ve dosyası silinsin mi?")) return;
    await api(`/admin/tanitim/${a.id}`, { method: "DELETE" }).catch((e) => toast((e as Error).message));
    toast("Reklam silindi.");
    await load();
  };

  return (
    <div className="box"><div className="box-h"><h2>Reklam Alanları</h2></div><div className="box-b">
      <h3 style={{ fontSize: 14, margin: "0 0 8px" }}>Ana sayfa bölümleri</h3>
      <div className="yk-bol">
        {([["home_vitrin", "Ana Sayfa Vitrini", "Resimli talep kutucukları", homeVitrin], ["home_latest", "Son Eklenen Talepler", "En yeni taleplerin listesi", homeLatest]] as const).map(([k, l, h, on]) => (
          <div key={k} className="yk-bol-i">
            <div><b>{l}</b><small>{h} · {on ? "Ana sayfada görünüyor" : "Gizli"}</small></div>
            <button type="button" className={"btn btn-sm " + (on ? "btn-wh" : "btn-or")} onClick={() => void section(k, !on)}>{on ? (k === "home_vitrin" ? "Vitrini gizle" : "Son talepleri gizle") : (k === "home_vitrin" ? "Vitrini göster" : "Son talepleri göster")}</button>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12.5, margin: "0 0 14px" }}>Site yeniyken talep az olduğu için bu bölümleri gizleyebilirsiniz. Ana sayfanın ortasına eklediğiniz resim ve videolar vitrinin yerinde, büyük kutular hâlinde görünür.</p>
      <div className="note n-info" style={{ marginBottom: 12 }}><span>Eklediğiniz resim ve videolar seçtiğiniz yerde, buradaki sırayla görünür: "Ana sayfanın ortası" vitrinin yerinde büyük kutular, "Sol sütun" kategorilerin altında alt alta (telefonda kategorilerin altında). İstediğiniz kadar ekleyebilirsiniz. Önerilen boyut: 460×300 veya 460×600 piksel; video sessiz başlar, ziyaretçi köşedeki düğmeyle sesi açabilir. "Açılışta göster" işaretlediğiniz reklam siteye girişte ekranın ortasında açılır (tek bir reklam seçilebilir; videoda ses açık başlatılmaya çalışılır). Reklamı yalnız açılışta göstermek için yerini "Hiçbir yerde" seçin. Reklamlar ikişerli dizilir; sayı tekse son reklam tam genişlikte durur. Her reklamın altındaki "Tıklayınca gideceği adres" kutusuna bağlantı yazarsanız reklama tıklayan oraya gider.</span></div>
      <input ref={input} type="file" accept={TYPES.join(",")} multiple hidden onChange={(e) => void add(e.target.files)} aria-label="Reklam dosyası seç" />
      {items && <Summary items={items} />}
      <div className="radio-row" style={{ marginBottom: 8 }}>
        <label><input type="radio" name="yk-yer" checked={target === "orta"} onChange={() => setTarget("orta")} />Ana sayfanın ortası (vitrin yeri)</label>
        <label><input type="radio" name="yk-yer" checked={target === "sol"} onChange={() => setTarget("sol")} />Sol sütun (kategorilerin altı)</label>
        <label><input type="radio" name="yk-yer" checked={target === "acilis"} onChange={() => setTarget("acilis")} />Yalnız açılış penceresi (ana sayfada görünmez)</label>
      </div>
      <button className="btn btn-or" disabled={!!busy} onClick={() => input.current?.click()}>+ Resim veya video ekle</button>
      {busy && <span className="muted" style={{ marginLeft: 10 }}>{busy}</span>}
      {!items ? <div className="loading">Yükleniyor…</div> : !items.length ? <div className="empty">Henüz reklam yok.</div> : (
        <div className="yk-yon">
          {items.map((a, i) => (
            <div key={a.id} className={"yk-satir" + (a.is_active ? "" : " off")}>
              <div className="yk-on">{a.media.kind === "video" ? <video src={a.media.url} muted playsInline preload="metadata" /> : <img src={a.media.url} alt="" />}</div>
              <div className="yk-alan">
                <label>Başlık<input className="inp" defaultValue={a.title} aria-label={`${i + 1}. reklam başlığı`} onBlur={(e) => e.target.value !== a.title && void patch(a, { title: e.target.value })} /></label>
                <label>Tıklayınca gideceği adres (isteğe bağlı)<input className="inp" defaultValue={a.link_url ?? ""} placeholder="www.siteniz.com veya /kategori/vasita" aria-label={`${i + 1}. reklam bağlantısı`} onBlur={(e) => e.target.value !== (a.link_url ?? "") && void patch(a, { link_url: e.target.value })} /></label>
                <label>Nerede görünsün<select className="sel" value={a.placement ?? "sol"} aria-label={`${i + 1}. reklamın yeri`} onChange={(e) => void patch(a, { placement: e.target.value as "sol" | "orta" | "yok" })}><option value="orta">Ana sayfanın ortası (vitrin yeri)</option><option value="sol">Sol sütun (kategorilerin altı)</option><option value="yok">Hiçbir yerde (ana sayfada gösterme)</option></select></label>
                <label>Hangi cihazda<select className="sel" value={a.device ?? "all"} aria-label={`${i + 1}. reklamın cihazı`} onChange={(e) => void patch(a, { device: e.target.value as "all" | "mobile" | "desktop" })}><option value="all">Her yerde (telefon ve bilgisayar)</option><option value="mobile">Yalnız telefonda</option><option value="desktop">Yalnız bilgisayarda (web)</option></select></label>
                <label className="chk"><input type="checkbox" checked={!!a.is_welcome} onChange={(e) => { const on = e.target.checked; setItems((xs) => xs && xs.map((x) => ({ ...x, is_welcome: x.id === a.id ? on : on ? false : x.is_welcome }))); void patch(a, { is_welcome: on }); }} aria-label={`${i + 1}. reklam açılışta göster`} />Açılışta göster (siteye girince ekranın ortasında çıkar)</label>
                <div className={"yk-nerde" + (where(a) ? "" : " uyari")} aria-label={`${i + 1}. reklamın göründüğü yer`}>{where(a) ? `Görüneceği yer: ${where(a)}` : "Bu reklam şu an hiçbir yerde görünmüyor. Yer seçin ya da \"Açılışta göster\"i işaretleyin."}</div>
              </div>
              <div className="yk-is">
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

const PLACE: Record<string, string> = { orta: "ana sayfanın ortası", sol: "sol sütun (telefonda kategorilerin altı)" };
const DEVICE: Record<string, string> = { all: "telefon ve bilgisayar", mobile: "yalnız telefon", desktop: "yalnız bilgisayar" };

// Reklamın sitede nerede çıktığını tek cümleyle anlatır; hiçbir yerde görünmüyorsa boş döner.
function where(a: Ad) {
  if (!a.is_active) return "kapalı (yayında değil)";
  const parts = [PLACE[a.placement ?? "sol"], a.is_welcome ? "siteye girişte açılış penceresi" : null].filter(Boolean);
  return parts.length ? `${parts.join(" + ")} · ${DEVICE[a.device ?? "all"]}` : "";
}

// Yerleşim özeti: her alanda telefonda ve bilgisayarda kaç reklam görünüyor; tek sayıda ise sonuncusu tam genişlikte durur.
function Summary({ items }: { items: Ad[] }) {
  const live = items.filter((a) => a.is_active);
  const count = (p: string, d: "mobile" | "desktop") => live.filter((a) => a.placement === p && (a.device ?? "all") !== (d === "mobile" ? "desktop" : "mobile")).length;
  const welcome = live.find((a) => a.is_welcome);
  const row = (p: string, label: string) => {
    const m = count(p, "mobile"), d = count(p, "desktop");
    if (!m && !d) return null;
    const odd = (n: number) => n > 1 && n % 2 === 1;
    return <li key={p}><b>{label}:</b> telefonda {m}, bilgisayarda {d} reklam{odd(m) || (p === "orta" && odd(d)) ? " — tek sayıda olduğu için son reklam tam genişlikte gösterilir, yanında boşluk kalmaz" : ""}.</li>;
  };
  return (
    <ul className="yk-ozet" aria-label="Yerleşim özeti">
      {row("orta", "Ana sayfanın ortası")}
      {row("sol", "Sol sütun")}
      <li><b>Açılış penceresi:</b> {welcome ? `"${welcome.title || "başlıksız reklam"}" (${DEVICE[welcome.device ?? "all"]})` : "yok"}.</li>
    </ul>
  );
}
