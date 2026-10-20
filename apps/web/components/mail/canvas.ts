import type { MailBlock } from '@/lib/mail';

/* =========================================================
   Önizleme üzerinde doğrudan düzenleme (tasarım programı gibi)
   - seçili bölümün araçları önizlemenin dışında (MailEditor), içeriği kapatmaz
   - ⠿ tutup sürükle: bölümü e-postada başka yere taşı (yerleşim çizgisi gösterilir)
   - köşe tutamacı: görseli/yazıyı/düğmeyi büyüt-küçült, boşluğu uzat-kısalt (anında önizleme, bırakınca kaydolur)
   - çift tıkla: yazıyı önizlemenin üstünde düzelt
   E-postalarda serbest (x,y) yerleşim desteklenmez; bölümler yukarıdan aşağı sıralıdır.
   ========================================================= */

export type CanvasApi = {
  blocks: MailBlock[];
  sel: string | null;
  set: (id: string, patch: Record<string, unknown>) => void;
  move: (id: string, to: number) => void;
  dup: (id: string) => void;
  remove: (id: string) => void;
  /** görseli, yanında yazı alanı olan "Görsel + yazı" bloğuna çevirir */
  besideText: (id: string) => void;
};

export type Ladder = { key: string; steps: (string | number)[]; label: (v: string | number) => string; px?: Record<string, number> };
const SIZE_LABEL: Record<string, string> = { sm: 'Küçük', md: 'Orta', lg: 'Büyük', xl: 'Çok büyük' };
/** Bloğun "boyutu": küçült/büyüt düğmeleri ve tutamaç bu basamaklarda gezer */
export function ladder(b: MailBlock): Ladder | null {
  switch (b.type) {
    case 'heading': return { key: 'size', steps: ['sm', 'md', 'lg', 'xl'], label: v => SIZE_LABEL[v as string]!, px: { sm: 18, md: 22, lg: 30, xl: 38 } };
    case 'text': return { key: 'size', steps: ['sm', 'md', 'lg'], label: v => SIZE_LABEL[v as string]!, px: { sm: 14, md: 16, lg: 18 } };
    case 'button': return { key: 'size', steps: ['sm', 'md', 'lg'], label: v => SIZE_LABEL[v as string]! };
    case 'hero': return { key: 'size', steps: ['md', 'lg', 'xl'], label: v => SIZE_LABEL[v as string]!, px: { md: 26, lg: 34, xl: 44 } };
    case 'image': return { key: 'width', steps: Array.from({ length: 17 }, (_, i) => 20 + i * 5), label: v => `%${v}` };
    case 'imagetext': return { key: 'ratio', steps: [33, 40, 50], label: v => ({ 33: 'Dar görsel', 40: 'Orta görsel', 50: 'Yarı yarıya' } as Record<number, string>)[v as number]! };
    case 'divider': return { key: 'width', steps: Array.from({ length: 19 }, (_, i) => 10 + i * 5), label: v => `%${v}` };
    case 'spacer': return { key: 'h', steps: Array.from({ length: 19 }, (_, i) => 8 + i * 4), label: v => `${v}px` };
    default: return null;
  }
}
const DEFAULTS: Record<string, string | number> = { heading: 'lg', text: 'md', button: 'md', hero: 'lg', image: 100, imagetext: 40, divider: 100, spacer: 24 };
export const cur = (b: MailBlock, l: Ladder) => ((b as Record<string, unknown>)[l.key] as string | number | undefined) ?? DEFAULTS[b.type]!;
export const hasAlign = (b: MailBlock) => ['heading', 'text', 'button', 'image', 'hero'].includes(b.type);
/** çift tıklayınca yerinde düzenlenebilen alan (biçimlendirme işareti yoksa) */
const inlineField = (b: MailBlock): string | null => b.type === 'heading' || b.type === 'text' || b.type === 'button' ? 'text' : b.type === 'hero' ? 'title' : null;

