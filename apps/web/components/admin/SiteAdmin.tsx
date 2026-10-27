"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/Session";
import { api } from "@/lib/api";
import { DEFAULT_FOOTER, type Footer } from "@/lib/footer";

type Page = { slug: string; title: string; body: string };
type Faq = { group: string; q: string; a: string; tag?: "safe" | "credits" };
const move = <T,>(xs: T[], i: number, d: -1 | 1) => { const ys = [...xs]; const j = i + d; if (j < 0 || j >= ys.length) return ys; [ys[i], ys[j]] = [ys[j]!, ys[i]!]; return ys; };

/** Yönetim → Alt Bilgi ve Sayfalar: sitenin en altındaki sütunlar/bağlantılar ve Hakkımızda gibi sayfaların içeriği. */
export function SiteAdmin() {
  const { toast, refresh } = useSession();
  const [f, setF] = useState<Footer | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [sel, setSel] = useState("hakkimizda");
  const [page, setPage] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const d = await api<{ footer: Footer; pages: Page[] }>("/admin/site");
    setF(d.footer); setPages(d.pages);
    return d.pages;
  };
  useEffect(() => { void load().then((ps) => setPage(ps.find((p) => p.slug === "hakkimizda") ?? ps[0] ?? null)).catch((e) => toast((e as Error).message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveFooter = async () => {
    setBusy(true);
    try { await api("/admin/footer", { method: "PUT", body: f }); await refresh(); toast("Alt bilgi kaydedildi."); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const savePage = async () => {
    if (!page) return;
    setBusy(true);
    try { await api(`/admin/pages/${page.slug}`, { method: "PUT", body: { title: page.title, body: page.body } }); await load(); setSel(page.slug); toast("Sayfa kaydedildi."); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const delPage = async () => {
    if (!page || !confirm(`"${page.title}" sayfası silinsin mi? Alt bilgideki bağlantısını da kaldırmayı unutmayın.`)) return;
    try { await api(`/admin/pages/${page.slug}`, { method: "DELETE" }); const ps = await load(); setPage(ps[0] ?? null); setSel(ps[0]?.slug ?? ""); toast("Sayfa silindi."); }
    catch (e) { toast((e as Error).message); }
  };
  const newPage = () => {
    const slug = prompt("Yeni sayfanın adresi (küçük harf, rakam ve tire; ör. sss):")?.trim().toLowerCase();
    if (!slug) return;
    setPage({ slug, title: "", body: "" }); setSel(slug);
  };
  if (!f) return <div className="box"><div className="box-b muted">Yükleniyor…</div></div>;
  const setCol = (i: number, c: Footer["columns"][number]) => setF({ ...f, columns: f.columns.map((x, k) => (k === i ? c : x)) });

  return (
    <>
      <div className="box" style={{ marginBottom: 14 }}><div className="box-h"><h2>Alt bilgi (sitenin en altı)</h2>
        <button type="button" className="link" onClick={() => { if (confirm("Alt bilgi ilk hâline dönsün mü? (Kaydet'e basınca uygulanır)")) setF(DEFAULT_FOOTER); }}>İlk hâline dön</button></div>
        <div className="box-b">
          <p className="muted" style={{ marginTop: 0, lineHeight: 1.6 }}>Bağlantılar site içi bir yol (<code>/sayfa/hakkimizda</code>, <code>/sozlesmeler</code>), <code>https://</code> ile başlayan bir adres, <code>mailto:</code> veya <code>tel:</code> olabilir. Alttaki yazıda <code>{"{yıl}"}</code> bu yılı gösterir.</p>
          <div className="ft-edit">
            {f.columns.map((c, i) => (
              <fieldset key={i} className="ft-col">
                <legend className="sr-only">{c.title || `Sütun ${i + 1}`}</legend>
                <div className="ft-row">
                  <input className="inp" aria-label={`${i + 1}. sütun başlığı`} value={c.title} maxLength={40} onChange={(e) => setCol(i, { ...c, title: e.target.value })} />
                  <button type="button" className="btn btn-wh btn-sm" aria-label={`${i + 1}. sütunu sola al`} onClick={() => setF({ ...f, columns: move(f.columns, i, -1) })}>←</button>
                  <button type="button" className="btn btn-wh btn-sm" aria-label={`${i + 1}. sütunu sağa al`} onClick={() => setF({ ...f, columns: move(f.columns, i, 1) })}>→</button>
                  <button type="button" className="btn btn-wh btn-sm" aria-label={`${i + 1}. sütunu sil`} onClick={() => setF({ ...f, columns: f.columns.filter((_, k) => k !== i) })}>✕</button>
                </div>
                {c.links.map((l, j) => (
                  <div key={j} className="ft-row ft-link">
                    <input className="inp" aria-label={`${c.title} ${j + 1}. bağlantı adı`} value={l.label} maxLength={60} placeholder="Ad" onChange={(e) => setCol(i, { ...c, links: c.links.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)) })} />
                    <input className="inp" aria-label={`${c.title} ${j + 1}. bağlantı adresi`} value={l.href} maxLength={300} placeholder="/sayfa/…" onChange={(e) => setCol(i, { ...c, links: c.links.map((x, k) => (k === j ? { ...x, href: e.target.value } : x)) })} />
                    <button type="button" className="btn btn-wh btn-sm" aria-label={`${l.label} yukarı`} onClick={() => setCol(i, { ...c, links: move(c.links, j, -1) })}>↑</button>
                    <button type="button" className="btn btn-wh btn-sm" aria-label={`${l.label} aşağı`} onClick={() => setCol(i, { ...c, links: move(c.links, j, 1) })}>↓</button>
                    <button type="button" className="btn btn-wh btn-sm" aria-label={`${l.label} bağlantısını sil`} onClick={() => setCol(i, { ...c, links: c.links.filter((_, k) => k !== j) })}>✕</button>
                  </div>
                ))}
                <button type="button" className="link" aria-label={`${c.title} sütununa bağlantı ekle`} onClick={() => setCol(i, { ...c, links: [...c.links, { label: "", href: "/" }] })}>+ Bağlantı ekle</button>
              </fieldset>
            ))}
          </div>
          {f.columns.length < 6 && <button type="button" className="btn btn-wh btn-sm" style={{ marginTop: 8 }} onClick={() => setF({ ...f, columns: [...f.columns, { title: "Yeni sütun", links: [] }] })}>+ Sütun ekle</button>}
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="fg"><label htmlFor="ft-bl">En alttaki yazı (sol)</label><input id="ft-bl" className="inp" maxLength={200} value={f.bottom_left} onChange={(e) => setF({ ...f, bottom_left: e.target.value })} /></div>
            <div className="fg"><label htmlFor="ft-br">En alttaki yazı (sağ)</label><input id="ft-br" className="inp" maxLength={300} value={f.bottom_right} onChange={(e) => setF({ ...f, bottom_right: e.target.value })} /></div>
          </div>
          <button type="button" className="btn btn-or" style={{ marginTop: 10 }} disabled={busy} onClick={() => void saveFooter()}>Alt bilgiyi kaydet</button>
        </div>
      </div>

      <div className="box"><div className="box-h"><h2>Sayfalar</h2><button type="button" className="btn btn-wh btn-sm" onClick={newPage}>+ Yeni sayfa</button></div>
        <div className="box-b">
          <div className="fg" style={{ maxWidth: 360 }}><label htmlFor="pg-sel">Düzenlenecek sayfa</label>
            <select id="pg-sel" className="sel" value={sel} onChange={(e) => { setSel(e.target.value); setPage(pages.find((p) => p.slug === e.target.value) ?? null); }}>
              {pages.map((p) => <option key={p.slug} value={p.slug}>{p.title} (/sayfa/{p.slug})</option>)}
              {page && !pages.some((p) => p.slug === page.slug) && <option value={page.slug}>Yeni: /sayfa/{page.slug}</option>}
            </select></div>
          {page && (
            <>
              <div className="fg" style={{ marginTop: 10 }}><label htmlFor="pg-t">Başlık</label><input id="pg-t" className="inp" maxLength={120} value={page.title} onChange={(e) => setPage({ ...page, title: e.target.value })} /></div>
              <div className="fg" style={{ marginTop: 10 }}><label htmlFor="pg-b">İçerik</label>
                <textarea id="pg-b" className="txa" rows={12} maxLength={20000} value={page.body} onChange={(e) => setPage({ ...page, body: e.target.value })} />
                <span className="hint">Paragraflar arasında bir boş satır bırakın. <code>## Başlık</code>, <code>- madde</code>, <code>**kalın**</code>, <code>[bağlantı adı](/sozlesmeler)</code> kullanabilirsiniz. Sayfanın adresi: <a className="link" href={`/sayfa/${page.slug}`} target="_blank" rel="noreferrer">/sayfa/{page.slug}</a></span></div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button type="button" className="btn btn-or" disabled={busy} onClick={() => void savePage()}>Sayfayı kaydet</button>
                {pages.some((p) => p.slug === page.slug) && <button type="button" className="btn btn-gh" onClick={() => void delPage()}>Sayfayı sil</button>}
              </div>
            </>
          )}
        </div>
      </div>
      <FaqAdmin />
    </>
  );
}

/** Sık Sorulan Sorular: grup, soru ve cevap; Güvenli Al / kredi soruları o bölümler gizlenince gösterilmez. */
function FaqAdmin() {
  const { toast } = useSession();
  const [items, setItems] = useState<Faq[] | null>(null);
  const [def, setDef] = useState<Faq[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api<{ faq: Faq[]; default_faq: Faq[] }>("/admin/site").then((d) => { setItems(d.faq); setDef(d.default_faq); }).catch((e) => toast((e as Error).message)); }, [toast]);
  if (!items) return null;
  const set = (i: number, x: Partial<Faq>) => setItems(items.map((y, k) => (k === i ? { ...y, ...x } : y)));
  const groups = [...new Set(items.map((x) => x.group))];
  const save = async () => {
    setBusy(true);
    try { const d = await api<{ items: Faq[] }>("/admin/faq", { method: "PUT", body: items.map((x) => (x.tag ? x : { group: x.group, q: x.q, a: x.a })) }); setItems(d.items); toast("Sık Sorulan Sorular kaydedildi."); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="box" style={{ marginTop: 14 }}><div className="box-h"><h2>Sık Sorulan Sorular</h2>
      <span style={{ display: "flex", gap: 12 }}><a className="link" href="/sss" target="_blank" rel="noreferrer">Sayfayı görüntüle »</a>
        <button type="button" className="link" onClick={() => { if (confirm("Sorular ilk hâline dönsün mü? (Kaydet'e basınca uygulanır)")) setItems(def); }}>İlk hâline dön</button></span></div>
      <div className="box-b">
        <p className="muted" style={{ marginTop: 0, lineHeight: 1.6 }}>Sorular gruplarına göre <a className="link" href="/sss" target="_blank" rel="noreferrer">/sss</a> sayfasında açılır kapanır olarak görünür. Cevapta <code>**kalın**</code> ve <code>[bağlantı](/sozlesmeler)</code> kullanabilirsiniz. &quot;Güvenli Al&quot; ya da &quot;Kredi&quot; olarak işaretlenen sorular, o bölüm Ayarlar&apos;dan gizlenince sitede görünmez.</p>
        <datalist id="faq-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
        {items.map((x, i) => (
          <div key={i} className="faq-edit">
            <div className="ft-row">
              <input className="inp" style={{ flex: ".5" }} list="faq-groups" aria-label={`${i + 1}. sorunun grubu`} value={x.group} maxLength={60} onChange={(e) => set(i, { group: e.target.value })} />
              <select className="sel" style={{ flex: ".4" }} aria-label={`${i + 1}. soru hangi bölümle gizlensin`} value={x.tag ?? ""} onChange={(e) => set(i, { tag: (e.target.value || undefined) as Faq["tag"] })}>
                <option value="">Her zaman göster</option><option value="safe">Güvenli Al sorusu</option><option value="credits">Kredi / ödeme sorusu</option>
              </select>
              <button type="button" className="btn btn-wh btn-sm" aria-label={`${i + 1}. soruyu yukarı al`} onClick={() => setItems(move(items, i, -1))}>↑</button>
              <button type="button" className="btn btn-wh btn-sm" aria-label={`${i + 1}. soruyu aşağı al`} onClick={() => setItems(move(items, i, 1))}>↓</button>
              <button type="button" className="btn btn-wh btn-sm" aria-label={`${i + 1}. soruyu sil`} onClick={() => setItems(items.filter((_, k) => k !== i))}>✕</button>
            </div>
            <input className="inp" aria-label={`${i + 1}. soru`} value={x.q} maxLength={300} placeholder="Soru" onChange={(e) => set(i, { q: e.target.value })} />
            <textarea className="txa" aria-label={`${i + 1}. cevap`} rows={3} maxLength={4000} value={x.a} placeholder="Cevap" onChange={(e) => set(i, { a: e.target.value })} />
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button type="button" className="btn btn-wh btn-sm" onClick={() => setItems([...items, { group: groups.at(-1) ?? "Genel", q: "", a: "" }])}>+ Soru ekle</button>
          <button type="button" className="btn btn-or" disabled={busy} onClick={() => void save()}>Soruları kaydet</button>
        </div>
      </div>
    </div>
  );
}
