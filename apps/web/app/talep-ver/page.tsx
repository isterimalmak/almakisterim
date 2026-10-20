"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Gallery, MediaPicker } from "@/components/Media";
import { CatIcon } from "@/components/RequestTable";
import { PhoneVerify } from "@/components/PhoneVerify";
import { placeTxt, useDistricts, useNeighbourhoods } from "@/lib/locations";
import { useSession } from "@/components/Session";
import { VehicleFields, VehicleRows } from "@/components/VehicleFields";
import { api, type Draft, type Media } from "@/lib/api";
import { attrsFor, CITIES, condsFor } from "@/lib/catalog";
import { budgetTxt } from "@/lib/format";
import { isVehicleSub, type VehicleAttrs } from "@/lib/vehicles";

type D = { step: 1 | 2 | 3; raw: string; top: string; sub: string; title: string; description: string; b0: string; b1: string; city: string; district: string; hood: string; condition: string; attrs: Record<string, unknown>; days: 7 | 14 | 30; urgent: boolean; corporate: boolean; agree: boolean; media: Media[];
  // Birden fazla araç seçildiyse her aracın kendi fotoğrafları ("Marka|Model" → medya); her araç ayrı talep olur.
  carMedia: Record<string, Media[]> };
const EMPTY: D = { step: 1, raw: "", top: "", sub: "", title: "", description: "", b0: "", b1: "", city: "", district: "", hood: "", condition: "Farketmez", attrs: {}, days: 14, urgent: false, corporate: false, agree: false, media: [], carMedia: {} };
const KEY = "ak_taslak";