export const CANVAS_CSS = `
[data-b]{cursor:pointer;transition:outline-color .15s}
[data-b]:hover{outline:2px dashed rgba(242,107,29,.45);outline-offset:-2px}
.mbx-grip{position:absolute;z-index:51;width:26px;height:26px;border-radius:8px;background:#F26B1D;color:#fff;display:flex;align-items:center;justify-content:center;font:700 15px/1 -apple-system,sans-serif;cursor:grab;box-shadow:0 2px 8px rgba(0,0,0,.25);user-select:none;touch-action:none;opacity:.9}
.mbx-grip:hover{opacity:1}
.mbx-h{position:absolute;z-index:51;width:16px;height:16px;border-radius:4px;background:#fff;border:2px solid #F26B1D;box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:nwse-resize;touch-action:none}
.mbx-h.v{cursor:ns-resize}
.mbx-badge{position:absolute;z-index:52;background:#F26B1D;color:#fff;font:700 12px/1 -apple-system,sans-serif;padding:5px 8px;border-radius:6px;pointer-events:none}
.mbx-line{position:absolute;z-index:49;height:4px;border-radius:2px;background:#F26B1D;box-shadow:0 0 0 3px rgba(242,107,29,.25);pointer-events:none}
.mbx-dragging [data-b]{cursor:grabbing}
[contenteditable=true]{outline:2px solid #1F54C9!important;outline-offset:3px;cursor:text;border-radius:4px}
`;

/** Seçili bölümün araçlarını önizleme belgesine çizer (her yeniden çizimde tekrar çağrılır) */
export function drawCanvas(doc: Document, api: CanvasApi) {
  doc.querySelectorAll('[data-mbx]').forEach(e => e.remove());
  const { sel, blocks } = api;
  if (!sel) return;
  const idx = blocks.findIndex(b => b.id === sel);
  const b = blocks[idx];
  const row = doc.querySelector(`[data-b="${sel}"]`) as HTMLElement | null;
  if (!b || !row) return;
  const win = doc.defaultView!;
  const abs = (r: DOMRect) => ({ top: r.top + win.scrollY, left: r.left + win.scrollX, right: r.right + win.scrollX, bottom: r.bottom + win.scrollY, width: r.width });
  const el = (tag: string, cls: string, html = '') => { const e = doc.createElement(tag); e.className = cls; e.setAttribute('data-mbx', ''); e.innerHTML = html; doc.body.appendChild(e); return e; };
  const rr = abs(row.getBoundingClientRect());
  const L = ladder(b);

  /* ---- taşıma tutamacı: bölümün solunda; yer varsa e-posta kartının dışında (içeriği kapatmaz) ---- */
  const grip = el('div', 'mbx-grip', '⠿');
  grip.title = 'Tutup sürükle: bölümü başka yere taşı';
  const card = (row.closest('table[width="600"]') as HTMLElement | null)?.getBoundingClientRect();
  const outside = card && card.left + win.scrollX >= 34;
  grip.style.top = rr.top + 4 + 'px';
  grip.style.left = (outside ? card!.left + win.scrollX - 32 : rr.left + 4) + 'px';
  void idx;
  /* ---- sürükleyip taşıma ---- */
  grip.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    grip.setPointerCapture(e.pointerId);
    doc.body.classList.add('mbx-dragging');
    const rows = [...doc.querySelectorAll('[data-b]')] as HTMLElement[];
    const line = el('div', 'mbx-line');
    let ins = idx;
    const place = (y: number) => {
      ins = rows.length;
      for (let k = 0; k < rows.length; k++) { const r = rows[k]!.getBoundingClientRect(); if (y < r.top + r.height / 2) { ins = k; break; } }
      const ref = ins < rows.length ? abs(rows[ins]!.getBoundingClientRect()).top : abs(rows[rows.length - 1]!.getBoundingClientRect()).bottom;
      const cr = abs(rows[0]!.getBoundingClientRect());
      line.style.top = ref - 2 + 'px'; line.style.left = cr.left + 'px'; line.style.width = cr.width + 'px';
    };
    place(e.clientY);
    const mv = (ev: PointerEvent) => {
      place(ev.clientY);
      // kenara yaklaşınca önizleme kendiliğinden kayar
      if (ev.clientY < 40) win.scrollBy(0, -14); else if (ev.clientY > win.innerHeight - 40) win.scrollBy(0, 14);
    };
    const up = () => {
      grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
      doc.body.classList.remove('mbx-dragging'); line.remove();
      const to = ins > idx ? ins - 1 : ins;
      if (to !== idx) api.move(sel, to);
    };
    grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
  });

  /* ---- boyut tutamacı ---- */
  if (L) {
    const target = (b.type === 'image' || b.type === 'imagetext' ? row.querySelector('img') ?? row.querySelector('td div') : b.type === 'button' ? row.querySelector('a') : b.type === 'divider' ? row.querySelector('div') : b.type === 'spacer' ? row : b.type === 'hero' ? row.querySelector('div') : row.querySelector('div')) as HTMLElement | null;
    if (target) {
      const tr = abs(target.getBoundingClientRect());
      const vertical = b.type === 'spacer';
      const h = el('div', 'mbx-h' + (vertical ? ' v' : ''));
      h.title = vertical ? 'Sürükle: yüksekliği değiştir' : 'Sürükle: büyüt / küçült';
      h.style.top = (vertical ? tr.bottom - 8 : tr.bottom - 8) + 'px';
      h.style.left = (vertical ? tr.left + tr.width / 2 - 8 : tr.right - 8) + 'px';
      h.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        h.setPointerCapture(e.pointerId);
        const start = { x: e.clientX, y: e.clientY };
        const i0 = L.steps.indexOf(cur(b, L));
        const badge = el('div', 'mbx-badge');
        let next = cur(b, L);
        // görsel ve ayraç: genişlik fareyle birebir; yazılar: her 40px bir basamak
        const tbl = (b.type === 'image' ? row.querySelector('table') : null) as HTMLElement | null;
        const baseW = tbl?.getBoundingClientRect().width ?? 0;
        const fullW = row.getBoundingClientRect().width - 64;
        const mv = (ev: PointerEvent) => {
          const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
          let k = i0;
          if (b.type === 'image' && fullW > 0) {
            const pct = Math.round(((baseW + dx) / fullW) * 100 / 5) * 5;
            k = L.steps.indexOf(Math.min(100, Math.max(20, pct)));
          } else if (b.type === 'spacer') k = i0 + Math.round(dy / 4);
          else if (b.type === 'divider') k = i0 + Math.round(dx / 12);
          else k = i0 + Math.round(dx / 40);
          k = Math.min(L.steps.length - 1, Math.max(0, k));
          next = L.steps[k]!;
          badge.textContent = L.label(next);
          badge.style.top = ev.clientY + win.scrollY + 14 + 'px'; badge.style.left = ev.clientX + win.scrollX + 14 + 'px';
          // anında önizleme (bırakınca gerçek çizim gelir)
          if (b.type === 'image' && tbl) tbl.style.width = `${next}%`;
          else if (b.type === 'spacer') (row.firstElementChild as HTMLElement | null)?.style.setProperty('height', `${next}px`);
          else if (b.type === 'divider') target.style.width = `${next}%`;
          else if (L.px && typeof next === 'string') target.style.fontSize = `${L.px[next]}px`;
        };
        const up = () => {
          h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
          badge.remove();
          if (next !== cur(b, L)) api.set(sel, { [L.key]: next });
        };
        h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
      });
    }
  }
}

