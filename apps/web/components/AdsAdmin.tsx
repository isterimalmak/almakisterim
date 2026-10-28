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

  const sections = ([["home_vitrin", "Ana Sayfa Vitrini", "Resimli talep kutucukları", homeVitrin], ["home_latest", "Son Eklenen Talepler", "En yeni taleplerin listesi", homeLatest]] as const);
  return (
    <>
      <div className="box rk"><div className="box-h"><h2>Reklamlar</h2>{items && <span className="muted rk-say">{items.length} reklam</span>}</div><div className="box-b">
        {items && <Summary items={items} />}

        {/* Yeni reklam: önce yer seçilir, sonra dosya */}
        <div className="rk-ekle">
          <span className="rk-et">Yeni reklam · nereye eklensin?</span>
          <div className="rk-ekle-sat">
            <div className="rk-seg" role="radiogroup" aria-label="Yeni reklamın yeri">
              <label><input type="radio" name="yk-yer" checked={target === "orta"} onChange={() => setTarget("orta")} />Ana sayfanın ortası (vitrin yeri)</label>
              <label><input type="radio" name="yk-yer" checked={target === "sol"} onChange={() => setTarget("sol")} />Sol sütun (kategorilerin altı)</label>
              <label><input type="radio" name="yk-yer" checked={target === "acilis"} onChange={() => setTarget("acilis")} />Yalnız açılış penceresi (ana sayfada görünmez)</label>
            </div>
            <button className="btn btn-or" disabled={!!busy} onClick={() => input.current?.click()}>+ Resim veya video ekle</button>
          </div>
          <small className="muted">{busy ?? "JPG, PNG, WEBP veya MP4 · önerilen boyut 460×300 ya da 460×600 piksel"}</small>
          <input ref={input} type="file" accept={TYPES.join(",")} multiple hidden onChange={(e) => void add(e.target.files)} aria-label="Reklam dosyası seç" />
        </div>

        {!items ? <div className="loading">Yükleniyor…</div> : !items.length ? <div className="empty">Henüz reklam yok. Yukarıdan yerini seçip ilk reklamınızı ekleyin.</div> : (
          <div className="yk-yon">
            {items.map((a, i) => (
              <div key={a.id} className={"yk-satir" + (a.is_active ? "" : " off")}>
                <div className="yk-on">{a.media.kind === "video" ? <video src={a.media.url} muted playsInline preload="metadata" /> : <img src={a.media.url} alt="" />}</div>
                <div className="yk-alan">
                  <div className="rk-bas">
                    <input className="rk-ad" defaultValue={a.title} placeholder="Başlıksız reklam" aria-label={`${i + 1}. reklam başlığı`} onBlur={(e) => e.target.value !== a.title && void patch(a, { title: e.target.value })} />
                    <span className="rk-etiketler">
                      {!a.is_active && <span className="rk-et-k gri">Kapalı</span>}
                      {a.placement !== "yok" && <span className="rk-et-k">{a.placement === "orta" ? "Ana sayfa ortası" : "Sol sütun"}</span>}
                      {a.is_welcome && <span className="rk-et-k tur">Açılış penceresi</span>}
                      {a.device !== "all" && <span className="rk-et-k gri">{a.device === "mobile" ? "Yalnız telefon" : "Yalnız bilgisayar"}</span>}
                    </span>
                  </div>
                  <div className="rk-izgara">
                    <label><span>Bağlantı</span><input className="inp" defaultValue={a.link_url ?? ""} placeholder="www.siteniz.com veya /kategori/vasita" aria-label={`${i + 1}. reklam bağlantısı`} onBlur={(e) => e.target.value !== (a.link_url ?? "") && void patch(a, { link_url: e.target.value })} /></label>
                    <label><span>Yer</span><select className="sel" value={a.placement ?? "sol"} aria-label={`${i + 1}. reklamın yeri`} onChange={(e) => void patch(a, { placement: e.target.value as "sol" | "orta" | "yok" })}><option value="orta">Ana sayfa ortası</option><option value="sol">Sol sütun</option><option value="yok">Hiçbir yerde</option></select></label>
                    <label><span>Cihaz</span><select className="sel" value={a.device ?? "all"} aria-label={`${i + 1}. reklamın cihazı`} onChange={(e) => void patch(a, { device: e.target.value as "all" | "mobile" | "desktop" })}><option value="all">Telefon ve bilgisayar</option><option value="mobile">Yalnız telefon</option><option value="desktop">Yalnız bilgisayar</option></select></label>
                  </div>
                  <div className="rk-alt">
                    <label className="chk"><input type="checkbox" checked={!!a.is_welcome} onChange={(e) => { const on = e.target.checked; setItems((xs) => xs && xs.map((x) => ({ ...x, is_welcome: x.id === a.id ? on : on ? false : x.is_welcome }))); void patch(a, { is_welcome: on }); }} aria-label={`${i + 1}. reklam açılışta göster`} />Siteye girişte açılış penceresinde göster</label>
                    <span className={where(a) ? "sr-only" : "yk-nerde uyari"} aria-label={`${i + 1}. reklamın göründüğü yer`}>{where(a) ? `Görüneceği yer: ${where(a)}` : "Şu an hiçbir yerde görünmüyor: yer seçin ya da açılış penceresini işaretleyin."}</span>
                  </div>
                </div>
                <div className="yk-is">
                  <span className="rk-yayin"><button className={"sw" + (a.is_active ? " on" : "")} role="switch" aria-checked={a.is_active} aria-label={`${i + 1}. reklam yayında`} onClick={() => void patch(a, { is_active: !a.is_active })} /><small>{a.is_active ? "Yayında" : "Kapalı"}</small></span>
                  <span className="rk-sira">
                    <button className="btn btn-wh btn-sm" disabled={i === 0} aria-label="Yukarı taşı" title="Yukarı taşı" onClick={() => void move(i, -1)}>↑</button>
                    <button className="btn btn-wh btn-sm" disabled={i === items.length - 1} aria-label="Aşağı taşı" title="Aşağı taşı" onClick={() => void move(i, 1)}>↓</button>
                  </span>
                  <button className="btn btn-gh btn-sm rk-sil" onClick={() => void remove(a)}>Sil</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="muted rk-not">Reklamlar buradaki sırayla, ikişerli dizilir; sayı tekse son reklam tam genişlikte durur. Video sessiz başlar, ziyaretçi köşedeki düğmeyle sesi açar.</p>
      </div></div>

      <div className="box rk" style={{ marginTop: 14 }}><div className="box-h"><h2>Ana sayfa bölümleri</h2></div><div className="box-b">
        <div className="yk-bol">
          {sections.map(([k, l, h, on]) => (
            <div key={k} className="yk-bol-i">
              <div><b>{l}</b><small>{h} · {on ? "Ana sayfada görünüyor" : "Gizli"}</small></div>
              <button type="button" className={"btn btn-sm " + (on ? "btn-wh" : "btn-or")} onClick={() => void section(k, !on)}>{on ? (k === "home_vitrin" ? "Vitrini gizle" : "Son talepleri gizle") : (k === "home_vitrin" ? "Vitrini göster" : "Son talepleri göster")}</button>
            </div>
          ))}
        </div>
        <p className="muted rk-not" style={{ marginBottom: 0 }}>Site yeniyken talep az olduğu için bu bölümleri gizleyebilirsiniz; ortaya eklediğiniz reklamlar vitrinin yerinde görünür.</p>
      </div></div>
    </>
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

// Yerleşim özeti: her alanda telefonda ve bilgisayarda kaç reklam görünüyor ve açılış penceresinde hangisi var.
function Summary({ items }: { items: Ad[] }) {
  const live = items.filter((a) => a.is_active);
  const count = (p: string, d: "mobile" | "desktop") => live.filter((a) => a.placement === p && (a.device ?? "all") !== (d === "mobile" ? "desktop" : "mobile")).length;
  const welcome = live.find((a) => a.is_welcome);
  const tile = (p: string, label: string) => {
    const m = count(p, "mobile"), d = count(p, "desktop");
    return (
      <div className="rk-kut" key={p}>
        <span className="rk-et">{label}:</span>
        <b>{Math.max(m, d)}<small> reklam</small></b>
        <small className="muted">telefonda {m} · bilgisayarda {d}</small>
      </div>
    );
  };
  return (
    <div className="rk-ozet" aria-label="Yerleşim özeti">
      {tile("orta", "Ana sayfanın ortası")}
      {tile("sol", "Sol sütun")}
      <div className="rk-kut">
        <span className="rk-et">Açılış penceresi:</span>
        <b className="rk-kut-ad">{welcome ? welcome.title || "Başlıksız reklam" : "Yok"}</b>
        <small className="muted">{welcome ? DEVICE[welcome.device ?? "all"] : "siteye girişte reklam açılmıyor"}</small>
      </div>
    </div>
  );
}