function Create() {
  const { categories, user, toast, phoneRequired, photoRequired } = useSession();
  const router = useRouter();
  const sp = useSearchParams();
  const [d, setD] = useState<D>(EMPTY);
  // Kategori değişince ürün durumu o kategoride geçerli bir değere çekilir (ör. emlakta "Hizmet" kalmasın).
  useEffect(() => {
    const ok = condsFor(d.top);
    if (!ok.includes(d.condition)) setD((x) => ({ ...x, condition: ok.includes("Farketmez") ? "Farketmez" : ok[0]! }));
  }, [d.top, d.condition]);
  const districts = useDistricts(d.city);
  const hoods = useNeighbourhoods(d.city, d.district);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [mod, setMod] = useState<{ verdict: string; reason: string } | null>(null);
  // Yapay zekânın doldurduğu ve kişiye kalan alanlar (Talep Detayları'nın üstünde gösterilir).
  const [aiFill, setAiFill] = useState<{ filled: string[]; missing: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const set = (p: Partial<D>) => setD((x) => ({ ...x, ...p }));

  // Adımlar tarayıcı geçmişine yazılır (?adim=2): telefonun ya da tarayıcının geri tuşu sayfadan çıkmaz, bir önceki adıma döner.
  // Sayfadaki "Geri"/"Düzenle" düğmeleri de geçmişte geri gider; böylece ileri/geri tuşları adımlarla hep uyumlu kalır.
  const urlStep = Math.min(3, Math.max(1, Number(sp.get("adim") ?? 1))) as D["step"];
  const pushed = useRef(0);
  const reached = useRef(1);
  useEffect(() => {
    // Adres ?adim=3 ile açıldıysa (yenileme, paylaşılan bağlantı) ve elde taslak yoksa ilk adımdan başlanır.
    if (urlStep > 1 && !pushed.current) { const p = new URLSearchParams(window.location.search); p.delete("adim"); window.history.replaceState(null, "", p.size ? `?${p}` : window.location.pathname); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Adres, yeni adım ekrana çizilmeden önce güncellenir; hemen geri tuşuna basılsa da bir önceki adıma dönülür.
  useLayoutEffect(() => {
    reached.current = Math.max(reached.current, d.step);
    if (d.step === urlStep) return;
    if (d.step > urlStep) {
      const p = new URLSearchParams(window.location.search); p.set("adim", String(d.step));
      window.history.pushState(null, "", `?${p}`);
      pushed.current++;
    } else if (pushed.current > 0) { pushed.current--; window.history.back(); }
    else { const p = new URLSearchParams(window.location.search); p.delete("adim"); window.history.replaceState(null, "", p.size ? `?${p}` : window.location.pathname); }
  }, [d.step]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Geri tuşuna basıldı: adres bir önceki adımı gösteriyor.
    if (urlStep < d.step) { pushed.current = Math.max(0, pushed.current - 1); setD((x) => ({ ...x, step: urlStep })); window.scrollTo(0, 0); }
    // İleri tuşu: yalnız daha önce ulaşılmış bir adıma dönülür.
    else if (urlStep > d.step && urlStep <= reached.current) { pushed.current++; setD((x) => ({ ...x, step: urlStep })); window.scrollTo(0, 0); }
  }, [urlStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Giriş sonrası geri dönülünce taslak kaybolmasın.
  useEffect(() => {
    try { const s = sessionStorage.getItem(KEY); if (s) { setD({ ...EMPTY, ...JSON.parse(s) }); sessionStorage.removeItem(KEY); } } catch { /* tarayıcı depolaması kapalı olabilir */ }
  }, []);

  const runAi = async (text: string) => {
    if (text.trim().length < 5) return toast("Önce ne almak istediğinizi birkaç kelimeyle yazın.");
    setAiBusy(true); setAiMsg("");
    try {
      const { draft, moderation } = await api<{ draft: Draft; moderation: { verdict: string; reason: string } }>("/ai/draft", { body: { text } });
      setMod(moderation);
      const top = categories.find((t) => t.subs.some((s) => s.id === draft.category_id));
      const newCity = !!draft.city && draft.city !== d.city;
      setD((x) => ({
        ...x, raw: text, title: draft.title, description: draft.description, condition: draft.condition,
        b1: draft.budget_max ? String(draft.budget_max) : x.b1, b0: draft.budget_min ? String(draft.budget_min) : x.b0,
        city: draft.city ?? x.city, district: draft.district || (newCity ? "" : x.district), hood: draft.neighbourhood || (newCity || draft.district ? "" : x.hood),
        urgent: draft.is_urgent, attrs: draft.attrs,
        ...(top ? { top: top.id, sub: draft.category_id!, step: 2 as const } : {}),
      }));
      // Neyin dolduğu, neyin kişiye kaldığı açıkça yazılır.
      const filled: string[] = [], missing: string[] = [];
      const sub = top?.subs.find((s) => s.id === draft.category_id);
      if (sub) filled.push(`Kategori (${top!.name} › ${sub.name})`);
      if (draft.title) filled.push("Başlık");
      if (draft.description) filled.push("Açıklama");
      if (draft.budget_max) filled.push("Bütçe"); else missing.push("En fazla bütçe");
      if (draft.city) filled.push([draft.city, draft.district, draft.neighbourhood].filter(Boolean).join(" / ")); else missing.push("İl");
      if (draft.condition !== "Farketmez") filled.push(`Durum (${draft.condition})`);
      if (draft.is_urgent) filled.push("Acil");
      if (sub && isVehicleSub(sub.id)) { if (Array.isArray(draft.attrs.araclar) && draft.attrs.araclar.length) filled.push("Araç bilgileri"); }
      else if (sub) for (const a of attrsFor(top!.id, sub.id)) if (draft.attrs[a.k] !== undefined) filled.push(a.l.replace(/ \(.*\)$/, ""));
      if (photoRequired) missing.push("Fotoğraf");
      setAiFill(sub ? { filled, missing } : null);
      if (top) toast("Alanlar dolduruldu, lütfen kontrol edin.");
      else setAiMsg("Kategoriyi belirleyemedik, lütfen aşağıdan seçin. Diğer bilgiler sonraki adımda dolu gelecek.");
    } catch (e) { setAiMsg((e as Error).message); } finally { setAiBusy(false); }
  };

  useEffect(() => {
    const k = sp.get("kategori");
    if (k && !started.current && categories.some((t) => t.id === k)) { started.current = true; set({ top: k, sub: "" }); }
    const m = sp.get("metin");
    if (m && !started.current && categories.length) { started.current = true; set({ raw: m }); void runAi(m); }
  }, [sp, categories.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hazır görseller, listede seçilip henüz eklenmemiş aracı da hesaba katar (Bentley seçince Bentley görselleri gelsin).
  const [draftCar, setDraftCar] = useState<{ marka: string; model: string | null } | null>(null);
  const stockAttrs = useMemo(() => {
    const list = Array.isArray(d.attrs.araclar) ? d.attrs.araclar as { marka: string; model: string | null }[] : [];
    if (!draftCar || list.some((x) => x.marka === draftCar.marka && x.model === draftCar.model)) return d.attrs;
    return { ...d.attrs, araclar: [draftCar, ...list] };
  }, [d.attrs, draftCar]);
  const top = categories.find((t) => t.id === d.top);
  const sub = top?.subs.find((s) => s.id === d.sub);
  const vehicle = isVehicleSub(d.sub);
  const sch = vehicle ? [] : attrsFor(d.top, d.sub);
  // Birden fazla araç: her biri ayrı talep olarak, kendi fotoğraflarıyla yayınlanır.
  const cars = vehicle && Array.isArray(d.attrs.araclar) ? d.attrs.araclar as { marka: string; model: string | null }[] : [];
  const multi = cars.length > 1;
  const carKey = (c: { marka: string; model: string | null }) => `${c.marka}|${c.model ?? ""}`;
  const carLabel = (c: { marka: string; model: string | null }) => c.model ? `${c.marka} ${c.model}` : `${c.marka} (tüm modeller)`;

  const validate = () => {
    if (d.title.trim().length < 3) return "Talep başlığı yazın.";
    if (!(Number(d.b1) > 0)) return "En fazla bütçeyi yazın.";
    if (d.b0 && Number(d.b0) > Number(d.b1)) return "En az bütçe, en fazla bütçeden büyük olamaz.";
    if (!d.city) return "İl seçin.";
    if (photoRequired && multi) {
      const miss = cars.find((c) => !(d.carMedia[carKey(c)] ?? []).some((m) => m.kind === "image"));
      if (miss) return `En az bir fotoğraf ekleyin: ${carLabel(miss)} için kendi fotoğrafınızı yükleyin ya da hazır görsellerden seçin.`;
    } else if (photoRequired && !d.media.some((m) => m.kind === "image")) return "En az bir fotoğraf ekleyin: kendi fotoğrafınızı yükleyin ya da hazır görsellerden seçin.";
    return null;
  };

  const publish = async () => {
    if (!d.agree) return toast("Yayınlamak için kuralları ve numara paylaşımını onaylayın.");
    if (user && !user.phone && phoneRequired) return toast("Yayınlamadan önce telefon numaranızı doğrulayın.");
    if (!user) {
      try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch { /* yoksay */ }
      router.push("/giris?sonra=/talep-ver");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ id: number; ids?: number[]; status: string; moderation: { reason: string } | null }>("/requests", { body: {
        category_id: d.sub, title: d.title, description: d.description, budget_min: d.b0 ? Number(d.b0) : null, budget_max: Number(d.b1),
        city: d.city, district: d.district, neighbourhood: d.hood, condition: d.condition, attrs: Object.fromEntries(Object.entries(d.attrs).filter(([, v]) => v !== "" && v !== undefined)),
        is_urgent: d.urgent, is_corporate: d.corporate, days: d.days, contact_consent: true,
        media_ids: multi ? [] : d.media.map((m) => m.id),
        ...(multi ? { vehicle_media: Object.fromEntries(cars.map((c) => [carKey(c), (d.carMedia[carKey(c)] ?? []).map((m) => m.id)])) } : {}),
      } });
      const n = res.ids?.length ?? 1;
      toast(n > 1 && res.status === "active" ? `${n} araç için ${n} ayrı talep yayınlandı. Her aracın satıcıları ayrı ayrı haberdar edildi.`
        : res.status === "active" ? "Talebiniz yayında. Satıcılara bildirim gönderildi."
        : res.status === "rejected" ? `Talebiniz kurallara uymadığı için yayınlanmadı${res.moderation?.reason ? `: ${res.moderation.reason}` : "."}`
        : "Talebiniz incelemeye alındı. Onaylanınca yayınlanacak.");
      router.push(`/talep/${res.id}`);
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };

  const steps = ["Kategori", "Talep Detayları", "Önizleme", "Yayında"];
  return (
    <div className="wrap" style={{ paddingBottom: 40, maxWidth: 980 }}>
      <div className="crumb"><Link href="/">Ana Sayfa</Link> › Ücretsiz Talep Ver</div>
      <div className="stepper">{steps.map((s, i) => <div key={s} className={d.step === i + 1 ? "on" : d.step > i + 1 ? "done" : ""}><span className="n">{d.step > i + 1 ? "✓" : i + 1}</span><span className="t">{s}</span></div>)}</div>

      {d.step === 1 && (
        <>
          <div className="ai-quick">
            <h3>Ne almak istiyorsunuz?</h3>
            <p>Arkadaşınıza anlatır gibi yazın: ne aradığınızı, bütçenizi, il ve semtini, olmazsa olmazlarınızı. Ne kadar ayrıntı verirseniz yapay zekâ formu o kadar eksiksiz doldurur. İsterseniz kategoriyi aşağıdan kendiniz de seçebilirsiniz.</p>
            <textarea className="txa" rows={2} value={d.raw} onChange={(e) => set({ raw: e.target.value })} maxLength={1500} placeholder="Örn. 2015 sonrası dizel Passat arıyorum, bütçem 1.200.000 TL, İstanbul" aria-label="Ne almak istiyorsunuz?" />
            <div className="row"><button className="btn btn-bl" disabled={aiBusy} onClick={() => runAi(d.raw)}>{aiBusy ? "İnceleniyor…" : "Otomatik doldur"}</button>{aiBusy && <span className="spinner" />}<span className="muted" style={{ fontSize: 12.5 }}>{aiMsg}</span></div>
          </div>
          <div className="box"><div className="box-h"><h2>Kategori seçin</h2></div><div className="box-b">
            <div className="cat-pick">
              <div className="cat-col">{categories.map((t) => <button key={t.id} className={d.top === t.id ? "on" : ""} onClick={() => set(d.top === t.id ? {} : { top: t.id, sub: "", attrs: {} })}><CatIcon top={t.id} cls="ct-ic" />{t.name}<span className="ar">›</span></button>)}</div>
              <div className="cat-col">{top ? top.subs.map((s) => <button key={s.id} className={d.sub === s.id ? "on" : ""} onClick={() => set(d.sub === s.id ? {} : { sub: s.id, attrs: {} })}>{s.name}</button>) : <div className="empty" style={{ padding: "30px 12px" }}>Önce soldan bir ana kategori seçin.</div>}</div>
            </div>
            <div className="sel-path">{sub ? <>Seçilen kategori: <b>{top!.name} › {sub.name}</b></> : <span className="muted">Henüz kategori seçilmedi.</span>}</div>
            <button className="btn btn-or btn-lg" disabled={!sub} onClick={() => set({ step: 2 })}>Devam</button>
          </div></div>
        </>
      )}

      {d.step === 2 && top && sub && (
        <>
          {mod && mod.verdict !== "ok" && <div className="note n-warn" style={{ marginBottom: 12 }}>Bu talep yayınlanmadan önce ekibimiz tarafından incelenecek. {mod.reason}</div>}
          {aiFill && (
            <div className="note n-ok ai-fill" style={{ marginBottom: 12 }}><span>
              <b>✨ Yapay zekâ doldurdu:</b> {aiFill.filled.join(", ")}.
              {aiFill.missing.length ? <> <b>Size kalan:</b> {aiFill.missing.join(", ")}.</> : " Eksik bir şey kalmadı; kontrol edip devam edin."}
            </span></div>
          )}
          <div className="box"><div className="box-h"><h2>Talep Detayları</h2><span className="muted" style={{ fontSize: 12.5 }}>{top.name} › {sub.name} · <button className="link" onClick={() => set({ step: 1 })}>Değiştir</button></span></div><div className="box-b">
            <div className="form-grid">
              <div className="fg full"><label htmlFor="f-t">Talep başlığı *</label><input className="inp" id="f-t" maxLength={120} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Örn. Kadıköy'de 3+1 kiralık daire arıyorum" /><span className="hint">Ne aradığınızı kısa ve net yazın.</span></div>
              <div className="fg full"><label htmlFor="f-x">Açıklama</label><textarea className="txa" id="f-x" rows={4} maxLength={4000} value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="Olmazsa olmazlarınız, tercih ettiğiniz marka/model, teslimat şekli..." /></div>
              <div className="fg"><label htmlFor="f-b0">En az bütçe (TL)</label><input className="inp" id="f-b0" type="number" inputMode="numeric" value={d.b0} onChange={(e) => set({ b0: e.target.value })} /></div>
              <div className="fg"><label htmlFor="f-b1">En fazla bütçe (TL) *</label><input className="inp" id="f-b1" type="number" inputMode="numeric" value={d.b1} onChange={(e) => set({ b1: e.target.value })} /></div>
              <div className="fg"><label htmlFor="f-c">İl *</label><select className="sel" id="f-c" value={d.city} onChange={(e) => set({ city: e.target.value, district: "", hood: "" })}><option value="">Seçin</option>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="fg"><label htmlFor="f-d">İlçe</label><select className="sel" id="f-d" value={d.district} disabled={!d.city} onChange={(e) => set({ district: e.target.value, hood: "" })}><option value="">{d.city ? "İlçe farketmez" : "Önce il seçin"}</option>{(districts.includes(d.district) || !d.district ? districts : [d.district, ...districts]).map((x) => <option key={x}>{x}</option>)}</select></div>
              {d.district && <div className="fg"><label htmlFor="f-m">Mahalle</label><select className="sel" id="f-m" value={d.hood} onChange={(e) => set({ hood: e.target.value })}><option value="">Mahalle farketmez</option>{(hoods.includes(d.hood) || !d.hood ? hoods : [d.hood, ...hoods]).map((x) => <option key={x}>{x}</option>)}</select></div>}
              {condsFor(d.top).length > 1 && <div className="fg full"><label>Ürün durumu</label><div className="radio-row">{condsFor(d.top).map((c) => <label key={c}><input type="radio" name="k" checked={d.condition === c} onChange={() => set({ condition: c })} />{c}</label>)}</div></div>}
              {vehicle && <VehicleFields sub={d.sub} value={d.attrs as VehicleAttrs} onChange={(attrs) => setD((x) => ({ ...x, attrs }))} onDraft={setDraftCar} />}
              {sch.map((a) => (
                <div className="fg" key={a.k}><label htmlFor={`fa-${a.k}`}>{a.l}</label>
                  {a.t === "sel"
                    ? <select className="sel" id={`fa-${a.k}`} value={String(d.attrs[a.k] ?? "")} onChange={(e) => set({ attrs: { ...d.attrs, [a.k]: e.target.value } })}><option value="">Farketmez</option>{a.o!.map((o) => <option key={o}>{o}</option>)}</select>
                    : <input className="inp" id={`fa-${a.k}`} type="number" value={String(d.attrs[a.k] ?? "")} onChange={(e) => set({ attrs: { ...d.attrs, [a.k]: e.target.value ? Number(e.target.value) : "" } })} />}
                </div>
              ))}
              {multi && user ? (
                <div className="fg full car-photos">
                  <div className="note n-info"><span><b>{cars.length} araç seçtiniz; her biri ayrı talep olarak yayınlanacak.</b> Böylece her aracın satıcısı yalnızca kendi aracına uyan talebi görür. Her araç için o modele uygun bir fotoğraf seçin.</span></div>
                  {cars.map((c) => (
                    <div key={carKey(c)} className="car-photo">
                      <label>{carLabel(c)} fotoğrafı {photoRequired ? "*" : <span className="muted">(isteğe bağlı)</span>}</label>
                      <MediaPicker value={d.carMedia[carKey(c)] ?? []} label={`${carLabel(c)} için fotoğraf ekle`}
                        onChange={(media) => setD((x) => ({ ...x, carMedia: { ...x.carMedia, [carKey(c)]: media } }))} onError={toast}
                        stock={{ category: d.sub, attrs: { ...d.attrs, araclar: [c] } }} />
                    </div>
                  ))}
                </div>
              ) : <div className="fg full"><label>Fotoğraf / video {photoRequired ? "*" : <span className="muted">(isteğe bağlı)</span>}</label>
                {user
                  ? <MediaPicker value={d.media} onChange={(media) => setD((x) => ({ ...x, media }))} onError={toast} stock={d.sub ? { category: d.sub, attrs: stockAttrs } : undefined} />
                  : <span className="hint">Örnek fotoğraf eklemek için <Link className="link" href="/giris?sonra=/talep-ver" onClick={() => { try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch { /* yoksay */ } }}>giriş yapın</Link>.{photoRequired ? " Talep vermek için en az bir fotoğraf gerekir; giriş yapınca kendi fotoğrafınızı yükleyebilir ya da hazır görsellerden seçebilirsiniz." : " Fotoğrafsız da talep verebilirsiniz."}</span>}
              </div>}
              <div className="fg"><label htmlFor="f-days">Talebin yayında kalma süresi</label><select className="sel" id="f-days" value={d.days} onChange={(e) => set({ days: Number(e.target.value) as D["days"] })}>{[7, 14, 30].map((n) => <option key={n} value={n}>{n} gün</option>)}</select></div>
              <div className="fg"><label>Seçenekler</label><label className="chk"><input type="checkbox" checked={d.urgent} onChange={(e) => set({ urgent: e.target.checked })} />Acil olarak işaretle</label><label className="chk"><input type="checkbox" checked={d.corporate} onChange={(e) => set({ corporate: e.target.checked })} />Firma adına faturalı alım</label></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}><button className="btn btn-wh btn-lg" onClick={() => set({ step: 1 })}>Geri</button><button className="btn btn-or btn-lg" onClick={() => {
              const err = validate();
              if (!err) { set({ step: 3 }); window.scrollTo(0, 0); return; }
              toast(err);
              // Giriş yapmamış kişi fotoğraf ekleyemez: taslak saklanır, girişten sonra buraya dönülür.
              if (!user && err.startsWith("En az bir fotoğraf")) {
                try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch { /* yoksay */ }
                router.push("/giris?sonra=/talep-ver");
              }
            }}>Devam</button></div>
          </div></div>
        </>
      )}

      {d.step === 3 && top && sub && (
        <div className="box"><div className="box-h"><h2>Talebinizin önizlemesi</h2><button className="link" onClick={() => set({ step: 2 })}>Düzenle</button></div><div className="box-b">
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{d.title}</div>
          {multi ? (
            <div className="note n-info" style={{ marginBottom: 12, display: "block" }}>
              <b>{cars.length} ayrı talep yayınlanacak:</b>
              <div className="car-prev">{cars.map((c) => {
                const m = (d.carMedia[carKey(c)] ?? []).find((x) => x.kind === "image");
                return <div key={carKey(c)} className="car-prev-i">{m ? <img src={m.url} alt="" /> : <span className="car-prev-x"><Icon name="car" size={22} /></span>}<b>{carLabel(c)}</b></div>;
              })}</div>
            </div>
          ) : d.media.length > 0 && <div style={{ maxWidth: 420, marginBottom: 12 }}><Gallery media={d.media} fallback={null} /></div>}
          <table className="info" style={{ maxWidth: 560 }}><tbody>
            <tr><th>Bütçe</th><td><span className="price-big">{budgetTxt(Number(d.b0) || Math.round(Number(d.b1) * 0.8), Number(d.b1))}</span></td></tr>
            <tr><th>Kategori</th><td>{top.name} › {sub.name}</td></tr>
            {condsFor(d.top).length > 1 && <tr><th>Ürün durumu</th><td>{d.condition}</td></tr>}
            {sch.filter((a) => d.attrs[a.k] !== undefined && d.attrs[a.k] !== "").map((a) => <tr key={a.k}><th>{a.l}</th><td>{String(d.attrs[a.k])}</td></tr>)}
            {vehicle && <VehicleRows a={d.attrs as VehicleAttrs} />}
            <tr><th>Konum</th><td>{placeTxt({ city: d.city, district: d.district || "İlçe farketmez", neighbourhood: d.hood })}</td></tr>
            <tr><th>Talebin yayında kalma süresi</th><td>{d.days} gün</td></tr>
          </tbody></table>
          {d.description && <div className="desc" style={{ marginTop: 12 }}>{d.description}</div>}
          <div className="note n-info" style={{ marginTop: 14 }}><span>Telefon numaranız herkese açık gösterilmez. Talebinize uygun ürünü olan ve ücret ödeyen <b>sınırlı sayıda satıcı</b> numaranızı görüp sizi arayabilir veya site içinden mesaj gönderebilir. Numaranızı kimlerin gördüğünü talep sayfanızdan takip edersiniz; talebi kapatınca numaranız gizlenir. E-postanız hiçbir satıcıyla paylaşılmaz.</span></div>
          {user && !user.phone && phoneRequired && (
            <div className="note n-warn" style={{ marginTop: 12, display: "block" }}>
              <b>Telefon numaranızı doğrulayın.</b> Satıcıların size ulaşabilmesi için talep vermeden önce numaranızı SMS koduyla doğrulamanız gerekiyor.
              <div style={{ marginTop: 10 }}><PhoneVerify /></div>
            </div>
          )}
          <label className="chk" style={{ marginTop: 12 }}><input type="checkbox" checked={d.agree} onChange={(e) => set({ agree: e.target.checked })} /><span><Link className="link" href="/sayfa/kullanim-kosullari" target="_blank">Talep verme kurallarını</Link> ve <Link className="link" href="/sayfa/kvkk" target="_blank">aydınlatma metnini</Link> okudum; telefon numaramın ücret ödeyen satıcılarla paylaşılmasını onaylıyorum.</span></label>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}><button className="btn btn-wh btn-lg" onClick={() => set({ step: 2 })}>Geri</button><button className="btn btn-or btn-lg" disabled={busy} onClick={publish}>{busy ? "Yayınlanıyor…" : user ? "Talebi Yayınla" : "Giriş yap ve yayınla"}</button></div>
        </div></div>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="loading">Yükleniyor…</div>}><Create /></Suspense>;
}
