"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, uploadFile, type Media } from "@/lib/api";
import { brandsOf, isVehicleSub, useVehicleCatalog } from "@/lib/vehicles";
import { useSession } from "./Session";

type Item = { id: number; title: string; category_id: string; marka: string | null; model: string | null; is_active: boolean; uses: number; media: Media };

// Yönetim → Hazır Görseller: alıcıların talep verirken seçebileceği örnek görseller.
export function StockAdmin() {
  const { categories, toast } = useSession();
  const cat = useVehicleCatalog();
  const [items, setItems] = useState<Item[] | null>(null);
  const [form, setForm] = useState({ category_id: "", marka: "", model: "", title: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [show, setShow] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => setItems((await api<{ items: Item[] }>("/admin/stock-images")).items), []);
  useEffect(() => { void load().catch((e) => toast((e as Error).message)); }, [load, toast]);

  const subs = categories.flatMap((t) => t.subs.map((s) => ({ id: s.id, name: `${t.name} › ${s.name}` })));
  const name = (id: string) => subs.find((s) => s.id === id)?.name ?? categories.find((t) => t.id === id)?.name ?? id;
  const vehicle = isVehicleSub(form.category_id);
  const brands = cat && vehicle ? brandsOf(cat, form.category_id) : {};

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!form.category_id) { toast("Önce kategori seçin."); return; }
    let ok = 0;
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) { toast(`"${f.name}" resim değil.`); continue; }
      try {
        setBusy(`${f.name} yükleniyor… %0`);
        const m = await uploadFile(f, (p) => setBusy(`${f.name} yükleniyor… %${p}`));
        await api("/admin/stock-images", { body: { media_id: m.id, category_id: form.category_id, marka: form.marka || null, model: form.model || null, title: form.title || [form.marka, form.model].filter(Boolean).join(" ") } });
        ok++;
      } catch (e) { toast((e as Error).message); }
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    if (ok) toast(`${ok} görsel galeriye eklendi.`);
    await load();
  };
  const toggle = async (it: Item) => {
    try { await api(`/admin/stock-images/${it.id}`, { method: "PATCH", body: { is_active: !it.is_active } }); await load(); }
    catch (e) { toast((e as Error).message); }
  };
  const shown = (items ?? []).filter((it) => !show || it.category_id === show);

  return (
    <div className="box"><div className="box-h"><h2>Hazır Görseller</h2></div><div className="box-b">
      <div className="note n-info" style={{ marginBottom: 12 }}><span>Alıcılar talep verirken "Hazır görsellerden seç" ile buradaki görselleri kullanır; talebin kategorisine ve araçta seçilen marka/modele uyanlar önce çıkar. Yalnızca kullanım hakkınız olan görselleri yükleyin (kendi çektikleriniz, lisanslı veya ücretsiz kullanım izni olan stok görseller).</span></div>
      <div className="form-grid" style={{ maxWidth: 760 }}>
        <div className="fg"><label htmlFor="st-c">Kategori *</label><select className="sel" id="st-c" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value, marka: "", model: "" })}><option value="">Seçin</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        {vehicle && <div className="fg"><label htmlFor="st-m">Marka</label><select className="sel" id="st-m" value={form.marka} onChange={(e) => setForm({ ...form, marka: e.target.value, model: "" })}><option value="">Tüm markalar</option>{Object.keys(brands).map((b) => <option key={b}>{b}</option>)}</select></div>}
        {vehicle && form.marka && <div className="fg"><label htmlFor="st-mo">Model</label><select className="sel" id="st-mo" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}><option value="">Tüm modeller</option>{(brands[form.marka] ?? []).map((m) => <option key={m}>{m}</option>)}</select></div>}
        <div className="fg"><label htmlFor="st-t">Başlık (isteğe bağlı)</label><input className="inp" id="st-t" value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Örn. Beyaz sedan, 3+1 daire salon" /></div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void add(e.target.files)} aria-label="Galeri görseli seç" />
      <button className="btn btn-or" style={{ marginTop: 10 }} disabled={!!busy} onClick={() => input.current?.click()}>+ Görsel yükle</button>
      {busy && <span className="muted" style={{ marginLeft: 10 }}>{busy}</span>}

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "18px 0 8px" }}>
        <b style={{ fontSize: 13 }}>Galeride {items?.filter((x) => x.is_active).length ?? 0} görsel</b>
        <select className="sel" style={{ width: "auto", height: 30, fontSize: 12.5 }} value={show} onChange={(e) => setShow(e.target.value)} aria-label="Kategoriye göre göster"><option value="">Tüm kategoriler</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>
      {!items ? <div className="loading">Yükleniyor…</div> : !shown.length ? <div className="empty">Henüz görsel yok.</div> : (
        <div className="stk-grid">{shown.map((it) => (
          <div key={it.id} className={"stk-adm" + (it.is_active ? "" : " off")}>
            <img src={it.media.url} alt="" loading="lazy" />
            <div className="stk-adm-b">
              <b>{it.title || [it.marka, it.model].filter(Boolean).join(" ") || "Başlıksız"}</b>
              <span className="muted">{name(it.category_id)}{it.marka && ` · ${it.marka}${it.model ? ` ${it.model}` : ""}`}</span>
              <span className="muted">{it.uses} kez seçildi</span>
              <button className="link" style={{ fontSize: 12, textAlign: "left" }} onClick={() => void toggle(it)}>{it.is_active ? "Yayından kaldır" : "Yayına al"}</button>
            </div>
          </div>
        ))}</div>
      )}
    </div></div>
  );
}