/** Çift tıklama: yazıyı önizlemenin üstünde düzelt (biçimlendirme işaretli metinler sağdaki panelden düzenlenir) */
export function inlineEdit(doc: Document, target: HTMLElement, api: CanvasApi): boolean {
  const row = target.closest('[data-b]') as HTMLElement | null;
  const b = row ? api.blocks.find(x => x.id === row.dataset.b) : undefined;
  if (!row || !b) return false;
  const field = inlineField(b);
  if (!field) return false;
  const val = String((b as Record<string, unknown>)[field] ?? '');
  if (/\*|\[|\{/.test(val)) return false; // **kalın**, bağlantı ya da {ad} varsa panelden
  const ed = (b.type === 'button' ? row.querySelector('a') : row.querySelector('div')) as HTMLElement | null;
  if (!ed) return false;
  ed.contentEditable = 'true';
  ed.focus();
  const range = doc.createRange(); range.selectNodeContents(ed);
  const s = doc.getSelection(); s?.removeAllRanges(); s?.addRange(range);
  const done = (save: boolean) => {
    ed.removeEventListener('blur', onBlur); ed.removeEventListener('keydown', onKey);
    ed.contentEditable = 'false';
    const text = ed.innerText.replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (save && text && text !== val) api.set(b.id, { [field]: b.type === 'text' ? text : text.replace(/\n/g, ' ') });
    else if (!save) ed.textContent = val;
  };
  const onBlur = () => done(true);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); done(false); ed.blur(); }
    else if (e.key === 'Enter' && b.type !== 'text') { e.preventDefault(); ed.blur(); }
  };
  ed.addEventListener('blur', onBlur); ed.addEventListener('keydown', onKey);
  return true;
}
