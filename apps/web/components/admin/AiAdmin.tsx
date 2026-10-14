"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/components/Session";
import { dateTr, fmt } from "@/lib/format";

type Settings = {
  ai_fix_text: boolean; ai_auto_decide: boolean; ai_uncertain: "hold" | "publish"; ai_messages: boolean; ai_names: boolean;
  ai_blog_every_days: number; ai_blog_autopublish: boolean; ai_daily_limit: number; auto_emails: boolean;
};
type AiInfo = { connected: boolean; settings: Settings; usage: { today: number; limit: number }; counts: Record<string, number>; unchecked_requests: number; topics: string[] };
type Action = { id: number; kind: string; target_id: string | null; summary: string; undone_at: string | null; created_at: string };
type Post = { id: number; slug: string; title: string; summary: string; body: string; topic: string; status: "draft" | "published"; source: string; created_at: string; published_at: string | null };

const KINDS: Record<string, string> = {
  talep_duzeltme: "Yazım düzeltme", talep_karar: "Talep kararı", mesaj_engel: "Engellenen mesaj", ad_engel: "Uygunsuz ad",
  image: "Resim denetimi", video: "Video denetimi", blog: "Blog yazısı",
};

function Toggle({ id, label, hint, on, set }: { id: string; label: string; hint: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <div className="ai-row">
      <div><label htmlFor={id}><b>{label}</b></label><small>{hint}</small></div>
      <button id={id} type="button" className={"sw" + (on ? " on" : "")} role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} />
    </div>
  );
}

