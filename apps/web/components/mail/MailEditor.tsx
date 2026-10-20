'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MailBlock, MailCard, MailTemplate } from '@/lib/mail';
import { api as call, type RequestItem } from '@/lib/api';
import { fmt } from '@/lib/format';
import { api, uploadFile, useApp, Img, Skeleton } from './ms';
import { BLOCKS, blockLabel, blockMeta, checklist, rid } from './kit';
import { CANVAS_CSS, cur, drawCanvas, hasAlign, inlineEdit, ladder, type CanvasApi } from './canvas';
import { RuleModal } from './RuleModal';

type Draft = Omit<MailTemplate, 'id' | 'updatedAt' | 'uses'>;
// almakisterim renkleri: turuncu, lacivert, mavi, yeşil, kırmızı, amber
const ACCENTS = ['#f26b1d', '#13235b', '#1f54c9', '#18794e', '#d3302f', '#b76e00'];
const BGS = ['#f1f2f4', '#fff1e8', '#eaf0fc', '#e7f5ee', '#ffffff', '#13235b'];
const LINKS: [string, string][] = [['Ana sayfa', '/'], ['Talep ver', '/talep-ver'], ['Talepler', '/kategori'], ['Alarm kur', '/bana-ozel?s=alarm'], ['Güvenli Al', '/guvenli-al'], ['Bana Özel', '/bana-ozel']];
const VARS: [string, string][] = [['{ad}', 'Ad'], ['{adsoyad}', 'Ad soyad'], ['{eposta}', 'E-posta'], ['{talep}', 'Talep başlığı']];

