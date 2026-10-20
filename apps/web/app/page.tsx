"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Ads, CenterAds } from "@/components/Ads";
import { Welcome } from "@/components/Welcome";
import { CatIcon, RequestTable, VitrinCard, VitrinTile } from "@/components/RequestTable";
import { useSession } from "@/components/Session";
import { api, type Ad, type RequestItem } from "@/lib/api";
import { BUILTIN_NAMES, SIDE_IDS, blockName, blockText, saveHomeBlocks, withHidden, type BuiltinId, type HomeBlock } from "@/lib/home";
import { CustomBlock } from "@/components/HomeBlocks";

type List = { total: number; items: RequestItem[] };

// Ana sayfadaki hızlı talep kutusunda sırayla değişen örnekler (şimdilik vasıta ve emlak).
const HERO_EXAMPLES = [
  "2018 model dizel Passat",
  "Kadıköy'de 3+1 kiralık daire",
  "Az kilometreli otomatik Clio",
  "Urla'da 500 m² imarlı arsa",
];

export default function Home() {
  const { categories, browseCategories, count, launchMode, homeUrgentBox, homeBlocks, user, refresh, toast } = useSession();
  const admin = user?.role === "admin";
  // Bölümler yönetimdeki sırayla (Yönetim → Ana Sayfa Düzeni). Yönetici ana sayfadan da gizleyip gösterebilir.
  const list: HomeBlock[] = homeBlocks.length ? homeBlocks : (Object.keys(BUILTIN_NAMES) as BuiltinId[]).map((id) => ({ type: "builtin", id, hidden: false }));
  const T = (id: BuiltinId, k: string) => blockText(list, id, k);
  // Telefon/bilgisayar ayrımı; yan kutular bilgisayarda sağ sütunda olduğu için ortada yalnızca telefonda görünür.
  const showCls = (b: HomeBlock) => b.type === "builtin" && SIDE_IDS.includes(b.id) ? (b.show === "desktop" ? "hb-none" : "m-only")
    : b.show === "mobile" ? "m-only" : b.show === "desktop" ? "d-only" : "hb-all";
  const toggleSection = async (b: HomeBlock, show: boolean) => {
    try { await saveHomeBlocks(withHidden(list, b.id, !show)); await refresh(); toast(`${blockName(b)} ${show ? "ana sayfada gösteriliyor." : "ziyaretçilerden gizlendi."}`); }
    catch (e) { toast((e as Error).message); }
  };
  const hideBtn = (id: BuiltinId) => {
    const b = list.find((x) => x.id === id);
    return admin && b ? <button type="button" className="btn btn-wh btn-sm sec-hide" aria-label={`${blockName(b)} bölümünü gizle`} onClick={() => void toggleSection(b, false)}>Gizle</button> : null;
  };
  const hiddenBar = (b: HomeBlock) => admin
    ? <div className="sec-hidden"><span><b>{blockName(b)}</b> ziyaretçilerden gizli (yalnızca siz görüyorsunuz).</span><button type="button" className="btn btn-wh btn-sm" aria-label={`${blockName(b)}: göster`} onClick={() => void toggleSection(b, true)}>Göster</button></div> : null;
  const router = useRouter();
  const [q, setQ] = useState("");
  const [ex, setEx] = useState(0);
  // Kutu boşken örnek 4 saniyede bir değişir.
  useEffect(() => { if (q) return; const t = setInterval(() => setEx((i) => (i + 1) % HERO_EXAMPLES.length), 4000); return () => clearInterval(t); }, [q]);
  const [urgent, setUrgent] = useState<List | null>(null);
  const [latest, setLatest] = useState<List | null>(null);
  const [vitrin, setVitrin] = useState<List | null>(null);
  const [corp, setCorp] = useState<List | null>(null);
  // "Afiş" bölümlerinin resim/videoları
  const [blockAds, setBlockAds] = useState<Ad[]>([]);

  useEffect(() => {
    void api<List>("/requests?urgent=1&per=8").then(setUrgent).catch(() => setUrgent({ total: 0, items: [] }));
    void api<List>("/requests?sort=vitrin&per=20").then(setVitrin).catch(() => setVitrin({ total: 0, items: [] }));
    void api<List>("/requests?per=10").then(setLatest).catch(() => setLatest({ total: 0, items: [] }));
    void api<List>("/requests?buyer=kurumsal&per=5").then(setCorp).catch(() => setCorp({ total: 0, items: [] }));
    void api<{ blok?: Ad[] }>("/tanitim").then((r) => setBlockAds(r.blok ?? [])).catch(() => {});
  }, []);

  const blocks: Record<BuiltinId, React.ReactNode> = {
    hero: (<>
      <section className="concept hero">
        <span className="hero-badge">{T("hero", "badge")}</span>
        <h1>{T("hero", "title")}</h1>
        <p>{T("hero", "sub")}</p>
        <form className="hero-form" onSubmit={(e) => { e.preventDefault(); router.push(`/talep-ver${q.trim() ? `?metin=${encodeURIComponent(q.trim())}` : ""}`); }}>
          <div className="hero-in">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Örn. ${HERO_EXAMPLES[ex]}`} aria-label="Ne almak istiyorsunuz?" />
            <button type="submit">{T("hero", "button")}</button>
          </div>
        </form>
        <p className="hero-ai"><span aria-hidden="true">✨</span> {T("hero", "ai")}</p>
        <ul className="hero-steps" aria-label="Nasıl çalışır">
          <li><b>1</b>{T("hero", "s1")}</li>
          <li><b>2</b>{T("hero", "s2")}</li>
          <li><b>3</b>{T("hero", "s3")}</li>
        </ul>
      </section>
    </>),
    urgent: (<>
      {homeUrgentBox && !!urgent?.items.length && (
        <section className="box" style={{ marginBottom: 14 }}>
          <div className="box-h"><h2>{T("urgent", "title")}</h2><Link className="link" href="/kategori?acil=1">{T("urgent", "link")}{count(urgent.total) !== null && ` (${urgent.total})`} »</Link></div>
          <div className="box-b"><div className="vitrin">{urgent.items.map((r) => <VitrinCard key={r.id} r={r} />)}</div></div>
        </section>
      )}
    </>),
    cats: (<>
      {/* Telefonda soldaki liste gizli; kategoriler renkli kutucuklar olarak burada. */}
      <section className="cat-tiles" aria-label="Kategoriler">
        {!!urgent?.total && <Link href="/kategori?acil=1" className="ct-acil-tile"><span className="ct-ic ct-acil" aria-hidden="true"><Icon name="bolt" size={16} sw={2.2} /></span><span>Acil Talepler</span></Link>}
        {(browseCategories.length ? browseCategories : categories).map((t) => (
          <Link key={t.id} href={browseCategories.length ? `/kategori/${t.id}` : `/talep-ver?kategori=${t.id}`}><CatIcon top={t.id} cls="ct-ic" /><span>{t.name}</span></Link>
        ))}
      </section>
    </>),
    ads_m: (<>
      <Ads cls="yk-m" />
    </>),
    center_ads: (<>
      <CenterAds />
    </>),
    vitrin: (<>
      {!!vitrin?.items.length && (
        <section className="box" style={{ marginBottom: 14 }}>
          <div className="box-h"><h2>{T("vitrin", "title")}</h2><span className="sec-act"><Link className="link" href="/kategori">{T("vitrin", "link")} »</Link>{hideBtn("vitrin")}</span></div>
          <div className="box-b"><div className="vt">{vitrin.items.map((r) => <VitrinTile key={r.id} r={r} />)}</div></div>
        </section>
      )}
    </>),
    latest: (<>
      <section className="box" style={{ marginBottom: 14 }}>
        <div className="box-h"><h2>{T("latest", "title")}</h2><span className="sec-act">{!!latest?.total && <Link className="link" href="/kategori">{T("latest", "link")}{count(latest.total) !== null && ` (${latest.total})`} »</Link>}{hideBtn("latest")}</span></div>
        {!latest ? <div className="loading">Yükleniyor…</div> : latest.items.length ? <RequestTable items={latest.items} /> : (
          <div className="soon"><div className="soon-grid">
            <div><b>İlk talepler geliyor</b><p>Almak istediğinizi yazın; ilk talep sahipleri satıcıların en çok ilgisini çeker.</p><Link className="btn btn-or" href="/talep-ver">Ücretsiz talep ver</Link></div>
            <div><b>Satıcı mısınız?</b><p>Hangi kategoride ve ilde satış yaptığınızı seçin, talep gelince SMS ile haber verelim.</p><Link className="btn btn-bl" href="/bana-ozel?s=alarm">Talep alarmı kur</Link></div>
          </div></div>
        )}
      </section>
    </>),
    corp: (<>
      {!!corp?.items.length && (
        <section className="box" style={{ marginBottom: 14 }}>
          <div className="box-h"><h2>{T("corp", "title")}</h2><Link className="link" href="/kategori?buyer=kurumsal">{T("corp", "link")} »</Link></div>
          <RequestTable items={corp.items} />
        </section>
      )}
    </>),
    launch: (<>
      {launchMode && (
        <div className="box launch"><div className="box-b">
          <b>{T("launch", "title")}</b>
          <p>{T("launch", "text")}</p>
          <Link className="btn btn-or btn-block" href="/bana-ozel?s=alarm">{T("launch", "button")}</Link>
        </div></div>
      )}
    </>),
    how: (<>
      <div className="box"><div className="box-h"><h3>{T("how", "title")}</h3></div><div className="box-b"><ol className="steps">
        <li><div><b>{T("how", "s1t")}</b><span className="muted">{T("how", "s1d")}</span></div></li>
        <li><div><b>{T("how", "s2t")}</b><span className="muted">{T("how", "s2d")}</span></div></li>
        <li><div><b>{T("how", "s3t")}</b><span className="muted">{T("how", "s3d")}</span></div></li>
      </ol></div></div>
    </>),
    safe: (<>
      <div className="box"><div className="box-h"><h3>{T("safe", "title")}</h3></div><div className="box-b" style={{ fontSize: 12.5 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}><Icon name="lock" size={16} sw={2} /><span>{T("safe", "p1")}</span></div>
        <div style={{ display: "flex", gap: 8 }}><Icon name="check" size={16} sw={2} /><span>{T("safe", "p2")}</span></div>
      </div></div>
    </>),
  };
  // Bilgisayarda sağ sütun: yan kutular ("Telefonda" seçilenler hariç).
  const sideBlocks = list.filter((b) => b.type === "builtin" && SIDE_IDS.includes(b.id) && !b.hidden && b.show !== "mobile").map((b) => <Fragment key={b.id}>{blocks[b.id as BuiltinId]}</Fragment>);
  return (
    <div className="wrap home">
      <Welcome />
      <div className="home-left">
      <aside className="ctree" aria-label="Kategoriler">
        {/* sahibinden'deki gibi: acil talepler kategorilerin üstünde ayrı bir bağlantı */}
        {!!urgent?.total && (
          <div className="ct-group ct-quick">
            <Link className="ct-top" href="/kategori?acil=1"><span className="ct-ic ct-acil" aria-hidden="true"><Icon name="bolt" size={16} sw={2.2} /></span>Acil Talepler {count(urgent.total) !== null && <span className="n">({urgent.total})</span>}</Link>
          </div>
        )}
        {browseCategories.length ? browseCategories.map((t) => (
          <div className="ct-group" key={t.id}>
            <Link className="ct-top" href={`/kategori/${t.id}`}><CatIcon top={t.id} cls="ct-ic" />{t.name} {count(t.active_count) !== null && <span className="n">({t.active_count})</span>}</Link>
            <ul className="ct-subs">
              {t.subs.map((s) => <li key={s.id}><Link href={`/kategori/${t.id}/${s.id}`}><span>{s.name}</span><span className="n">{count(s.active_count)}</span></Link></li>)}
            </ul>
          </div>
        )) : (
          // Henüz gezilecek talep yoksa kategoriler "ne almak istiyorsunuz?" kısayolu olur.
          <div className="ct-group">
            <div className="ct-top" style={{ cursor: "default" }}>Ne almak istiyorsunuz?</div>
            <ul className="ct-subs ct-pick">{categories.map((t) => <li key={t.id}><Link href={`/talep-ver?kategori=${t.id}`}><CatIcon top={t.id} cls="ct-ic" /><span>{t.name}</span><span className="ar">›</span></Link></li>)}</ul>
          </div>
        )}
      </aside>
      <Ads />
      </div>

      <div>
      {/* Bölümler yönetimde seçilen sırayla; gizlenenler yalnızca yöneticiye çubuk olarak görünür. Yan kutular telefonda burada, bilgisayarda sağ sütunda. */}
      {list.map((b) => <Fragment key={b.id}>{b.hidden ? hiddenBar(b)
        : <div className={showCls(b)}>{b.type !== "builtin" ? <CustomBlock b={b} ads={blockAds} /> : blocks[b.id]}</div>}</Fragment>)}
      </div>

      <aside className="side">
        {sideBlocks}
      </aside>
    </div>
  );
}