export function AiAdmin() {
  const { toast } = useSession();
  const [info, setInfo] = useState<AiInfo | null>(null);
  const [err, setErr] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [kind, setKind] = useState("");
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    try { setInfo(await api<AiInfo>("/admin/ai")); } catch (e) { setErr((e as Error).message); }
  }, []);
  const loadActions = useCallback(async () => {
    try { setActions((await api<{ items: Action[] }>(`/admin/ai/actions${kind ? `?kind=${kind}` : ""}`)).items); } catch { setActions([]); }
  }, [kind]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadActions(); }, [loadActions]);

  const save = async (patch: Partial<Settings>) => {
    if (!info) return;
    setInfo({ ...info, settings: { ...info.settings, ...patch } });
    try { await api("/admin/ai/settings", { method: "PUT", body: patch }); toast("Kaydedildi."); }
    catch (e) { toast((e as Error).message); void load(); }
  };
  const scan = async () => {
    setScanning(true);
    try {
      const r = await api<{ checked: number; fixed: number; published: number; held: number; rejected: number }>("/admin/ai/scan", { body: {} });
      toast(r.checked ? `${r.checked} talep denetlendi: ${r.fixed} düzeltildi, ${r.published} yayına alındı, ${r.held} incelemeye alındı, ${r.rejected} reddedildi.` : "Denetlenecek talep kalmadı.");
      await Promise.all([load(), loadActions()]);
    } catch (e) { toast((e as Error).message); } finally { setScanning(false); }
  };
  const undo = async (a: Action) => {
    if (!confirm("Bu işlem geri alınsın mı?")) return;
    try { await api(`/admin/ai/actions/${a.id}/undo`, { body: {} }); toast("Geri alındı."); void loadActions(); }
    catch (e) { toast((e as Error).message); }
  };

  if (err) return <div className="note n-warn">{err}</div>;
  if (!info) return <div className="loading">Yükleniyor…</div>;
  const s = info.settings, c = info.counts;
  const cards: [string, number][] = [
    ["Düzeltilen talep", c.talep_duzeltme ?? 0], ["Talep kararı", c.talep_karar ?? 0],
    ["Engellenen mesaj", c.mesaj_engel ?? 0], ["Engellenen ad", c.ad_engel ?? 0], ["Yazılan blog", c.blog ?? 0],
  ];

  return (
    <>
      {info.connected
        ? <div className="note n-ok" style={{ marginBottom: 12 }}><span><b>Yapay zekâ bağlı.</b> Bugün {fmt(info.usage.today)} / {info.usage.limit ? fmt(info.usage.limit) : "sınırsız"} kullanım. Sınır dolunca site ücretsiz basit denetimle çalışmaya devam eder.</span></div>
        : <div className="note n-warn" style={{ marginBottom: 12 }}><span><b>Yapay zekâ bağlı değil.</b> Şu an basit kelime denetimi çalışıyor; blog yazılamaz. Bağlamak için Entegrasyonlar bölümüne bakın.</span></div>}

      <div className="kpis ai-kpis">{cards.map(([l, n]) => <div key={l} className="kpi"><small>{l} · son 30 gün</small><b>{fmt(n)}</b></div>)}</div>

      <div className="ap-box"><div className="ap-box-h"><h2>Otomatik denetim</h2></div><div className="ap-box-b">
        <Toggle id="ai-fix" label="Talep başlık ve açıklamalarını düzelt" hint="Yazım hatalarını, büyük harfle yazılmış başlıkları ve marka adlarını düzeltir; telefon/e-posta gibi yasak bilgileri siler." on={s.ai_fix_text} set={(v) => void save({ ai_fix_text: v })} />
        <Toggle id="ai-decide" label="Talepleri kendisi onaylasın / reddetsin" hint="Kapalıysa her yeni talep sizin onayınızı bekler (İçerik Denetimi)." on={s.ai_auto_decide} set={(v) => void save({ ai_auto_decide: v })} />
        {s.ai_auto_decide && (
          <div className="ai-row"><div><b>Emin olamadığı talepler</b><small>Yapay zekâ karar veremezse ne olsun?</small></div>
            <div className="view-sw" role="group" aria-label="Emin olamadığı talepler">
              <button type="button" className={s.ai_uncertain === "hold" ? "on" : ""} onClick={() => void save({ ai_uncertain: "hold" })}>Bana sorsun</button>
              <button type="button" className={s.ai_uncertain === "publish" ? "on" : ""} onClick={() => void save({ ai_uncertain: "publish" })}>Yayına alsın</button>
            </div></div>
        )}
        <Toggle id="ai-msg" label="Mesajları denetle" hint="Küfür, hakaret, kapora/IBAN dolandırıcılığı içeren mesajlar karşı tarafa iletilmez." on={s.ai_messages} set={(v) => void save({ ai_messages: v })} />
        <Toggle id="ai-name" label="Üye adlarını denetle" hint="Yeni üyelerin ad soyadında küfür, reklam veya bağlantı varsa kayıt kabul edilmez." on={s.ai_names} set={(v) => void save({ ai_names: v })} />
        <Toggle id="ai-mail" label="Otomatik e-postalar" hint="Hoş geldin, talebiniz yayında / reddedildi ve süresi bitiyor e-postaları. (E-posta hizmeti bağlıysa gider.)" on={s.auto_emails} set={(v) => void save({ auto_emails: v })} />
        <div className="ai-row"><div><label htmlFor="ai-limit"><b>Günlük kullanım sınırı</b></label><small>Masrafı sınırlar. 0 = yapay zekâ hiç kullanılmaz, basit denetim çalışır.</small></div>
          <input id="ai-limit" className="inp" style={{ width: 110 }} type="number" min={0} max={100000} defaultValue={s.ai_daily_limit}
            onBlur={(e) => { const n = Math.max(0, Math.min(100000, Math.round(Number(e.target.value) || 0))); if (n !== s.ai_daily_limit) void save({ ai_daily_limit: n }); }} /></div>
        <div className="ai-row"><div><b>Eski talepleri denetle</b><small>{info.unchecked_requests ? `Yapay zekânın henüz bakmadığı ${info.unchecked_requests} talep var. Her basışta en fazla 20 talep denetlenir.` : "Bütün talepler denetlendi."}</small></div>
          <button type="button" className="btn btn-bl" disabled={scanning || !info.unchecked_requests} onClick={() => void scan()}>{scanning ? "Denetleniyor…" : "Mevcut talepleri tara"}</button></div>
      </div></div>

      <BlogAdmin info={info} save={save} />

      <div className="ap-box"><div className="ap-box-h"><h2>Yapay zekânın yaptıkları</h2>
        <select className="sel" style={{ width: "auto" }} aria-label="İşlem türü" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Hepsi</option>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select></div>
        {!actions.length ? <div className="empty">Henüz kayıt yok.</div> : (
          <table className="tbl"><thead><tr><th>Ne yaptı</th><th>Tür</th><th>Tarih</th><th className="r"></th></tr></thead><tbody>
            {actions.map((a) => {
              const isReq = a.kind === "talep_duzeltme" || a.kind === "talep_karar";
              return (
                <tr key={a.id} className={a.undone_at ? "muted" : ""}>
                  <td>{a.summary}{isReq && a.target_id && <div className="ti-s"><Link className="link" href={`/talep/${a.target_id}`}>Talep #{a.target_id}</Link></div>}</td>
                  <td data-m="Tür" className="nowrap">{KINDS[a.kind] ?? a.kind}</td>
                  <td data-m="Tarih" className="nowrap muted">{dateTr(a.created_at)}</td>
                  <td className="r">{a.undone_at ? <small className="muted">Geri alındı</small> : isReq && <button type="button" className="btn btn-sm" onClick={() => void undo(a)}>Geri al</button>}</td>
                </tr>
              );
            })}
          </tbody></table>
        )}
      </div>
    </>
  );
}