/** Sürükle-bırak e-posta düzenleyici: solda bloklar ve katmanlar, ortada canlı önizleme, sağda seçili bloğun ayarları */
export function MailEditor({ id }: { id: number }) {
  const router = useRouter();
  const { toast, fail, user } = useApp();
  const [d, setD] = useState<Draft | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [html, setHtml] = useState('');
  // çerçeve bir kez yüklenir; sonraki değişiklikler yerinde uygulanır (kaydırma yeri korunur, titremez)
  const [first, setFirst] = useState('');
  const loaded = useRef(false);
  const [dev, setDev] = useState<'phone' | 'desktop'>('phone');
  const [pane, setPane] = useState<'blocks' | 'edit' | 'preview'>('preview');
  const [rule, setRule] = useState(false);
  const hist = useRef<{ past: Draft[]; future: Draft[] }>({ past: [], future: [] });
  const frame = useRef<HTMLIFrameElement>(null);
  // önizlemedeki araçlar her zaman güncel taslağı ve işlemleri görsün
  const live = useRef<CanvasApi | null>(null);

  useEffect(() => { api.admin.mail.template(id).then(r => { const { id: _i, updatedAt: _u, uses: _x, ...t } = r.template; setD(t); }).catch(e => { fail(e); router.push('/yonetim/eposta'); }); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // değişiklik: geri al yığınına eklenir
  const change = useCallback((fn: (x: Draft) => Draft) => {
    setD(cur => { if (!cur) return cur; hist.current.past.push(cur); if (hist.current.past.length > 60) hist.current.past.shift(); hist.current.future = []; return fn(cur); });
    setDirty(true);
  }, []);
  const undo = () => { const p = hist.current.past.pop(); if (p && d) { hist.current.future.push(d); setD(p); setDirty(true); } };
  const redo = () => { const f = hist.current.future.pop(); if (f && d) { hist.current.past.push(d); setD(f); setDirty(true); } };
  const setBlock = (bid: string, patch: Partial<MailBlock>) => change(x => ({ ...x, blocks: x.blocks.map(b => b.id === bid ? { ...b, ...patch } as MailBlock : b) }));

  const save = useCallback(async (quiet = false) => {
    if (!d) return false;
    setBusy(true);
    try { await api.admin.mail.saveTemplate(id, d); setDirty(false); if (!quiet) toast('Kaydedildi ✓'); return true; } catch (e) { fail(e); return false; } finally { setBusy(false); }
  }, [d, id, toast, fail]);

  // canlı önizleme (sunucu, gönderimle aynı çiziciyi kullanır)
  useEffect(() => {
    if (!d) return;
    const t = setTimeout(() => { api.admin.mail.render(d).then(r => { setHtml(r.html); setFirst(f => f || r.html); }).catch(() => {}); }, 150);
    return () => clearTimeout(t);
  }, [d]);
  // önizleme: bloğa dokununca seçilir; seçilinin üstünde araç çubuğu ve boyut tutamacı (canvas.ts); çift tıkla yerinde düzenle
  const wire = useCallback(() => {
    const doc = frame.current?.contentDocument; if (!doc?.body) return;
    let st = doc.getElementById('mb-sel') as HTMLStyleElement | null;
    if (!st) { st = doc.createElement('style'); st.id = 'mb-sel'; doc.head.appendChild(st); }
    st.textContent = CANVAS_CSS + (sel ? `[data-b="${sel}"]{outline:3px solid #8a5a44 !important;outline-offset:-3px}` : '');
    const w = doc as unknown as { _mb?: boolean };
    if (!w._mb) {
      w._mb = true;
      doc.addEventListener('click', e => {
        e.preventDefault();
        const t = e.target as HTMLElement;
        if (t.closest('[data-mbx]') || t.isContentEditable) return;
        const el = t.closest('[data-b]') as HTMLElement | null;
        if (el?.dataset.b) { setSel(el.dataset.b); if (window.innerWidth < 900) setPane('edit'); }
      });
      doc.addEventListener('dblclick', e => {
        const t = e.target as HTMLElement; const api = live.current;
        if (!api || t.closest('[data-mbx]')) return;
        const el = t.closest('[data-b]') as HTMLElement | null;
        if (el?.dataset.b && el.dataset.b !== api.sel) setSel(el.dataset.b);
        if (inlineEdit(doc, t, api)) { e.preventDefault(); doc.querySelectorAll('[data-mbx]').forEach(x => x.remove()); }
      });
      doc.addEventListener('keydown', e => {
        const api = live.current; if (!api?.sel || (e.target as HTMLElement).isContentEditable) return;
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); api.remove(api.sel); }
      });
      // görseller yüklenince yerleşim değişir: araçlar yeniden konumlanır
      doc.addEventListener('load', () => { if (live.current) drawCanvas(doc, live.current); }, true);
    }
    if (live.current) drawCanvas(doc, live.current);
  }, [sel]);
  // yeni çizimi açık önizlemeye yerinde uygula
  useEffect(() => {
    const doc = frame.current?.contentDocument;
    if (!html || !doc?.body || !loaded.current) return;
    const nb = new DOMParser().parseFromString(html, 'text/html').body;
    doc.body.setAttribute('style', nb.getAttribute('style') ?? '');
    doc.body.innerHTML = nb.innerHTML;
    wire();
  }, [html]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { wire(); }, [wire]);
  useEffect(() => { const t = setTimeout(wire, 350); return () => clearTimeout(t); }, [dev, d?.blocks]); // eslint-disable-line react-hooks/exhaustive-deps
  // seçilen (ya da yeni eklenen) blok önizlemede görünür alana kayar
  useEffect(() => {
    if (!sel) return;
    const t = setTimeout(() => frame.current?.contentDocument?.querySelector(`[data-b="${sel}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 450);
    return () => clearTimeout(t);
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  // klavye: ⌘S kaydet, ⌘Z geri al, ⌘⇧Z yinele, Delete seçiliyi sil
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); }
      else if (mod && e.key.toLowerCase() === 'z' && !(e.target as HTMLElement).closest('input,textarea')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  });
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (!d) return <Skeleton h={560} />;

  const add = (type: MailBlock['type'], at?: number) => {
    const b = blockMeta(type).make();
    change(x => { const n = [...x.blocks]; const i = at ?? (sel ? n.findIndex(y => y.id === sel) + 1 : n.length); n.splice(i < 0 ? n.length : i, 0, b); return { ...x, blocks: n }; });
    setSel(b.id); if (window.innerWidth < 900) setPane('edit');
  };
  const moveTo = (bid: string, to: number) => change(x => { const n = [...x.blocks]; const i = n.findIndex(y => y.id === bid); if (i < 0 || i === to) return x; const [b] = n.splice(i, 1); n.splice(to, 0, b!); return { ...x, blocks: n }; });
  const dup = (bid: string) => change(x => { const i = x.blocks.findIndex(y => y.id === bid); const c = { ...JSON.parse(JSON.stringify(x.blocks[i])), id: rid() } as MailBlock; const n = [...x.blocks]; n.splice(i + 1, 0, c); return { ...x, blocks: n }; });
  const remove = (bid: string) => { change(x => ({ ...x, blocks: x.blocks.filter(y => y.id !== bid) })); if (sel === bid) setSel(null); };
  // görseli, yanında yazı olan bloğa çevir (görsel, açıklama ve bağlantı korunur)
  const besideText = (bid: string) => change(x => ({ ...x, blocks: x.blocks.map(b => b.type === 'image' && b.id === bid
    ? { id: b.id, type: 'imagetext', image: b.url, alt: b.alt, link: b.link, side: 'left', ratio: 40, valign: 'middle', title: 'Başlık', text: 'Buraya yazını yaz.', btnText: '', btnUrl: '/', bg: b.bg, pt: b.pt } as MailBlock
    : b) }));
  live.current = { blocks: d.blocks, sel, set: (bid, p) => setBlock(bid, p as Partial<MailBlock>), move: moveTo, dup, remove, besideText };
  const selected = d.blocks.find(b => b.id === sel) ?? null;
  const checks = checklist(d);
  const score = checks.filter(c => c.ok).length;

  const sendTest = async () => {
    if (dirty && !(await save(true))) return;
    try { const r = await api.admin.mail.test(id); toast(r.ready ? `Deneme ${r.to} adresine gönderildi 📨` : 'E-posta servisi henüz bağlı değil: deneme kaydedildi ama gönderilmedi'); } catch (e) { fail(e); }
  };

  return (
    <div className="ms-ed">
      <div className="ms-top">
        <Link href="/yonetim/eposta" className="btn btn-ghost btn-sm">‹ Stüdyo</Link>
        <input className="ms-name" value={d.name} maxLength={80} onChange={e => change(x => ({ ...x, name: e.target.value }))} aria-label="Şablon adı" />
        <span className={'ms-state' + (dirty ? ' dirty' : '')}>{dirty ? '● Kaydedilmedi' : '✓ Kaydedildi'}</span>
        <div className="ms-top-r">
          <button className="btn btn-sm" title="Geri al (⌘Z)" disabled={!hist.current.past.length} onClick={undo}>↶</button>
          <button className="btn btn-sm" title="Yinele (⌘⇧Z)" disabled={!hist.current.future.length} onClick={redo}>↷</button>
          <button className="btn btn-sm" onClick={sendTest} title={`Deneme: ${user?.email ?? ''}`}>📨 Kendime dene</button>
          <button className="btn btn-sm" disabled={busy || !dirty} onClick={() => save()}>💾 Kaydet</button>
          <button className="btn btn-primary btn-sm" onClick={async () => { if (dirty && !(await save(true))) return; setRule(true); }}>⚡ Görev ver</button>
        </div>
      </div>
      <div className="seg ms-panes">
        {([['blocks', '🧱 Bloklar'], ['edit', '✏️ Düzenle'], ['preview', '👁 Önizle']] as const).map(([k, l]) => <button key={k} className={pane === k ? 'on' : ''} onClick={() => setPane(k)}>{l}</button>)}
      </div>

      <div className={'ms-grid pane-' + pane}>
        {/* ---- sol: bloklar + katmanlar ---- */}
        <aside className="ms-left">
          <div className="ms-h">Blok ekle <small>dokun ya da sürükle</small></div>
          <div className="ms-pal">
            {BLOCKS.map(b => (
              <button key={b.type} draggable onDragStart={e => { e.dataTransfer.setData('text/mb-new', b.type); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => add(b.type)} title={b.desc}>
                <span>{b.icon}</span><b>{b.name}</b>
              </button>
            ))}
          </div>
          <div className="ms-h">Katmanlar <small>tutup sürükleyerek sırala</small></div>
          <Layers blocks={d.blocks} sel={sel} onSel={s => { setSel(s); if (window.innerWidth < 900) setPane('edit'); }} onMove={moveTo} onAdd={add} onDup={dup} onDel={remove} />
        </aside>

        {/* ---- orta: canlı önizleme ---- */}
        <section className="ms-mid">
          <div className="ms-inbox" aria-label="Gelen kutusunda görünüş">
            <span className="ms-av">AK</span>
            <div><b>almakisterim</b><div className="ms-subj">{(d.subject || 'Konu yazılmadı').replace(/\{ad\}/g, user?.name.split(' ')[0] ?? 'Ayşe')}</div><div className="ms-pre">{d.preheader || 'Ön izleme metni yok: ilk satır görünür'}</div></div>
            <small>şimdi</small>
          </div>
          <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
            <div className="seg"><button className={dev === 'phone' ? 'on' : ''} onClick={() => setDev('phone')}>📱 Telefon</button><button className={dev === 'desktop' ? 'on' : ''} onClick={() => setDev('desktop')}>🖥 Bilgisayar</button></div>
          </div>
          {selected && live.current ? <SelBar b={selected} idx={d.blocks.findIndex(x => x.id === selected.id)} n={d.blocks.length} api={live.current} onClose={() => setSel(null)} /> : <div className="ms-selbar empty">Düzenlemek için önizlemede bir bölüme dokun</div>}
          <div className={'ms-device ' + dev} onDragOver={e => { if (e.dataTransfer.types.includes('text/mb-new')) e.preventDefault(); }} onDrop={e => { const t = e.dataTransfer.getData('text/mb-new'); if (t) { e.preventDefault(); add(t as MailBlock['type'], d.blocks.length); } }}>
            {first ? <iframe ref={frame} className="ms-frame" title="E-posta önizlemesi" sandbox="allow-same-origin" srcDoc={first} onLoad={() => { loaded.current = true; wire(); if (html !== first) setHtml(h => h + ' '); }} /> : <Skeleton h={600} />}
          </div>
          <div className="xs muted" style={{ textAlign: 'center' }}>Bir bölüme dokun: araçlar yukarıdaki şeritte çıkar. Bölümün solundaki <b>⠿</b> tutamacını sürükleyerek yerini değiştir, köşedeki <b>□</b> tutamaçla büyüt/küçült, yazıya <b>çift tıklayarak</b> düzelt. {'{ad}'} yerine alıcının adı yazılır.</div>
        </section>

        {/* ---- sağ: ayarlar ---- */}
        <aside className="ms-right">
          {selected ? (
            <div className="ms-card">
              <div className="ms-card-h"><span>{blockMeta(selected.type).icon}</span><b>{blockMeta(selected.type).name}</b><button className="btn btn-sm btn-ghost" onClick={() => setSel(null)}>✕</button></div>
              {selected.type === 'image' ? <button className="btn btn-sm" style={{ marginBottom: 8 }} onClick={() => besideText(selected.id)}>⊞ Yanına yazı ekle</button> : null}
              <BlockForm b={selected} set={p => setBlock(selected.id, p)} />
              <div className="row" style={{ gap: 6, marginTop: 10 }}>
                <button className="btn btn-sm" onClick={() => dup(selected.id)}>⧉ Kopyala</button>
                <button className="btn btn-sm btn-ghost" onClick={() => remove(selected.id)}>🗑 Sil</button>
              </div>
            </div>
          ) : (
            <>
              <div className="ms-card">
                <div className="ms-card-h"><span>✉️</span><b>E-posta ayarları</b></div>
                <label className="ms-f"><span>Konu</span><input className="input" maxLength={150} value={d.subject} onChange={e => change(x => ({ ...x, subject: e.target.value }))} placeholder="ör. {ad}, size uygun yeni talepler var" /></label>
                <Chips onPick={v => change(x => ({ ...x, subject: (x.subject + ' ' + v).trim() }))} />
                <label className="ms-f"><span>Ön izleme metni <small className="muted">gelen kutusunda konunun yanında</small></span><input className="input" maxLength={150} value={d.preheader} onChange={e => change(x => ({ ...x, preheader: e.target.value }))} /></label>
                <div className="ms-f"><span>Türü</span>
                  <div className="ms-kind">
                    <button className={d.kind === 'info' ? 'on' : ''} onClick={() => change(x => ({ ...x, kind: 'info' }))}><b>ℹ️ Bilgilendirme</b><small>Hoş geldin, onay, hesap. Herkese gider.</small></button>
                    <button className={d.kind === 'marketing' ? 'on' : ''} onClick={() => change(x => ({ ...x, kind: 'marketing' }))}><b>📣 Kampanya</b><small>Yalnızca izin verenlere; altına abonelikten çık eklenir.</small></button>
                  </div>
                </div>
                <div className="ms-f"><span>Vurgu rengi</span><Swatches list={ACCENTS} value={d.theme.accent} onPick={v => change(x => ({ ...x, theme: { ...x.theme, accent: v } }))} /></div>
                <div className="ms-f"><span>Arka plan</span><Swatches list={BGS} value={d.theme.bg} onPick={v => change(x => ({ ...x, theme: { ...x.theme, bg: v } }))} /></div>
                <div className="ms-f"><span>Kart rengi</span><Swatches list={['#ffffff', '#fafbfc', '#fff8f3', '#13235b']} value={d.theme.card} onPick={v => change(x => ({ ...x, theme: { ...x.theme, card: v } }))} /></div>
                <div className="ms-f"><span>Başlıkların yazı tipi</span><Seg value={d.theme.headFont ?? 'sans'} options={[['serif', 'Zarif (serif)'], ['sans', 'Sade (modern)']]} onChange={v => change(x => ({ ...x, theme: { ...x.theme, headFont: v } }))} /></div>
                <label className="check small"><input type="checkbox" checked={d.theme.logo !== false} onChange={e => change(x => ({ ...x, theme: { ...x.theme, logo: e.target.checked } }))} /> En üstte almakisterim.com logosu</label>
              </div>
              <div className="ms-card">
                <div className="ms-card-h"><span>✅</span><b>Gönderime hazır mı?</b><span className={'ms-score' + (score === checks.length ? ' ok' : '')}>{score}/{checks.length}</span></div>
                <ul className="ms-check">{checks.map(c => <li key={c.text} className={c.ok ? 'ok' : ''}>{c.ok ? '✓' : '!'} {c.text}</li>)}</ul>
              </div>
              <div className="ms-card xs muted">İpucu: bir bloğu düzenlemek için soldaki katmanlardan ya da önizlemeden ona dokun. ⌘S kaydeder, ⌘Z geri alır.</div>
            </>
          )}
        </aside>
      </div>
      {rule ? <RuleModal templates={[{ id, name: d.name, kind: d.kind }]} preset={{ templateId: id }} onClose={() => setRule(false)} onSaved={() => { setRule(false); toast('Görev kaydedildi ⚡'); router.push('/yonetim/eposta'); }} /> : null}
    </div>
  );
}

/** Katmanlar: tutamaçtan tutup sürükleyerek sıralanır (dokunmatikte de çalışır); bloklar listeye bırakılarak eklenir */
function Layers({ blocks, sel, onSel, onMove, onAdd, onDup, onDel }: { blocks: MailBlock[]; sel: string | null; onSel: (id: string) => void; onMove: (id: string, to: number) => void; onAdd: (t: MailBlock['type'], at: number) => void; onDup: (id: string) => void; onDel: (id: string) => void }) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-layer]') as HTMLElement | null;
    if (!el) return;
    const to = Number(el.dataset.layer);
    const from = blocks.findIndex(b => b.id === drag);
    if (to !== from) onMove(drag, to);
  };
  if (!blocks.length) return <div className="ms-empty" onDragOver={e => e.preventDefault()} onDrop={e => { const t = e.dataTransfer.getData('text/mb-new'); if (t) onAdd(t as MailBlock['type'], 0); }}>Henüz blok yok. Yukarıdan bir blok seç ya da buraya sürükle.</div>;
  return (
    <div className="ms-layers" onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
      {blocks.map((b, i) => {
        const m = blockMeta(b.type);
        return (
          <div key={b.id} data-layer={i} className={'ms-layer' + (sel === b.id ? ' on' : '') + (drag === b.id ? ' drag' : '') + (over === i ? ' over' : '')}
            onClick={() => onSel(b.id)}
            onDragOver={e => { if (e.dataTransfer.types.includes('text/mb-new')) { e.preventDefault(); setOver(i); } }}
            onDragLeave={() => setOver(o => o === i ? null : o)}
            onDrop={e => { const t = e.dataTransfer.getData('text/mb-new'); setOver(null); if (t) { e.preventDefault(); onAdd(t as MailBlock['type'], i); } }}>
            <span className="ms-grip" title="Sürükle" onPointerDown={e => { e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); setDrag(b.id); }} onClick={e => e.stopPropagation()}>⠿</span>
            <span className="ms-li">{m.icon}</span>
            <div className="ms-lt"><b>{m.name}</b><small>{blockLabel(b) || ' '}</small></div>
            <div className="ms-lb" onClick={e => e.stopPropagation()}>
              <button title="Yukarı" disabled={!i} onClick={() => onMove(b.id, i - 1)}>↑</button>
              <button title="Aşağı" disabled={i === blocks.length - 1} onClick={() => onMove(b.id, i + 1)}>↓</button>
              <button title="Kopyala" onClick={() => onDup(b.id)}>⧉</button>
              <button title="Sil" onClick={() => onDel(b.id)}>🗑</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Seçili bölümün araç şeridi: önizlemenin dışında durur, e-postanın hiçbir yerini kapatmaz */
function SelBar({ b, idx, n, api, onClose }: { b: MailBlock; idx: number; n: number; api: CanvasApi; onClose: () => void }) {
  const L = ladder(b);
  const v = L ? cur(b, L) : null; const i = L && v != null ? L.steps.indexOf(v) : -1;
  const al = (b as { align?: string }).align ?? (b.type === 'image' || b.type === 'button' || b.type === 'hero' ? 'center' : 'left');
  return (
    <div className="ms-selbar" role="toolbar" aria-label="Seçili bölüm">
      <b className="ms-selbar-n">{blockMeta(b.type).icon} {blockMeta(b.type).name}</b>
      <span className="ms-selbar-g">
        <button title="Yukarı" disabled={idx <= 0} onClick={() => api.move(b.id, idx - 1)}>↑</button>
        <button title="Aşağı" disabled={idx >= n - 1} onClick={() => api.move(b.id, idx + 1)}>↓</button>
      </span>
      {L && v != null ? (
        <span className="ms-selbar-g">
          <button title="Küçült" disabled={i <= 0} onClick={() => api.set(b.id, { [L.key]: L.steps[i - 1] })}>－</button>
          <em>{L.label(v)}</em>
          <button title="Büyüt" disabled={i >= L.steps.length - 1} onClick={() => api.set(b.id, { [L.key]: L.steps[i + 1] })}>＋</button>
        </span>
      ) : null}
      {hasAlign(b) ? (
        <span className="ms-selbar-g">
          {([['left', '⇤', 'Sola'], ['center', '↔', 'Ortaya'], ['right', '⇥', 'Sağa']] as const).map(([k, l, t]) => <button key={k} title={t} className={al === k ? 'on' : ''} onClick={() => api.set(b.id, { align: k })}>{l}</button>)}
        </span>
      ) : null}
      {b.type === 'imagetext' ? <span className="ms-selbar-g"><button title="Görseli öbür yana al" onClick={() => api.set(b.id, { side: b.side === 'left' ? 'right' : 'left' })}>⇄ Yer değiştir</button></span> : null}
      {b.type === 'image' ? <span className="ms-selbar-g"><button title="Görselin yanına başlık, metin ve düğme ekle" onClick={() => api.besideText(b.id)}>⊞ Yanına yazı</button></span> : null}
      <span className="ms-selbar-g">
        <button title="Kopyala" onClick={() => api.dup(b.id)}>⧉</button>
        <button title="Sil" onClick={() => api.remove(b.id)}>🗑</button>
        <button title="Seçimi kaldır" onClick={onClose}>✕</button>
      </span>
    </div>
  );
}

function Chips({ onPick }: { onPick: (v: string) => void }) {
  return <div className="ms-chips">{VARS.map(([v, l]) => <button key={v} type="button" onClick={() => onPick(v)}>＋ {l}</button>)}</div>;
}
function Swatches({ list, value, onPick }: { list: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="ms-sw">
      {list.map(c => <button key={c} type="button" className={value.toLowerCase() === c ? 'on' : ''} style={{ background: c }} onClick={() => onPick(c)} aria-label={c} />)}
      <input type="color" value={value} onChange={e => onPick(e.target.value)} aria-label="Özel renk" />
    </div>
  );
}
function UrlField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="ms-f"><span>{label}</span>
      <input className="input" value={value} onChange={e => onChange(e.target.value)} placeholder="/talep-ver ya da https://…" />
      <div className="ms-chips">{LINKS.map(([l, u]) => <button key={u} type="button" className={value === u ? 'on' : ''} onClick={() => onChange(u)}>{l}</button>)}</div>
    </label>
  );
}
function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { fail } = useApp();
  const [up, setUp] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="ms-f"><span>Görsel</span>
      <div className="ms-img" onClick={() => ref.current?.click()} onDragOver={e => e.preventDefault()} onDrop={async e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (!f) return; setUp(true); try { onChange(await uploadFile(f, 'cover')); } catch (er) { fail(er); } finally { setUp(false); } }}>
        {value ? <img src={value} alt="" /> : <span>{up ? '⏳ Yükleniyor…' : '📤 Görsel seç ya da sürükle'}</span>}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setUp(true); try { onChange(await uploadFile(f, 'cover')); } catch (er) { fail(er); } finally { setUp(false); e.target.value = ''; } }} />
      {value ? <button className="btn btn-sm btn-ghost" onClick={() => onChange('')}>Görseli kaldır</button> : null}
    </div>
  );
}

const TEXT_COLORS = ['#13235b', '#1f2328', '#3a414b', '#6a717c', '#f26b1d', '#1f54c9', '#18794e', '#ffffff'];
const SECTION_BGS = ['#f1f2f4', '#fff1e8', '#eaf0fc', '#e7f5ee', '#fff6e0', '#13235b'];

/** Seçenek düğmeleri (tek seçim) */
function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return <div className="seg ms-seg">{options.map(([k, l]) => <button key={String(k)} type="button" className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}</div>;
}
function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div className="ms-f"><span>{label}</span>{children}</div>;
}
/** Açılıp kapanan ayar grubu: az kullanılan ayarlar kalabalık yapmasın */
function Group({ title, open = false, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return <details className="ms-group" open={open}><summary>{title}</summary><div className="ms-group-b">{children}</div></details>;
}
/** Yazı tipi, boyut, renk, kalın/italik/büyük harf */
function TypeFields({ font, size, sizes, color, bold, italic, upper, onChange }: {
  font: 'serif' | 'sans'; size: string; sizes: [string, string][]; color: string; bold?: boolean; italic?: boolean; upper?: boolean;
  onChange: (p: Record<string, unknown>) => void;
}) {
  return (
    <>
      <Field label="Yazı tipi"><Seg value={font} options={[['serif', 'Zarif (serif)'], ['sans', 'Sade (modern)']]} onChange={v => onChange({ font: v })} /></Field>
      <Field label="Boyut"><Seg value={size} options={sizes} onChange={v => onChange({ size: v })} /></Field>
      {bold !== undefined ? (
        <Field label="Stil">
          <div className="ms-toggles">
            <button type="button" className={bold ? 'on' : ''} onClick={() => onChange({ bold: !bold })}><b>K</b> Kalın</button>
            <button type="button" className={italic ? 'on' : ''} onClick={() => onChange({ italic: !italic })}><i>İ</i> İtalik</button>
            <button type="button" className={upper ? 'on' : ''} onClick={() => onChange({ upper: !upper })}>AA Büyük harf</button>
          </div>
        </Field>
      ) : null}
      <Field label="Yazı rengi"><Swatches list={TEXT_COLORS} value={color} onPick={v => onChange({ color: v })} /></Field>
    </>
  );
}
/** Her bölümde: arka plan rengi ve üst boşluk */
function SectionFields({ b, set, defPt }: { b: { bg?: string; pt?: number }; set: (p: Record<string, unknown>) => void; defPt: number }) {
  const pt = b.pt ?? defPt;
  return (
    <Group title="🎨 Bölüm arka planı ve boşluk">
      <Field label="Arka plan">
        <div className="ms-sw">
          <button type="button" className={'ms-none' + (!b.bg ? ' on' : '')} onClick={() => set({ bg: '' })} title="Yok">∅</button>
          {SECTION_BGS.map(c => <button key={c} type="button" className={b.bg === c ? 'on' : ''} style={{ background: c }} onClick={() => set({ bg: c })} aria-label={c} />)}
          <input type="color" value={b.bg || '#ffffff'} onChange={e => set({ bg: e.target.value })} aria-label="Özel renk" />
        </div>
      </Field>
      <label className="ms-f"><span>Üst boşluk: {pt}px</span><input type="range" min={0} max={64} step={4} value={pt} onChange={e => set({ pt: Number(e.target.value) })} /></label>
    </Group>
  );
}
const ALIGN3: ['left' | 'center' | 'right', string][] = [['left', '⇤ Sol'], ['center', '↔ Orta'], ['right', '⇥ Sağ']];
const TEXT_HINT = <small className="muted">**kalın** · *italik* · [yazı](/talep-ver) bağlantı</small>;

function BlockForm({ b, set }: { b: MailBlock; set: (p: Partial<MailBlock>) => void }) {
  const ins = (cur: string, v: string) => (cur + ' ' + v).replace(/\s+$/, '');
  const any = set as (p: Record<string, unknown>) => void;
  switch (b.type) {
    case 'hero': return (
      <>
        <label className="ms-f"><span>Başlık</span><input className="input" maxLength={120} value={b.title} onChange={e => set({ title: e.target.value })} /></label>
        <label className="ms-f"><span>Açıklama</span><textarea className="input" rows={3} maxLength={400} value={b.text} onChange={e => set({ text: e.target.value })} /></label>
        <Chips onPick={v => set({ title: ins(b.title, v) })} />
        <ImageField value={b.image} onChange={v => set({ image: v })} />
        <Field label="Başlık boyutu"><Seg value={b.size ?? 'lg'} options={[['md', 'Orta'], ['lg', 'Büyük'], ['xl', 'Çok büyük']]} onChange={v => any({ size: v })} /></Field>
        <Field label="Hizalama"><Seg value={b.align ?? 'center'} options={ALIGN3} onChange={v => any({ align: v })} /></Field>
        <Field label="Yükseklik"><Seg value={b.pad ?? 'md'} options={[['sm', 'Alçak'], ['md', 'Orta'], ['lg', 'Yüksek']]} onChange={v => any({ pad: v })} /></Field>
        <div className="ms-f"><span>Zemin rengi {b.image ? <small className="muted">(görsel varken altta kalır)</small> : null}</span><Swatches list={['#13235b', '#f26b1d', '#1f54c9', '#18794e', '#d3302f', '#1f2328']} value={b.bg} onPick={v => set({ bg: v })} /></div>
        <div className="ms-f"><span>Yazı rengi</span><Swatches list={['#ffffff', '#fff1e8', '#13235b']} value={b.fg} onPick={v => set({ fg: v })} /></div>
        <Group title="🔘 Afişe düğme ekle">
          <label className="ms-f"><span>Düğme yazısı <small className="muted">boşsa düğme yok</small></span><input className="input" maxLength={60} value={b.btnText ?? ''} onChange={e => any({ btnText: e.target.value })} placeholder="ör. Ücretsiz talep ver" /></label>
          <UrlField label="Gideceği sayfa" value={b.btnUrl ?? ''} onChange={v => any({ btnUrl: v })} />
        </Group>
      </>
    );
    case 'heading': return (
      <>
        <label className="ms-f"><span>Başlık</span><input className="input" maxLength={160} value={b.text} onChange={e => set({ text: e.target.value })} /></label>
        <Chips onPick={v => set({ text: ins(b.text, v) })} />
        <Field label="Hizalama"><Seg value={b.align} options={ALIGN3} onChange={v => any({ align: v })} /></Field>
        <TypeFields font={b.font ?? 'sans'} size={b.size} sizes={[['sm', 'Küçük'], ['md', 'Orta'], ['lg', 'Büyük'], ['xl', 'Çok büyük']]} color={b.color ?? '#13235b'} bold={b.bold ?? true} italic={b.italic ?? false} upper={b.upper ?? false} onChange={any} />
        <SectionFields b={b} set={any} defPt={24} />
      </>
    );
    case 'text': return (
      <>
        <label className="ms-f"><span>Metin {TEXT_HINT}</span><textarea className="input" rows={7} maxLength={3000} value={b.text} onChange={e => set({ text: e.target.value })} /></label>
        <Chips onPick={v => set({ text: ins(b.text, v) })} />
        <Field label="Hizalama"><Seg value={b.align} options={ALIGN3} onChange={v => any({ align: v })} /></Field>
        <TypeFields font={b.font ?? 'sans'} size={b.size ?? 'md'} sizes={[['sm', 'Küçük'], ['md', 'Normal'], ['lg', 'Büyük']]} color={b.color ?? '#3a414b'} onChange={any} />
        <SectionFields b={b} set={any} defPt={14} />
      </>
    );
    case 'button': return (
      <>
        <label className="ms-f"><span>Düğme yazısı</span><input className="input" maxLength={60} value={b.text} onChange={e => set({ text: e.target.value })} /></label>
        <UrlField label="Gideceği sayfa" value={b.url} onChange={v => set({ url: v })} />
        <Field label="Hizalama"><Seg value={b.align} options={ALIGN3} onChange={v => any({ align: v })} /></Field>
        <Field label="Boyut"><Seg value={b.size ?? 'md'} options={[['sm', 'Küçük'], ['md', 'Orta'], ['lg', 'Büyük']]} onChange={v => any({ size: v })} /></Field>
        <Field label="Şekil"><Seg value={b.shape ?? 'pill'} options={[['pill', '⬭ Yuvarlak'], ['rounded', '▢ Hafif'], ['square', '■ Köşeli']]} onChange={v => any({ shape: v })} /></Field>
        <Field label="Görünüm"><Seg value={b.style ?? 'solid'} options={[['solid', 'Dolu'], ['outline', 'Çerçeveli']]} onChange={v => any({ style: v })} /></Field>
        <label className="check small"><input type="checkbox" checked={!!b.full} onChange={e => any({ full: e.target.checked })} /> Tam genişlik</label>
        <Field label={<>Düğme rengi <small className="muted">boşsa vurgu rengi</small></>}>
          <div className="ms-sw"><button type="button" className={'ms-none' + (!b.color ? ' on' : '')} onClick={() => any({ color: '' })} title="Vurgu rengi">A</button>{ACCENTS.map(c => <button key={c} type="button" className={b.color === c ? 'on' : ''} style={{ background: c }} onClick={() => any({ color: c })} aria-label={c} />)}<input type="color" value={b.color || '#f26b1d'} onChange={e => any({ color: e.target.value })} aria-label="Özel renk" /></div>
        </Field>
        <Field label="Yazı rengi"><Swatches list={['#ffffff', '#13235b', '#1f2328']} value={b.fg ?? '#ffffff'} onPick={v => any({ fg: v })} /></Field>
        <SectionFields b={b} set={any} defPt={24} />
      </>
    );
    case 'image': return (
      <>
        <ImageField value={b.url} onChange={v => set({ url: v })} />
        <label className="ms-f"><span>Genişlik: %{b.width ?? 100}</span><input type="range" min={20} max={100} step={5} value={b.width ?? 100} onChange={e => any({ width: Number(e.target.value) })} /></label>
        <Field label="Hizalama"><Seg value={b.align ?? 'center'} options={ALIGN3} onChange={v => any({ align: v })} /></Field>
        <Field label="Köşeler"><Seg value={b.radius ?? 'lg'} options={[['none', 'Köşeli'], ['sm', 'Hafif'], ['lg', 'Yuvarlak']]} onChange={v => any({ radius: v })} /></Field>
        <label className="check small"><input type="checkbox" checked={!!b.edge} onChange={e => any({ edge: e.target.checked })} /> Kenardan kenara (boşluksuz, tam genişlik)</label>
        <label className="ms-f"><span>Alt yazı <small className="muted">isteğe bağlı</small></span><input className="input" maxLength={200} value={b.caption ?? ''} onChange={e => any({ caption: e.target.value })} /></label>
        <label className="ms-f"><span>Görsel açıklaması <small className="muted">görsel açılmazsa görünür</small></span><input className="input" maxLength={140} value={b.alt} onChange={e => set({ alt: e.target.value })} /></label>
        <UrlField label="Dokununca açılacak sayfa (isteğe bağlı)" value={b.link} onChange={v => set({ link: v })} />
        <div className="xs muted">Görselin yanına yazı koymak için <b>🪟 Görsel + yazı</b> bloğunu kullan.</div>
        <SectionFields b={b} set={any} defPt={20} />
      </>
    );
    case 'imagetext': return (
      <>
        <ImageField value={b.image} onChange={v => any({ image: v })} />
        <Field label="Görsel hangi yanda"><Seg value={b.side} options={[['left', '🖼 Solda'], ['right', 'Sağda 🖼']]} onChange={v => any({ side: v })} /></Field>
        <Field label="Görsel genişliği"><Seg value={b.ratio} options={[[33, 'Dar'], [40, 'Orta'], [50, 'Yarı yarıya']]} onChange={v => any({ ratio: v })} /></Field>
        <Field label="Yazı hizası"><Seg value={b.valign} options={[['top', '⤒ Üstte'], ['middle', '↕ Ortada']]} onChange={v => any({ valign: v })} /></Field>
        <label className="ms-f"><span>Başlık</span><input className="input" maxLength={120} value={b.title} onChange={e => any({ title: e.target.value })} /></label>
        <label className="ms-f"><span>Metin {TEXT_HINT}</span><textarea className="input" rows={5} maxLength={1200} value={b.text} onChange={e => any({ text: e.target.value })} /></label>
        <Chips onPick={v => any({ text: ins(b.text, v) })} />
        <label className="ms-f"><span>Düğme yazısı <small className="muted">boşsa düğme yok</small></span><input className="input" maxLength={60} value={b.btnText} onChange={e => any({ btnText: e.target.value })} /></label>
        {b.btnText ? <UrlField label="Düğmenin gideceği sayfa" value={b.btnUrl} onChange={v => any({ btnUrl: v })} /> : null}
        <label className="ms-f"><span>Görsel açıklaması</span><input className="input" maxLength={140} value={b.alt} onChange={e => any({ alt: e.target.value })} /></label>
        <UrlField label="Görsele dokununca (isteğe bağlı)" value={b.link} onChange={v => any({ link: v })} />
        <div className="xs muted">Telefonda görsel ve yazı alt alta geçer.</div>
        <SectionFields b={b} set={any} defPt={24} />
      </>
    );
    case 'cards': {
      const upd = (i: number, p: Partial<MailCard>) => any({ items: b.items.map((x, k) => k === i ? { ...x, ...p } : x) });
      return (
        <>
          <Field label="Sütun"><Seg value={b.cols} options={[[2, '2 sütun'], [3, '3 sütun']]} onChange={v => any({ cols: v })} /></Field>
          {b.items.map((it, i) => (
            <Group key={i} title={`🗂 Kart ${i + 1}${it.title ? ': ' + it.title : ''}`} open={i === 0}>
              <ImageField value={it.image} onChange={v => upd(i, { image: v })} />
              <label className="ms-f"><span>Başlık</span><input className="input" maxLength={80} value={it.title} onChange={e => upd(i, { title: e.target.value })} /></label>
              <label className="ms-f"><span>Metin</span><textarea className="input" rows={3} maxLength={300} value={it.text} onChange={e => upd(i, { text: e.target.value })} /></label>
              <UrlField label="Dokununca açılacak sayfa" value={it.link} onChange={v => upd(i, { link: v })} />
              {b.items.length > 1 ? <button type="button" className="btn btn-sm btn-ghost" onClick={() => any({ items: b.items.filter((_, k) => k !== i) })}>🗑 Bu kartı sil</button> : null}
            </Group>
          ))}
          {b.items.length < 6 ? <button type="button" className="btn btn-sm" onClick={() => any({ items: [...b.items, { image: '', title: 'Yeni kart', text: '', link: '' }] })}>＋ Kart ekle</button> : null}
          <div className="xs muted">Telefonda kartlar alt alta geçer.</div>
          <SectionFields b={b} set={any} defPt={20} />
        </>
      );
    }
    case 'requests': return (
      <>
        <label className="ms-f"><span>Bölüm başlığı</span><input className="input" maxLength={100} value={b.title} onChange={e => set({ title: e.target.value })} /></label>
        <Field label="Sütun"><Seg value={b.cols ?? 2} options={[[2, '2 sütun'], [3, '3 sütun']]} onChange={v => any({ cols: v })} /></Field>
        <RequestPick ids={b.ids} onChange={ids => set({ ids })} />
        <SectionFields b={b} set={any} defPt={16} />
      </>
    );
    case 'coupon': return (
      <>
        <label className="ms-f"><span>Kod</span><input className="input" maxLength={30} value={b.code} onChange={e => set({ code: e.target.value.toUpperCase().replace(/\s/g, '') })} /></label>
        <label className="ms-f"><span>Not</span><input className="input" maxLength={160} value={b.note} onChange={e => set({ note: e.target.value })} placeholder="ör. Pazar gece yarısına kadar geçerli" /></label>
        <div className="xs muted">Kampanya ya da indirim kodu; kutunun içinde büyük yazılır.</div>
        <SectionFields b={b} set={any} defPt={24} />
      </>
    );
    case 'divider': return (
      <>
        <Field label="Renk"><Swatches list={['#dadde2', '#e9ebee', '#f26b1d', '#13235b', '#1f2328']} value={b.color ?? '#dadde2'} onPick={v => any({ color: v })} /></Field>
        <Field label="Kalınlık"><Seg value={b.thick ?? 1} options={[[1, 'İnce'], [2, 'Orta'], [4, 'Kalın']]} onChange={v => any({ thick: v })} /></Field>
        <label className="ms-f"><span>Genişlik: %{b.width ?? 100}</span><input type="range" min={10} max={100} step={5} value={b.width ?? 100} onChange={e => any({ width: Number(e.target.value) })} /></label>
        <SectionFields b={b} set={any} defPt={24} />
      </>
    );
    case 'spacer': return <label className="ms-f"><span>Yükseklik: {b.h}px</span><input type="range" min={8} max={80} step={4} value={b.h} onChange={e => set({ h: Number(e.target.value) })} /></label>;
    case 'social': return (
      <>
        {(['instagram', 'tiktok', 'youtube'] as const).map(k => <label key={k} className="ms-f"><span>{k === 'instagram' ? 'Instagram' : k === 'tiktok' ? 'TikTok' : 'YouTube'}</span><input className="input" value={b[k]} onChange={e => set({ [k]: e.target.value })} placeholder="https://…" /></label>)}
        <SectionFields b={b} set={any} defPt={24} />
      </>
    );
    default: return <div className="xs muted">Bu bloğun ayarı yok.</div>;
  }
}

/** Talep seçici (Marka Bahçem'deki ürün seçicinin karşılığı): yayındaki talepler başlık ya da talep no ile aranır, en fazla 6 */
function RequestPick({ ids, onChange }: { ids: number[]; onChange: (ids: number[]) => void }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<RequestItem[]>([]);
  const [picked, setPicked] = useState<Map<number, RequestItem>>(new Map());
  const remember = (items: RequestItem[]) => setPicked(m => { const n = new Map(m); items.forEach(p => n.set(p.id, p)); return n; });
  useEffect(() => {
    if (!ids.length) return;
    call<{ items: RequestItem[] }>(`/requests?ids=${ids.join(',')}&per=10`).then(r => remember(r.items)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => { call<{ items: RequestItem[] }>(`/requests?per=8${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`).then(r => { setRes(r.items); remember(r.items); }).catch(() => {}); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="ms-f"><span>Talepler ({ids.length}/6)</span>
      {ids.length ? <div className="ms-picked">{ids.map(i => { const p = picked.get(i); return <div key={i}><span className="ms-pi"><Img src={p?.cover_url} seed={i} /></span><small>{p?.title ?? `Talep No ${i}`}</small><button onClick={() => onChange(ids.filter(x => x !== i))} aria-label="Çıkar">✕</button></div>; })}</div> : null}
      <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Talep ara (başlık ya da talep no; boşsa en yeniler)" aria-label="E-postaya eklenecek talebi ara" />
      <div className="ms-res">{res.map(p => (
        <button key={p.id} type="button" disabled={ids.includes(p.id) || ids.length >= 6} onClick={() => onChange([...ids, p.id])}>
          <span className="ms-pi"><Img src={p.cover_url} seed={p.id} /></span><span className="grow"><small>{p.city} · No {p.id}</small><b>{p.title}</b></span><em>{fmt(p.budget_max)} TL</em>
        </button>
      ))}</div>
    </div>
  );
}