function BlogAdmin({ info, save }: { info: AiInfo; save: (p: Partial<Settings>) => Promise<void> }) {
  const { toast } = useSession();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [topic, setTopic] = useState("");
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  // null: kapalı, "new": elle yeni yazı, Post: düzenlenen yazı
  const [edit, setEdit] = useState<Post | "new" | null>(null);
  const s = info.settings;

  const load = useCallback(async () => {
    try { setPosts((await api<{ items: Post[] }>("/admin/blog")).items); } catch { setPosts([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const write = async () => {
    setBusy(true);
    try {
      const p = await api<Post>("/admin/blog/generate", { body: { topic, publish } });
      toast(p.status === "published" ? "Yazı yazıldı ve yayınlandı." : "Yazı taslak olarak kaydedildi.");
      setTopic(""); void load();
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const patch = async (id: number, body: Partial<Post>) => {
    try { await api(`/admin/blog/${id}`, { method: "PATCH", body }); toast("Kaydedildi."); setEdit(null); void load(); }
    catch (e) { toast((e as Error).message); }
  };
  const create = async (body: Partial<Post>, pub: boolean) => {
    try { await api("/admin/blog", { body: { ...body, publish: pub } }); toast(pub ? "Yazı yayınlandı." : "Yazı taslak olarak kaydedildi."); setEdit(null); void load(); }
    catch (e) { toast((e as Error).message); }
  };
  const remove = async (p: Post) => {
    if (!confirm(`"${p.title}" silinsin mi?`)) return;
    try { await api(`/admin/blog/${p.id}`, { method: "DELETE" }); toast("Silindi."); void load(); } catch (e) { toast((e as Error).message); }
  };
  const used = new Set((posts ?? []).map((p) => p.topic));

  return (
    <div className="ap-box"><div className="ap-box-h"><h2>Blog yazarı</h2>{posts && posts.some((p) => p.status === "published") && <Link className="link" href="/blog" target="_blank">Blogu gör ›</Link>}</div><div className="ap-box-b">
      <div className="form-grid" style={{ maxWidth: 720 }}>
        <div className="fg full"><label htmlFor="b-topic">Yazının konusu</label>
          <input id="b-topic" className="inp" maxLength={200} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Örn. İkinci el araba alırken nelere dikkat edilmeli?" />
          <div className="chips" style={{ marginTop: 6 }}>{info.topics.filter((t) => !used.has(t)).slice(0, 6).map((t) => <button key={t} type="button" className="chip" onClick={() => setTopic(t)}>{t}</button>)}</div>
        </div>
        <div className="fg full"><label className="chk"><input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> Yazınca hemen yayınla (işaretli değilse taslak olur, okuyup siz yayınlarsınız)</label></div>
      </div>
      <button type="button" className="btn btn-or" style={{ marginTop: 10 }} disabled={busy || topic.trim().length < 5 || !info.connected} onClick={() => void write()}>{busy ? "Yazılıyor… (1-2 dakika sürebilir)" : "Yapay zekâya yazdır"}</button>{" "}
      <button type="button" className="btn" style={{ marginTop: 10 }} onClick={() => setEdit("new")}>Kendim yazayım</button>

      <div className="ai-row" style={{ marginTop: 16 }}><div><label htmlFor="b-every"><b>Kendiliğinden blog yazsın</b></label><small>Seçtiğiniz aralıkla, sırası gelen konudan bir yazı yazar.</small></div>
        <select id="b-every" className="sel" style={{ width: "auto" }} value={s.ai_blog_every_days} onChange={(e) => void save({ ai_blog_every_days: Number(e.target.value) })}>
          {[[0, "Kapalı"], [1, "Her gün"], [3, "3 günde bir"], [7, "Haftada bir"], [14, "2 haftada bir"], [30, "Ayda bir"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select></div>
      {s.ai_blog_every_days > 0 && <Toggle id="b-auto" label="Kendiliğinden yazdıklarını hemen yayınla" hint="Kapalıysa taslak olarak bekler." on={s.ai_blog_autopublish} set={(v) => void save({ ai_blog_autopublish: v })} />}

      {!posts ? <div className="loading">Yükleniyor…</div> : !posts.length ? <div className="empty">Henüz yazı yok.</div> : (
        <table className="tbl" style={{ marginTop: 14 }}><thead><tr><th>Yazı</th><th>Durum</th><th>Tarih</th><th className="r"></th></tr></thead><tbody>
          {posts.map((p) => (
            <tr key={p.id}>
              <td><b>{p.title}</b><div className="ti-s">{p.summary}</div></td>
              <td data-m="Durum"><span className={"st " + (p.status === "published" ? "on" : "off")}>{p.status === "published" ? "Yayında" : "Taslak"}</span></td>
              <td data-m="Tarih" className="nowrap muted">{dateTr(p.published_at ?? p.created_at)}</td>
              <td className="r nowrap">
                {p.status === "published" && <Link className="btn btn-sm" href={`/blog/${p.slug}`} target="_blank">Gör</Link>}{" "}
                <button type="button" className="btn btn-sm" onClick={() => setEdit(p)}>Düzenle</button>{" "}
                <button type="button" className="btn btn-sm" onClick={() => void patch(p.id, { status: p.status === "published" ? "draft" : "published" })}>{p.status === "published" ? "Yayından kaldır" : "Yayınla"}</button>{" "}
                <button type="button" className="btn btn-sm" onClick={() => void remove(p)}>Sil</button>
              </td>
            </tr>
          ))}
        </tbody></table>
      )}
      {edit === "new" && <EditPost close={() => setEdit(null)} save={(b, pub) => void create(b, pub)} />}
      {edit && edit !== "new" && <EditPost key={edit.id} post={edit} close={() => setEdit(null)} save={(b) => void patch(edit.id, b)} />}
    </div></div>
  );
}

function EditPost({ post, close, save }: { post?: Post; close: () => void; save: (b: Partial<Post>, publish: boolean) => void }) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [summary, setSummary] = useState(post?.summary ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const ok = title.trim().length >= 5 && body.trim().length >= 50;
  const head = post ? "Yazıyı düzenle" : "Yeni yazı";
  return (
    <div className="ai-edit" role="dialog" aria-label={head}>
      <h3>{head}</h3>
      <div className="form-grid">
        <div className="fg full"><label htmlFor="e-title">Başlık</label><input id="e-title" className="inp" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="fg full"><label htmlFor="e-sum">Kısa özet</label><input id="e-sum" className="inp" maxLength={300} value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
        <div className="fg full"><label htmlFor="e-body">Yazı (## ara başlık, - madde, **kalın**)</label><textarea id="e-body" className="txa" rows={16} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {post ? <button type="button" className="btn btn-or" disabled={!ok} onClick={() => save({ title, summary, body }, false)}>Kaydet</button> : <>
          <button type="button" className="btn btn-or" disabled={!ok} onClick={() => save({ title, summary, body }, true)}>Yayınla</button>
          <button type="button" className="btn" disabled={!ok} onClick={() => save({ title, summary, body }, false)}>Taslak kaydet</button></>}
        <button type="button" className="btn" onClick={close}>Vazgeç</button>
      </div>
    </div>
  );
}
