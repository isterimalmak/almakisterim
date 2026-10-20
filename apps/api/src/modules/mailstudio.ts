import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { FastifyBaseLogger, FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool } from '../db.js';
import { requireAdmin, type Deps } from '../context.js';
import type { MediaStorage } from '../services/storage.js';
import type { Mailer } from '../services/notify.js';
import { HttpError, safeEqual } from '../lib/util.js';

/* =========================================================
   E-posta Stüdyosu
   (Marka Bahçem'deki E-posta Stüdyosu'ndan alındı; almakisterim'e uyarlandı.)
   - Şablon: yönetimin bloklarla (başlık, metin, düğme, görsel, talep, kod…) tasarladığı e-posta.
   - Görev: şablonun kime ve ne zaman gideceği. Olaya bağlı (üye olunca, talep yayına girince, süresi dolunca),
     üye olup talep vermeyince ya da belirli bir tarihte bir kitleye.
   - Kuyruk: her gönderim bir satır; zamanlanmış saatlik iş (/api/jobs/expire, ayrıca /api/jobs/mail) vakti gelenleri yollar.
   - Kampanya (pazarlama) e-postası yalnızca izin verene gider, abonelikten çıkma bağlantısı taşır,
     aynı kişiye günde en fazla bir kampanya e-postası gider; gece 21:00–09:00 arası bekletilir.
   ========================================================= */

const id8 = () => Math.random().toString(36).slice(2, 10);
const align = z.enum(['left', 'center', 'right']).default('left');
const url = z.string().trim().max(500).refine(v => !v || v.startsWith('/') || /^https?:\/\//i.test(v), 'Bağlantı / ya da https:// ile başlamalı');
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const fontT = z.enum(['serif', 'sans']);
/** her bölümde: arka plan rengi (boşsa kartın rengi) ve üstteki boşluk */
const sec = (pt: number) => ({ bg: color.or(z.literal('')).default(''), pt: z.number().int().min(0).max(64).default(pt) });
const cardItem = z.object({ image: url.default(''), title: z.string().max(80).default(''), text: z.string().max(300).default(''), link: url.default('') });
export const BlockSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string().max(20), type: z.literal('hero'), title: z.string().max(120), text: z.string().max(400).default(''), image: url.default(''), bg: color.default('#13235B'), fg: color.default('#ffffff'),
    align: align.default('center'), size: z.enum(['md', 'lg', 'xl']).default('lg'), pad: z.enum(['sm', 'md', 'lg']).default('md'), btnText: z.string().max(60).default(''), btnUrl: url.default('') }),
  z.object({ id: z.string().max(20), type: z.literal('heading'), text: z.string().max(160), size: z.enum(['xl', 'lg', 'md', 'sm']).default('lg'), align,
    font: fontT.default('sans'), color: color.default('#13235B'), bold: z.boolean().default(true), italic: z.boolean().default(false), upper: z.boolean().default(false), ...sec(24) }),
  z.object({ id: z.string().max(20), type: z.literal('text'), text: z.string().max(3000), align,
    font: fontT.default('sans'), size: z.enum(['sm', 'md', 'lg']).default('md'), color: color.default('#3A414B'), ...sec(14) }),
  z.object({ id: z.string().max(20), type: z.literal('button'), text: z.string().max(60), url, align: align.default('center'),
    color: color.or(z.literal('')).default(''), fg: color.default('#ffffff'), size: z.enum(['sm', 'md', 'lg']).default('md'), shape: z.enum(['pill', 'rounded', 'square']).default('pill'),
    style: z.enum(['solid', 'outline']).default('solid'), full: z.boolean().default(false), ...sec(24) }),
  z.object({ id: z.string().max(20), type: z.literal('image'), url, alt: z.string().max(140).default(''), link: url.default(''),
    width: z.number().int().min(20).max(100).default(100), align: align.default('center'), radius: z.enum(['none', 'sm', 'lg']).default('lg'),
    caption: z.string().max(200).default(''), edge: z.boolean().default(false), ...sec(20) }),
  z.object({ id: z.string().max(20), type: z.literal('imagetext'), image: url.default(''), alt: z.string().max(140).default(''), link: url.default(''),
    side: z.enum(['left', 'right']).default('left'), ratio: z.union([z.literal(33), z.literal(40), z.literal(50)]).default(40), valign: z.enum(['top', 'middle']).default('middle'),
    title: z.string().max(120).default(''), text: z.string().max(1200).default(''), btnText: z.string().max(60).default(''), btnUrl: url.default(''), ...sec(24) }),
  z.object({ id: z.string().max(20), type: z.literal('cards'), cols: z.union([z.literal(2), z.literal(3)]).default(2), items: z.array(cardItem).min(1).max(6).default([]), ...sec(20) }),
  // talepler: seçilen yayındaki talepler kart olarak (kapak fotoğrafı, başlık, bütçe, il)
  z.object({ id: z.string().max(20), type: z.literal('requests'), title: z.string().max(100).default(''), ids: z.array(z.number().int().positive()).max(6), cols: z.union([z.literal(2), z.literal(3)]).default(2), ...sec(16) }),
  z.object({ id: z.string().max(20), type: z.literal('coupon'), code: z.string().max(30), note: z.string().max(160).default(''), ...sec(24) }),
  z.object({ id: z.string().max(20), type: z.literal('divider'), color: color.default('#DADDE2'), thick: z.number().int().min(1).max(4).default(1), width: z.number().int().min(10).max(100).default(100), ...sec(24) }),
  z.object({ id: z.string().max(20), type: z.literal('spacer'), h: z.number().int().min(8).max(80).default(24) }),
  z.object({ id: z.string().max(20), type: z.literal('social'), instagram: url.default(''), tiktok: url.default(''), youtube: url.default(''), ...sec(24) })
]);
export type Block = z.infer<typeof BlockSchema>;
// zod 4: .prefault({}) iç varsayılanları da uygular
const ThemeSchema = z.object({ accent: color.default('#F26B1D'), bg: color.default('#F1F2F4'), card: color.default('#FFFFFF'), headFont: fontT.default('sans'), logo: z.boolean().default(true) }).prefault({});
type Theme = z.infer<typeof ThemeSchema>;
const TemplateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  subject: z.string().max(150).default(''),
  preheader: z.string().max(150).default(''),
  kind: z.enum(['info', 'marketing']).default('info'),
  blocks: z.array(BlockSchema).max(40).default([]),
  theme: ThemeSchema
});
type Tpl = z.infer<typeof TemplateSchema>;

export const TRIGGERS = ['signup', 'request_published', 'request_expired', 'no_request', 'once'] as const;
type Trigger = typeof TRIGGERS[number];
const AUDIENCES = ['all', 'buyers', 'sellers', 'corporate'] as const;

/* ---------------- çizim ---------------- */
type Req = { title: string; budget: string; city: string; image: string | null; url: string };
type Ctx = { origin: string; vars: Record<string, string>; requests: Map<number, Req>; link?: (u: string) => string; pixel?: string; unsub?: string; kind: 'info' | 'marketing'; mark?: boolean };

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** {ad}, {adsoyad}, {eposta}, {site} ve (talep olaylarında) {talep}, {talepno} değişkenlerini kişinin bilgisiyle doldurur */
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(ad|adsoyad|eposta|site|talep|talepno)\}/g, (_, k: string) => v[k] ?? '');
/** metin: kaçışlı, **kalın**, satır sonu */
const rich = (s: string, v: Record<string, string>) => esc(fill(s, v)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
const abs = (u: string, origin: string) => !u ? '' : u.startsWith('/') ? origin + u : /^https?:\/\//i.test(u) ? u : '';

/** E-posta başlığındaki logo: yazı olarak "almakisterim.com" (lacivert, ".com" turuncu); görsel dosyası gerekmez, görseller kapalıyken de görünür. */
const MAIL_LOGO_HTML = `<span style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:26px;font-weight:800;letter-spacing:-.5px;color:#13235B">almakisterim<span style="color:#F26B1D;font-weight:700">.com</span></span>`;

export function renderMail(t: Tpl, c: Ctx) {
  const th = { ...ThemeSchema.parse({}), ...t.theme } as Theme;
  const href = (u: string) => { const a = abs(fill(u, c.vars), c.origin); return a ? esc(c.link ? c.link(a) : a) : '#'; };
  const font = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const serif = "font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif";
  const fam = (f: 'serif' | 'sans') => f === 'serif' ? serif : font;
  const headFam = fam(th.headFont);
  // metin: kaçışlı, **kalın**, *italik*, [yazı](bağlantı), satır sonu
  const richL = (str: string) => rich(str, c.vars)
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t: string, u: string) => `<a href="${href(u.replace(/&amp;/g, '&'))}" style="color:${th.accent};text-decoration:underline">${t}</a>`);
  const plain = (str: string) => fill(str, c.vars).replace(/\*\*?/g, '').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)');
  /** bölüm satırı: isteğe bağlı arka plan rengi ve üst boşluk; arka planlı bölümün altına da aynı boşluk */
  const row = (bl: { bg?: string; pt?: number }, inner: string, opts: { edge?: boolean; align?: string } = {}) => {
    const pt = bl.pt ?? 20; const bg = bl.bg || '';
    const side = opts.edge ? '0' : '32px';
    return `<tr><td class="${opts.edge ? '' : 'mb-pad'}" style="${bg ? `background:${bg};` : ''}padding:${pt}px ${side} ${bg ? Math.max(pt, 16) : 0}px;${opts.align ? `text-align:${opts.align};` : ''}">${inner}</td></tr>`;
  };
  const btnHtml = (text: string, u: string, o: { bg?: string; fg?: string; size?: 'sm' | 'md' | 'lg'; shape?: 'pill' | 'rounded' | 'square'; style?: 'solid' | 'outline'; full?: boolean } = {}) => {
    const bg = o.bg || th.accent; const sz = { sm: [10, 20, 14], md: [14, 28, 16], lg: [18, 36, 18] }[o.size ?? 'md'];
    const rad = { pill: '999px', rounded: '10px', square: '0' }[o.shape ?? 'pill'];
    const solid = (o.style ?? 'solid') === 'solid';
    return `<a href="${href(u)}" style="display:${o.full ? 'block' : 'inline-block'};${o.full ? 'text-align:center;' : ''}background:${solid ? bg : 'transparent'};color:${solid ? (o.fg || '#ffffff') : bg};border:2px solid ${bg};${font};font-size:${sz[2]}px;font-weight:700;text-decoration:none;padding:${sz[0]}px ${sz[1]}px;border-radius:${rad}">${esc(fill(text, c.vars))}</a>`;
  };
  const imgTag = (u: string, alt: string, w: number, radius = '12px', link = '') => {
    const t = `<img src="${esc(abs(u, c.origin))}" alt="${esc(alt)}" width="${w}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;border-radius:${radius}">`;
    return link ? `<a href="${href(link)}">${t}</a>` : t;
  };
  const rows: string[] = [];
  const text: string[] = [];
  for (const b of t.blocks) {
    const n0 = rows.length;
    switch (b.type) {
      case 'hero': {
        const pad = { sm: 36, md: 56, lg: 84 }[b.pad]; const ts = { md: 26, lg: 34, xl: 44 }[b.size];
        rows.push(`<tr><td style="background:${b.bg};${b.image ? `background-image:url('${esc(abs(b.image, c.origin))}');background-size:cover;background-position:center;` : ''}padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="mb-pad" style="padding:${pad}px 32px;${b.image ? 'background:rgba(0,0,0,.35);' : ''}text-align:${b.align}"><div style="${headFam};font-size:${ts}px;line-height:1.15;font-weight:600;color:${b.fg}">${richL(b.title)}</div>${b.text ? `<div style="${font};font-size:16px;line-height:1.6;color:${b.fg};opacity:.9;margin-top:14px">${richL(b.text)}</div>` : ''}${b.btnText ? `<div style="margin-top:22px">${btnHtml(b.btnText, b.btnUrl || '/', { bg: b.fg, fg: b.bg })}</div>` : ''}</td></tr></table></td></tr>`);
        text.push(plain(b.title), plain(b.text), b.btnText ? `${fill(b.btnText, c.vars)}: ${abs(fill(b.btnUrl || '/', c.vars), c.origin)}` : '');
        break;
      }
      case 'heading': {
        const sz = { xl: 38, lg: 30, md: 22, sm: 18 }[b.size];
        rows.push(row(b, `<div style="${fam(b.font)};font-size:${sz}px;line-height:1.2;font-weight:${b.bold ? 700 : 400};${b.italic ? 'font-style:italic;' : ''}${b.upper ? 'text-transform:uppercase;letter-spacing:2px;' : ''}color:${b.color}">${richL(b.text)}</div>`, { align: b.align }));
        text.push(plain(b.text));
        break;
      }
      case 'text': {
        const sz = { sm: 14, md: 16, lg: 18 }[b.size];
        rows.push(row(b, `<div style="${fam(b.font)};font-size:${sz}px;line-height:1.65;color:${b.color}">${richL(b.text)}</div>`, { align: b.align }));
        text.push(plain(b.text));
        break;
      }
      case 'button':
        rows.push(row(b, btnHtml(b.text, b.url, { bg: b.color, fg: b.fg, size: b.size, shape: b.shape, style: b.style, full: b.full }), { align: b.align }));
        text.push(`${fill(b.text, c.vars)}: ${abs(fill(b.url, c.vars), c.origin)}`);
        break;
      case 'image': {
        if (!b.url) break;
        const full = b.edge ? 600 : 536; const w = Math.round(full * b.width / 100);
        const rad = b.edge ? '0' : { none: '0', sm: '6px', lg: '14px' }[b.radius];
        const cap = b.caption ? `<div style="${font};font-size:13px;line-height:1.5;color:#6A717C;margin-top:8px;text-align:${b.align}">${richL(b.caption)}</div>` : '';
        const margin = b.align === 'center' ? 'margin:0 auto' : b.align === 'right' ? 'margin-left:auto' : '';
        rows.push(row(b, `<table role="presentation" cellpadding="0" cellspacing="0" width="${w}" style="width:${b.width}%;max-width:${w}px;${margin}"><tr><td>${imgTag(b.url, b.alt, w, rad, b.link)}</td></tr></table>${cap}`, { edge: b.edge }));
        if (b.caption) text.push(plain(b.caption));
        break;
      }
      case 'imagetext': {
        const iw = Math.round(536 * b.ratio / 100); const tw = 536 - iw - 20;
        const img = `<td class="mb-col" width="${iw}" valign="${b.valign}" style="width:${iw}px">${b.image ? imgTag(b.image, b.alt, iw, '12px', b.link) : `<div style="height:${Math.round(iw * 0.8)}px;border-radius:12px;background:${th.bg}"></div>`}</td>`;
        const body = `<td class="mb-col" width="${tw}" valign="${b.valign}" style="width:${tw}px;${font}">${b.title ? `<div style="${headFam};font-size:22px;line-height:1.25;font-weight:600;color:#13235B">${richL(b.title)}</div>` : ''}${b.text ? `<div style="font-size:15px;line-height:1.6;color:#3A414B;margin-top:8px">${richL(b.text)}</div>` : ''}${b.btnText ? `<div style="margin-top:14px">${btnHtml(b.btnText, b.btnUrl || '/', { size: 'sm' })}</div>` : ''}</td>`;
        const gap = '<td class="mb-gap" width="20" style="width:20px;font-size:0">&nbsp;</td>';
        rows.push(row(b, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${b.side === 'left' ? img + gap + body : body + gap + img}</tr></table>`));
        text.push(plain(b.title), plain(b.text), b.btnText ? `${fill(b.btnText, c.vars)}: ${abs(fill(b.btnUrl || '/', c.vars), c.origin)}` : '');
        break;
      }
      case 'cards': {
        const its = b.items.filter(i => i.image || i.title || i.text); if (!its.length) break;
        const cw = Math.floor((536 - (b.cols - 1) * 16) / b.cols);
        const cell = (i: typeof its[number]) => `<td class="mb-col" width="${cw}" valign="top" style="width:${cw}px;${font}">${i.image ? imgTag(i.image, i.title, cw, '10px', i.link) : ''}${i.title ? `<div style="${headFam};font-size:17px;line-height:1.3;font-weight:600;color:#13235B;margin-top:10px">${i.link ? `<a href="${href(i.link)}" style="color:#13235B;text-decoration:none">${richL(i.title)}</a>` : richL(i.title)}</div>` : ''}${i.text ? `<div style="font-size:14px;line-height:1.55;color:#5A616B;margin-top:4px">${richL(i.text)}</div>` : ''}</td>`;
        const trs: string[] = [];
        for (let k = 0; k < its.length; k += b.cols) {
          const part = its.slice(k, k + b.cols).map(cell);
          while (part.length < b.cols) part.push(`<td class="mb-col" width="${cw}"></td>`);
          trs.push(`<tr>${part.join('<td class="mb-gap" width="16" style="width:16px;font-size:0">&nbsp;</td>')}</tr>${k + b.cols < its.length ? '<tr><td style="height:18px;font-size:0">&nbsp;</td></tr>' : ''}`);
        }
        rows.push(row(b, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${trs.join('')}</table>`));
        its.forEach(i => text.push([plain(i.title), plain(i.text), i.link ? abs(fill(i.link, c.vars), c.origin) : ''].filter(Boolean).join(' — ')));
        break;
      }
      case 'requests': {
        const ps = b.ids.map(i => c.requests.get(i)).filter((x): x is Req => !!x);
        if (!ps.length) break;
        const n = b.cols; const w = n === 3 ? '33%' : '50%';
        const cells: string[] = [];
        for (let i = 0; i < ps.length; i += n) {
          const part = ps.slice(i, i + n).map(p => `<td class="mb-col" width="${w}" valign="top" style="padding:8px"><a href="${href(p.url)}" style="text-decoration:none;color:#13235B;${font}">${p.image ? `<img src="${esc(abs(p.image, c.origin))}" alt="" width="${n === 3 ? 160 : 250}" style="display:block;width:100%;height:auto;border-radius:10px;border:0">` : `<div style="height:160px;border-radius:10px;background:${th.bg}"></div>`}<div style="font-size:12px;color:#6A717C;margin-top:8px">${esc(p.city)}</div><div style="font-size:14px;line-height:1.35;margin-top:2px;font-weight:600">${esc(p.title)}</div><div style="font-size:15px;font-weight:800;margin-top:4px;color:${th.accent}">${esc(p.budget)}</div></a></td>`);
          while (part.length < n) part.push(`<td class="mb-col" width="${w}"></td>`);
          cells.push(`<tr>${part.join('')}</tr>`);
        }
        rows.push(`<tr><td style="${b.bg ? `background:${b.bg};` : ''}padding:${b.pt}px 24px ${b.bg ? 16 : 0}px">${b.title ? `<div style="${font};font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${th.accent};font-weight:700;padding:0 8px 4px">${esc(fill(b.title, c.vars))}</div>` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cells.join('')}</table></td></tr>`);
        ps.forEach(p => text.push(`${p.title} — ${p.budget} · ${p.city}: ${abs(p.url, c.origin)}`));
        break;
      }
      case 'coupon':
        rows.push(row(b, `<div style="border:2px dashed ${th.accent};border-radius:14px;padding:18px;${font}"><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#6A717C">Kod</div><div style="font-size:28px;font-weight:800;letter-spacing:3px;color:${th.accent};margin-top:4px">${esc(b.code)}</div>${b.note ? `<div style="font-size:14px;color:#5A616B;margin-top:6px">${richL(b.note)}</div>` : ''}</div>`, { align: 'center' }));
        text.push(`Kod: ${b.code} ${plain(b.note)}`);
        break;
      case 'divider':
        rows.push(row(b, `<div style="width:${b.width}%;margin:0 auto;border-top:${b.thick}px solid ${b.color};font-size:0;line-height:0">&nbsp;</div>`));
        break;
      case 'spacer':
        rows.push(`<tr><td style="height:${b.h}px;font-size:0;line-height:0">&nbsp;</td></tr>`);
        break;
      case 'social': {
        const ls = ([['Instagram', b.instagram], ['TikTok', b.tiktok], ['YouTube', b.youtube]] as const).filter(([, u]) => u);
        if (ls.length) rows.push(row(b, `<div style="${font};font-size:14px">${ls.map(([n, u]) => `<a href="${href(u)}" style="color:${th.accent};font-weight:700;text-decoration:none;margin:0 10px">${n}</a>`).join('·')}</div>`, { align: 'center' }));
        break;
      }
    }
    // düzenleyici önizlemesi: bloğa dokununca seçilsin diye satır işaretlenir (gönderilen e-postada yok)
    if (c.mark) for (let i = n0; i < rows.length; i++) rows[i] = rows[i]!.replace('<tr', `<tr data-b="${esc(b.id)}"`);
  }
  const foot = c.kind === 'marketing'
    ? `Bu e-postayı kampanya e-postalarına izin verdiğiniz için aldınız.${c.unsub ? ` <a href="${esc(c.unsub)}" style="color:#6A717C">Abonelikten çık</a>` : ''}`
    : 'Bu e-posta almakisterim hesabınızla ilgili bilgilendirme amacıyla gönderildi.';
  const pre = fill(t.preheader, c.vars);
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><style>@media only screen and (max-width:540px){.mb-col{display:block!important;width:100%!important;max-width:100%!important;padding-bottom:14px!important}.mb-gap{display:none!important}.mb-pad{padding-left:20px!important;padding-right:20px!important}}</style><title>${esc(fill(t.subject, c.vars))}</title></head>
<body style="margin:0;padding:0;background:${th.bg}">${pre ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(pre)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${th.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${th.card};border-radius:18px;overflow:hidden">
${th.logo ? `<tr><td style="padding:24px 32px 20px;text-align:center;border-bottom:1px solid #E9EBEE"><a href="${esc(c.link ? c.link(c.origin + '/') : c.origin + '/')}" style="text-decoration:none">${MAIL_LOGO_HTML}</a></td></tr>` : ''}
${rows.join('\n')}
<tr><td style="padding:32px 32px 28px;${font};font-size:12px;line-height:1.6;color:#6A717C;text-align:center">${foot}<br>almakisterim.com · <a href="${esc(c.origin)}" style="color:#6A717C">${esc(c.origin.replace(/^https?:\/\//, ''))}</a></td></tr>
</table></td></tr></table>${c.pixel ? `<img src="${esc(c.pixel)}" width="1" height="1" alt="" style="display:block;border:0">` : ''}</body></html>`;
  return {
    subject: fill(t.subject, c.vars),
    html,
    text: [...text.filter(Boolean), '', c.kind === 'marketing' && c.unsub ? `Abonelikten çık: ${c.unsub}` : ''].join('\n\n').trim()
  };
}

/** "requests" bloklarındaki talepler: yalnızca yayındaki (aktif, süresi dolmamış) talepler; kapak fotoğrafı talepler listesindeki gibi */
async function loadRequests(pool: Pool, storage: MediaStorage, blocks: Block[]) {
  const ids = [...new Set(blocks.flatMap(b => b.type === 'requests' ? b.ids : []))];
  const m = new Map<number, Req>();
  if (!ids.length) return m;
  const { rows } = await pool.query<{ id: number; title: string; budget_min: number; budget_max: number; city: string; district: string; cover_key: string | null }>(
    `SELECT r.id, r.title, r.budget_min, r.budget_max, r.city, r.district,
            (SELECT md.storage_key FROM media md WHERE md.request_id = r.id AND md.kind = 'image' ORDER BY md.position LIMIT 1) AS cover_key
       FROM requests r WHERE r.id = ANY($1::bigint[]) AND r.status = 'active' AND r.expires_at > now()`, [ids]);
  const tl = (n: number) => n.toLocaleString('tr-TR');
  for (const r of rows) m.set(r.id, { title: r.title, budget: r.budget_min && r.budget_min !== r.budget_max ? `${tl(r.budget_min)} – ${tl(r.budget_max)} TL` : `${tl(r.budget_max)} TL`, city: [r.city, r.district].filter(Boolean).join(' / '), image: r.cover_key ? storage.publicUrl(r.cover_key) : null, url: `/talep/${r.id}` });
  return m;
}
const varsOf = (u: { name: string; email: string | null }, origin: string, req?: { id: number | null; title: string | null }) => ({ ad: u.name.trim().split(/\s+/)[0] ?? '', adsoyad: u.name, eposta: u.email ?? '', site: origin.replace(/^https?:\/\//, ''), talep: req?.title ?? '', talepno: req?.id ? String(req.id) : '' });

/* ---------------- zaman ---------------- */
/** Sessiz saatler (İstanbul 21:00–09:00) içine düşen gönderim sabah 09:00'a kayar. İstanbul UTC+3 (yaz saati yok). */
export function quietShift(d: Date) {
  const local = new Date(d.getTime() + 3 * 3600e3);
  const h = local.getUTCHours();
  if (h >= 9 && h < 21) return d;
  const t = new Date(local); if (h >= 21) t.setUTCDate(t.getUTCDate() + 1);
  t.setUTCHours(9, 0, 0, 0);
  return new Date(t.getTime() - 3 * 3600e3);
}
const token = () => randomBytes(18).toString('base64url');

/** Olay olunca (üye oldu, talep yayına girdi, talebin süresi doldu) o olaya bağlı etkin görevler için gönderim sıraya girer */
export async function mailEvent(pool: Pool, trigger: Exclude<Trigger, 'no_request' | 'once'>, userId: string, requestId: number | null = null) {
  try {
    const rules = (await pool.query<{ id: number; template_id: number; delay_min: number; quiet_hours: boolean }>(
      "SELECT id, template_id, delay_min, quiet_hours FROM mail_rules WHERE trigger = $1 AND active = true", [trigger])).rows;
    if (!rules.length) return;
    const u = (await pool.query<{ email: string | null }>('SELECT email FROM users WHERE id = $1', [userId])).rows[0];
    if (!u?.email) return; // e-postası olmayan (telefonla üye) hesaba e-posta gitmez
    for (const r of rules) {
      let due = new Date(Date.now() + r.delay_min * 60e3);
      if (r.quiet_hours) due = quietShift(due);
      await pool.query(`INSERT INTO mail_sends (rule_id, template_id, user_id, request_id, email, token, due_at) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT DO NOTHING`, [r.id, r.template_id, userId, requestId, u.email, token(), due]);
    }
  } catch { /* e-posta kuyruğu asıl işlemi hiçbir zaman bozmaz */ }
}

/** Bir kitlenin kullanıcıları (kampanya şablonu yalnızca izin verenlere) */
function audienceQuery(audience: typeof AUDIENCES[number], marketing: boolean) {
  const w = ['u.email IS NOT NULL'];
  if (marketing) w.push('u.marketing_at IS NOT NULL');
  // alıcılar: en az bir talebi olan; satıcılar: numara açmış ya da talep alarmı kurmuş; kurumsal hesaplar
  if (audience === 'buyers') w.push('EXISTS (SELECT 1 FROM requests rq WHERE rq.buyer_id = u.id)');
  if (audience === 'sellers') w.push('(EXISTS (SELECT 1 FROM contact_unlocks cu WHERE cu.seller_id = u.id) OR EXISTS (SELECT 1 FROM alarms al WHERE al.user_id = u.id))');
  if (audience === 'corporate') w.push('u.is_corporate');
  return `SELECT u.id, u.email FROM users u WHERE ${w.join(' AND ')}`;
}

/* ---------------- gönderim işi ---------------- */
const sign = (secret: string, tok: string, u: string) => createHmac('sha256', secret).update('mail-link\n' + tok + '\n' + u).digest('base64url').slice(0, 22);

/** E-posta servisine verir; kabul etmezse (anahtar yok, servis hata verdi) false döner, asla hata fırlatmaz */
async function sendMail(mailer: Mailer, m: { to: string; subject: string; text: string; html: string; headers?: Record<string, string> }, log?: FastifyBaseLogger) {
  try { await mailer.send(m.to, m.subject, m.text, { html: m.html, headers: m.headers }); return true; }
  catch (e) { log?.warn({ err: (e as Error).message }, 'e-posta gönderilemedi'); return false; }
}

export async function mailTick(deps: Pick<Deps, 'pool' | 'config' | 'mailer' | 'storage'>, log?: FastifyBaseLogger) {
  const { pool, config } = deps;
  const origin = config.APP_URL.replace(/\/$/, '');
  const now = new Date();
  // 1) tarihi gelen tek seferlik kampanyalar kitleye açılır
  const once = (await pool.query<{ id: number; template_id: number; audience: typeof AUDIENCES[number]; quiet_hours: boolean; kind: string }>(
    `SELECT r.id, r.template_id, r.audience, r.quiet_hours, t.kind FROM mail_rules r JOIN mail_templates t ON t.id = r.template_id
      WHERE r.trigger = 'once' AND r.active = true AND r.fired_at IS NULL AND r.send_at <= $1`, [now])).rows;
  for (const r of once) {
    const upd = await pool.query('UPDATE mail_rules SET fired_at = $2 WHERE id = $1 AND fired_at IS NULL', [r.id, now]);
    if (!upd.rowCount) continue; // başka bir çalıştırma aldı
    const due = r.quiet_hours ? quietShift(now) : now;
    await pool.query(`INSERT INTO mail_sends (rule_id, template_id, user_id, email, token, due_at)
      SELECT $1, $2, a.id, a.email, md5(random()::text || clock_timestamp()::text || a.id::text), $3
      FROM (${audienceQuery(r.audience, r.kind === 'marketing')}) a
      ON CONFLICT DO NOTHING`, [r.id, r.template_id, due]);
  }
  // 2) üye olup talep vermeyenler: üyelikten bu yana görevdeki süre geçti (en az 1 saat), son 14 gün içinde süresi dolan ve hiç talep vermemiş
  const idles = (await pool.query<{ id: number; template_id: number; delay_min: number; quiet_hours: boolean }>(
    "SELECT id, template_id, delay_min, quiet_hours FROM mail_rules WHERE trigger = 'no_request' AND active = true")).rows;
  for (const r of idles) {
    const idle = Math.max(60, r.delay_min);
    const us = await pool.query<{ id: string; email: string }>(`SELECT u.id, u.email FROM users u
      WHERE u.created_at < now() - make_interval(mins => $1) AND u.created_at > now() - make_interval(mins => $1) - interval '14 days' AND u.email IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM requests rq WHERE rq.buyer_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM mail_sends s WHERE s.rule_id = $2 AND s.user_id = u.id)
      LIMIT 500`, [idle, r.id]);
    const due = r.quiet_hours ? quietShift(now) : now;
    for (const u of us.rows) await pool.query('INSERT INTO mail_sends (rule_id, template_id, user_id, email, token, due_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', [r.id, r.template_id, u.id, u.email, token(), due]);
  }
  // 3) vakti gelenler gönderilir
  const due = (await pool.query<{ id: number; token: string; email: string; user_id: string | null; rule_id: number | null; request_id: number | null; rtitle: string | null; tname: string; subject: string; preheader: string; kind: string; blocks: unknown; theme: unknown; subject_b: string | null; ractive: boolean | null; uname: string | null; marketing_at: Date | null }>(
    `SELECT s.id, s.token, s.email, s.user_id, s.rule_id, s.request_id, rq.title AS rtitle, t.name AS tname, t.subject, t.preheader, t.kind, t.blocks, t.theme,
            r.subject_b, r.active AS ractive, u.name AS uname, u.marketing_at
       FROM mail_sends s JOIN mail_templates t ON t.id = s.template_id LEFT JOIN mail_rules r ON r.id = s.rule_id
       LEFT JOIN users u ON u.id = s.user_id LEFT JOIN requests rq ON rq.id = s.request_id
      WHERE s.status = 'queued' AND s.due_at <= $1 ORDER BY s.due_at LIMIT 200`, [now])).rows;
  let sent = 0, skipped = 0, failed = 0, later = 0;
  const reqCache = new Map<string, Map<number, Req>>();
  for (const s of due) {
    // aynı anda iki çalıştırma aynı satırı göndermesin: satır 10 dakikalığına "alınır" (yarıda kalırsa sonra yeniden denenir)
    const claim = await pool.query("UPDATE mail_sends SET due_at = now() + interval '10 minutes' WHERE id = $1 AND status = 'queued' AND due_at <= $2", [s.id, now]);
    if (!claim.rowCount) continue;
    const skip = async (note: string) => { skipped++; await pool.query("UPDATE mail_sends SET status = 'skipped', note = $2 WHERE id = $1", [s.id, note]); };
    if (s.rule_id && s.ractive === false) { await skip('Görev durduruldu'); continue; }
    if (s.user_id && s.uname === null) { await skip('Hesap silinmiş'); continue; }
    if (s.kind === 'marketing' && !s.marketing_at) { await skip('Kampanya izni yok'); continue; }
    if (s.kind === 'marketing' && s.user_id) {
      // yorgunluk koruması: aynı kişiye 20 saat içinde ikinci kampanya e-postası gitmez, ertesi güne kayar
      const recent = await pool.query(`SELECT 1 FROM mail_sends x JOIN mail_templates y ON y.id = x.template_id
        WHERE x.user_id = $1 AND x.status = 'sent' AND y.kind = 'marketing' AND x.sent_at > $2 LIMIT 1`, [s.user_id, new Date(Date.now() - 20 * 3600e3)]);
      if (recent.rowCount) { later++; await pool.query('UPDATE mail_sends SET due_at = $2 WHERE id = $1', [s.id, quietShift(new Date(Date.now() + 20 * 3600e3))]); continue; }
    }
    const tpl = TemplateSchema.parse({ name: s.tname, subject: s.subject, preheader: s.preheader, kind: s.kind, blocks: s.blocks, theme: s.theme });
    const variant: 'A' | 'B' = s.subject_b && s.id % 2 === 1 ? 'B' : 'A';
    if (variant === 'B') tpl.subject = s.subject_b!;
    const pk = JSON.stringify(tpl.blocks.filter(b => b.type === 'requests'));
    if (!reqCache.has(pk)) reqCache.set(pk, await loadRequests(pool, deps.storage, tpl.blocks));
    const unsub = `${origin}/api/m/u/${s.token}`;
    const r = renderMail(tpl, {
      origin, kind: tpl.kind, requests: reqCache.get(pk)!,
      vars: varsOf({ name: s.uname ?? '', email: s.email }, origin, { id: s.request_id, title: s.rtitle }),
      link: u => `${origin}/api/m/c/${s.token}?u=${encodeURIComponent(u)}&s=${sign(config.CODE_PEPPER, s.token, u)}`,
      pixel: `${origin}/api/m/o/${s.token}`,
      unsub
    });
    const ok = await sendMail(deps.mailer, { to: s.email, subject: r.subject || tpl.name, text: r.text, html: r.html, ...(tpl.kind === 'marketing' ? { headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}) }, log);
    if (ok) sent++; else failed++;
    if (ok) await pool.query("UPDATE mail_sends SET status = 'sent', sent_at = now(), subject = $2, variant = $3 WHERE id = $1", [s.id, r.subject, variant]);
    else await pool.query("UPDATE mail_sends SET status = 'failed', note = 'E-posta servisi kabul etmedi', subject = $2, variant = $3 WHERE id = $1", [s.id, r.subject, variant]);
  }
  return { opened: once.length, idle: idles.length, sent, skipped, failed, later };
}

/* ---------------- hazır şablonlar ---------------- */
const B = (type: Block['type'], rest: Record<string, unknown>) => BlockSchema.parse({ id: id8(), type, ...rest });
export const STARTERS: { key: string; icon: string; desc: string; trigger: Trigger; tpl: () => Tpl }[] = [
  { key: 'welcome', icon: '🎉', desc: 'Yeni üyeye ilk merhaba', trigger: 'signup', tpl: () => TemplateSchema.parse({ name: 'Hoş geldiniz', subject: 'almakisterim\'e hoş geldiniz {ad}', preheader: 'Almak istediğinizi yazın, satıcılar size gelsin', kind: 'info', blocks: [
    B('hero', { title: 'Aramıza hoş geldiniz, {ad}!', text: 'almakisterim\'de almak istediğinizi yazarsınız, elinde o ürün olan satıcılar size ulaşır.' }),
    B('text', { text: '**Alıcı mısınız?** Ücretsiz talep verin; bütçenizi ve şehrinizi yazmanız yeterli.\n**Satıcı mısınız?** Size uygun talep gelince haber almak için [alarm kurun](/bana-ozel?s=alarm).' }),
    B('button', { text: 'Ücretsiz talep ver', url: '/talep-ver' }),
    B('spacer', { h: 16 })] }) },
  { key: 'published', icon: '✅', desc: 'Talebi yayına girene bilgi', trigger: 'request_published', tpl: () => TemplateSchema.parse({ name: 'Talebiniz yayında', subject: '{ad}, talebiniz yayında', preheader: 'Uygun satıcılar size ulaşacak', kind: 'info', blocks: [
    B('heading', { text: 'Talebiniz yayına çıktı!' }),
    B('text', { text: '**{talep}** talebiniz yayında. Uygun satıcılar size mesaj atacak ya da arayacak.\n\n**İpucu:** Fotoğraf eklemek ve bütçeyi açık yazmak daha çok satıcıya ulaşmanızı sağlar.' }),
    B('button', { text: 'Talebime git', url: '/talep/{talepno}' }),
    B('divider', {}),
    B('text', { text: 'Ödemeyi güvenle yapmak için [Güvenli Al](/guvenli-al) ile alışveriş edebilirsiniz.', align: 'center', size: 'sm' })] }) },
  { key: 'expired', icon: '⏰', desc: 'Süresi dolan talep için yeniden davet', trigger: 'request_expired', tpl: () => TemplateSchema.parse({ name: 'Talebinizin süresi doldu', subject: '{ad}, talebinizin süresi doldu', preheader: 'Hâlâ arıyorsanız bir dakikada yeniden verin', kind: 'info', blocks: [
    B('heading', { text: 'Talebinizin süresi doldu', align: 'center' }),
    B('text', { text: '**{talep}** talebinizin yayın süresi bitti. Aradığınızı hâlâ bulamadıysanız aynı talebi yeniden verebilirsiniz.', align: 'center' }),
    B('button', { text: 'Yeniden talep ver', url: '/talep-ver' })] }) },
  { key: 'norequest', icon: '💬', desc: 'Üye olup talep vermeyene nazik hatırlatma', trigger: 'no_request', tpl: () => TemplateSchema.parse({ name: 'İlk talebinizi verin', subject: '{ad}, almak istediğiniz bir şey var mı?', preheader: 'Talep vermek ücretsiz, bir dakika sürer', kind: 'marketing', blocks: [
    B('heading', { text: 'Aradığınızı satıcılar getirsin', align: 'center' }),
    B('text', { text: 'Almak istediğinizi tek cümleyle yazın; bütçenize ve şehrinize uygun satıcılar size ulaşsın. Talep vermek **ücretsiz**.', align: 'center' }),
    B('button', { text: 'Talep ver', url: '/talep-ver' })] }) },
  { key: 'seller', icon: '🔔', desc: 'Satıcılara alarm ve yeni talepler duyurusu', trigger: 'once', tpl: () => TemplateSchema.parse({ name: 'Satıcılara duyuru', subject: '{ad}, size uygun yeni talepler var', preheader: 'Alarm kurun, talep gelince ilk siz haber alın', kind: 'marketing', blocks: [
    B('hero', { title: 'Müşteri sizi arıyor', text: 'Alıcılar ne almak istediğini yazıyor; elinizdeki ürüne uyan talepleri kaçırmayın.', bg: '#13235B' }),
    B('text', { text: '**1.** Sattığınız ürün için talep alarmı kurun.\n**2.** Uygun talep gelince SMS ya da e-postayla haber alın.\n**3.** Alıcının numarasını açın, hemen ulaşın.' }),
    B('button', { text: 'Alarm kur', url: '/bana-ozel?s=alarm' })] }) },
  { key: 'campaign', icon: '📣', desc: 'Kampanya duyurusu (talepler ve kod)', trigger: 'once', tpl: () => TemplateSchema.parse({ name: 'Kampanya duyurusu', subject: 'Bu haftanın öne çıkan talepleri', preheader: 'Alıcılar bekliyor, siz de teklif verin', kind: 'marketing', blocks: [
    B('hero', { title: 'Haftanın talepleri', text: 'Alıcıların bu hafta en çok aradıkları.', bg: '#13235B' }),
    B('requests', { title: 'Öne çıkanlar', ids: [] }),
    B('coupon', { code: 'ALMAK10', note: 'Pazar gece yarısına kadar geçerli.' }),
    B('button', { text: 'Tüm talepleri gör', url: '/kategori' })] }) },
  { key: 'showcase', icon: '🪟', desc: 'Görsel + yazı ve kartlarla zengin bülten', trigger: 'once', tpl: () => TemplateSchema.parse({ name: 'Aylık bülten', subject: '{ad}, almakisterim\'de bu ay', preheader: 'Yeni kategoriler, öne çıkan talepler ve ipuçları', kind: 'marketing', blocks: [
    B('hero', { title: 'Bu ay almakisterim\'de', text: 'Alıcılar yazdı, satıcılar ulaştı. Öne çıkanları sizin için derledik.', bg: '#13235B', size: 'xl', btnText: 'Talepleri gör', btnUrl: '/kategori' }),
    B('heading', { text: 'Merhaba {ad},', size: 'md', font: 'sans', pt: 28 }),
    B('text', { text: 'Bu ay **en çok aranan** ürünleri ve satıcıların en çok ulaştığı talepleri seçtik. Almak istediğiniz bir şey varsa [ücretsiz talep verin](/talep-ver).' }),
    B('imagetext', { title: 'Güvenli Al', text: 'Ödemeniz ürün elinize ulaşana kadar güvende kalır. Satıcı kargolar, siz onaylarsınız.', btnText: 'Nasıl çalışır?', btnUrl: '/guvenli-al', side: 'left', ratio: 40 }),
    B('imagetext', { title: 'Satıcı mısınız?', text: 'Sattığınız ürün için alarm kurun; uygun talep gelince ilk siz haber alın.', btnText: 'Alarm kur', btnUrl: '/bana-ozel?s=alarm', side: 'right', ratio: 40 }),
    B('cards', { cols: 3, items: [{ image: '', title: 'Vasıta', text: 'Otomobil, motosiklet', link: '/kategori' }, { image: '', title: 'Emlak', text: 'Kiralık, satılık', link: '/kategori' }, { image: '', title: 'Elektronik', text: 'Telefon, bilgisayar', link: '/kategori' }] }),
    B('divider', { width: 40, color: '#DADDE2', pt: 28 }),
    B('button', { text: 'Siteye git', url: '/', size: 'lg' })] }) }
];

/* ---------------- uç noktalar ---------------- */
const idParam = (req: FastifyRequest) => z.coerce.number().int().positive().parse((req.params as { id: string }).id);
const RuleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  templateId: z.number().int().positive(),
  trigger: z.enum(TRIGGERS),
  audience: z.enum(AUDIENCES).default('all'),
  delayMin: z.number().int().min(0).max(129600).default(0),
  sendAt: z.iso.datetime({ offset: true }).nullable().default(null),
  quietHours: z.boolean().default(true),
  subjectB: z.string().trim().max(150).nullable().default(null),
  active: z.boolean().default(false)
});
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const page = (title: string, body: string) => `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · almakisterim.com</title></head><body style="margin:0;background:#F1F2F4;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#1F2328"><div style="max-width:440px;margin:12vh auto;background:#ffffff;border:1px solid #DADDE2;border-radius:12px;padding:32px;text-align:center"><div style="margin-bottom:16px">${MAIL_LOGO_HTML}</div>${body}</div></body></html>`;

type TplRow = { id: number; name: string; subject: string; preheader: string; kind: string; blocks: unknown; theme: unknown; updated_at: Date };
type RuleRow = { id: number; name: string; template_id: number; trigger: Trigger; audience: typeof AUDIENCES[number]; delay_min: number; send_at: Date | null; quiet_hours: boolean; subject_b: string | null; active: boolean; fired_at: Date | null };

export function mailStudioRoutes(app: FastifyInstance, deps: Deps) {
  const { pool, config } = deps;
  const origin = () => config.APP_URL.replace(/\/$/, '');

  const outTpl = (t: TplRow) =>
    ({ id: t.id, name: t.name, subject: t.subject, preheader: t.preheader, kind: t.kind, blocks: t.blocks, theme: t.theme, updatedAt: t.updated_at });
  const getTpl = async (id: number) => (await pool.query<TplRow>('SELECT * FROM mail_templates WHERE id = $1', [id])).rows[0];

  app.get('/admin/mail', async (req) => {
    requireAdmin(req);
    const templates = (await pool.query<TplRow>('SELECT * FROM mail_templates ORDER BY updated_at DESC')).rows;
    const rules = (await pool.query<RuleRow>('SELECT * FROM mail_rules ORDER BY created_at')).rows;
    const stats = (await pool.query<{ rule_id: number; variant: 'A' | 'B'; queued: number; sent: number; skipped: number; failed: number; opened: number; clicked: number }>(
      `SELECT rule_id, variant,
              count(*) FILTER (WHERE status = 'queued')::int AS queued, count(*) FILTER (WHERE status = 'sent')::int AS sent,
              count(*) FILTER (WHERE status = 'skipped')::int AS skipped, count(*) FILTER (WHERE status = 'failed')::int AS failed,
              count(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened, count(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked
         FROM mail_sends WHERE rule_id IS NOT NULL GROUP BY rule_id, variant`)).rows;
    const st = (rid: number) => {
      const rs = stats.filter(s => s.rule_id === rid);
      const sum = (k: 'queued' | 'sent' | 'skipped' | 'failed' | 'opened' | 'clicked', v?: 'A' | 'B') => rs.filter(s => !v || s.variant === v).reduce((a, s) => a + Number(s[k]), 0);
      return { queued: sum('queued'), sent: sum('sent'), skipped: sum('skipped'), failed: sum('failed'), opened: sum('opened'), clicked: sum('clicked'),
        ab: { A: { sent: sum('sent', 'A'), opened: sum('opened', 'A') }, B: { sent: sum('sent', 'B'), opened: sum('opened', 'B') } } };
    };
    const week = (await pool.query<{ sent: number; opened: number; clicked: number; queued: number }>(
      `SELECT count(*) FILTER (WHERE status = 'sent')::int AS sent, count(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened,
              count(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked, count(*) FILTER (WHERE status = 'queued')::int AS queued
         FROM mail_sends WHERE created_at > $1 AND status <> 'test'`, [new Date(Date.now() - 30 * 86400e3)])).rows[0];
    const optin = (await pool.query<{ all: number; optin: number }>('SELECT count(*)::int AS "all", count(*) FILTER (WHERE marketing_at IS NOT NULL)::int AS optin FROM users')).rows[0];
    return {
      ready: !!config.RESEND_API_KEY.trim(), from: config.MAIL_FROM,
      totals: { sent: Number(week?.sent ?? 0), opened: Number(week?.opened ?? 0), clicked: Number(week?.clicked ?? 0), queued: Number(week?.queued ?? 0), users: Number(optin?.all ?? 0), optin: Number(optin?.optin ?? 0) },
      templates: templates.map(t => ({ ...outTpl(t), uses: rules.filter(r => r.template_id === t.id).length })),
      rules: rules.map(r => ({ id: r.id, name: r.name, templateId: r.template_id, trigger: r.trigger, audience: r.audience, delayMin: r.delay_min, sendAt: r.send_at, quietHours: r.quiet_hours, subjectB: r.subject_b, active: r.active, firedAt: r.fired_at, stats: st(r.id) })),
      starters: STARTERS.map(s => ({ key: s.key, icon: s.icon, name: s.tpl().name, desc: s.desc, trigger: s.trigger }))
    };
  });

  app.get('/admin/mail/templates/:id', async (req) => {
    requireAdmin(req);
    const t = await getTpl(idParam(req));
    if (!t) throw new HttpError(404, 'bulunamadi', 'Şablon bulunamadı');
    return { template: outTpl(t) };
  });
  app.post('/admin/mail/templates', async (req, reply) => {
    requireAdmin(req);
    const b = z.object({ starter: z.string().max(30).optional(), copyOf: z.number().int().positive().optional(), name: z.string().trim().max(80).optional() }).parse(req.body ?? {});
    let tpl: Tpl;
    if (b.starter) { const s = STARTERS.find(x => x.key === b.starter); if (!s) throw new HttpError(400, 'hazir_sablon_yok', 'Hazır şablon bulunamadı'); tpl = s.tpl(); }
    else if (b.copyOf) {
      const t = await getTpl(b.copyOf);
      if (!t) throw new HttpError(404, 'bulunamadi', 'Şablon bulunamadı');
      tpl = TemplateSchema.parse({ ...t, name: (t.name + ' (kopya)').slice(0, 80) });
    } else tpl = TemplateSchema.parse({ name: b.name || 'Yeni e-posta', subject: '', blocks: [B('heading', { text: 'Merhaba {ad},' }), B('text', { text: 'Buraya mesajını yaz.' }), B('button', { text: 'Siteye git', url: '/' })] });
    const r = await pool.query<{ id: number }>('INSERT INTO mail_templates (name, subject, preheader, kind, blocks, theme) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [tpl.name, tpl.subject, tpl.preheader, tpl.kind, JSON.stringify(tpl.blocks), JSON.stringify(tpl.theme)]);
    reply.code(201); return { id: r.rows[0]!.id };
  });
  app.put('/admin/mail/templates/:id', async (req) => {
    requireAdmin(req);
    const t = TemplateSchema.parse(req.body);
    const r = (await pool.query<TplRow>(`UPDATE mail_templates SET name = $2, subject = $3, preheader = $4, kind = $5, blocks = $6, theme = $7, updated_at = now()
      WHERE id = $1 RETURNING *`, [idParam(req), t.name, t.subject, t.preheader, t.kind, JSON.stringify(t.blocks), JSON.stringify(t.theme)])).rows[0];
    if (!r) throw new HttpError(404, 'bulunamadi', 'Şablon bulunamadı');
    return { template: outTpl(r) };
  });
  app.delete('/admin/mail/templates/:id', async (req) => {
    requireAdmin(req);
    const r = await pool.query('DELETE FROM mail_templates WHERE id = $1', [idParam(req)]);
    if (!r.rowCount) throw new HttpError(404, 'bulunamadi', 'Şablon bulunamadı');
    return { ok: true };
  });
  // canlı önizleme: kaydedilmemiş şablonu yöneticinin kendi bilgileriyle çizer (gönderimle aynı çizici)
  app.post('/admin/mail/render', async (req) => {
    const u = requireAdmin(req);
    const t = TemplateSchema.parse(req.body);
    const r = renderMail(t, { origin: origin(), kind: t.kind, vars: varsOf(u, origin(), { id: 1048200, title: 'Örnek talep: 2. el iPhone 13' }), requests: await loadRequests(pool, deps.storage, t.blocks), unsub: t.kind === 'marketing' ? origin() + '/api/m/u/ornek' : undefined, mark: true });
    return { subject: r.subject, html: r.html };
  });
  app.post('/admin/mail/templates/:id/test', async (req) => {
    const u = requireAdmin(req);
    const b = z.object({ to: z.email().optional() }).parse(req.body ?? {});
    const t = await getTpl(idParam(req));
    if (!t) throw new HttpError(404, 'bulunamadi', 'Şablon bulunamadı');
    const tpl = TemplateSchema.parse(t);
    const to = b.to ?? u.email;
    if (!to) throw new HttpError(400, 'eposta_yok', 'Deneme için bir e-posta adresi gir');
    const r = renderMail(tpl, { origin: origin(), kind: tpl.kind, vars: varsOf(u, origin(), { id: 1048200, title: 'Örnek talep: 2. el iPhone 13' }), requests: await loadRequests(pool, deps.storage, tpl.blocks) });
    const ok = await sendMail(deps.mailer, { to, subject: '[Deneme] ' + (r.subject || tpl.name), text: r.text, html: r.html }, req.log);
    await pool.query(`INSERT INTO mail_sends (template_id, user_id, email, subject, status, token, sent_at, note) VALUES ($1,$2,$3,$4,'test',$5,now(),$6)`,
      [t.id, u.id, to, r.subject, token(), ok ? 'Deneme' : 'Deneme gönderilemedi']);
    if (!ok) throw new HttpError(502, 'eposta_gonderilemedi', 'E-posta servisi deneme e-postasını kabul etmedi');
    return { ok: true, to, ready: !!config.RESEND_API_KEY.trim() };
  });

  app.get('/admin/mail/audience', async (req) => {
    requireAdmin(req);
    const q = z.object({ audience: z.enum(AUDIENCES).default('all'), kind: z.enum(['info', 'marketing']).default('info') }).parse(req.query);
    const n = async (marketing: boolean) => (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM (${audienceQuery(q.audience, marketing)}) a`)).rows[0]!.n;
    return { count: await n(q.kind === 'marketing'), total: await n(false) };
  });
  const checkRule = async (b: z.infer<typeof RuleSchema>) => {
    if (b.trigger === 'once' && !b.sendAt) throw new HttpError(400, 'tarih_yok', 'Tek seferlik gönderim için tarih ve saat seç');
    if (!(await getTpl(b.templateId))) throw new HttpError(400, 'sablon_yok', 'Şablon bulunamadı');
  };
  const ruleVals = (b: z.infer<typeof RuleSchema>) => [b.name, b.templateId, b.trigger, b.audience, b.delayMin, b.trigger === 'once' ? b.sendAt : null, b.quietHours, b.subjectB || null, b.active];
  app.post('/admin/mail/rules', async (req, reply) => {
    requireAdmin(req);
    const b = RuleSchema.parse(req.body);
    await checkRule(b);
    const r = await pool.query<{ id: number }>(`INSERT INTO mail_rules (name, template_id, trigger, audience, delay_min, send_at, quiet_hours, subject_b, active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, ruleVals(b));
    reply.code(201); return { id: r.rows[0]!.id };
  });
  app.patch('/admin/mail/rules/:id', async (req) => {
    requireAdmin(req);
    const id = idParam(req);
    const cur = (await pool.query<RuleRow>('SELECT * FROM mail_rules WHERE id = $1', [id])).rows[0];
    if (!cur) throw new HttpError(404, 'bulunamadi', 'Görev bulunamadı');
    const p = RuleSchema.partial().parse(req.body);
    const b = RuleSchema.parse({ name: cur.name, templateId: cur.template_id, trigger: cur.trigger, audience: cur.audience, delayMin: cur.delay_min, sendAt: cur.send_at ? new Date(cur.send_at).toISOString() : null, quietHours: cur.quiet_hours, subjectB: cur.subject_b, active: cur.active, ...p });
    await checkRule(b);
    if (cur.fired_at && b.trigger === 'once' && (p.sendAt !== undefined || p.audience !== undefined || p.templateId !== undefined)) throw new HttpError(409, 'gonderildi', 'Bu kampanya gönderildi; değiştirmek yerine kopyasını oluştur');
    await pool.query(`UPDATE mail_rules SET name = $2, template_id = $3, trigger = $4, audience = $5, delay_min = $6, send_at = $7, quiet_hours = $8, subject_b = $9, active = $10 WHERE id = $1`,
      [id, ...ruleVals(b)]);
    return { ok: true };
  });
  app.delete('/admin/mail/rules/:id', async (req) => {
    requireAdmin(req);
    const r = await pool.query('DELETE FROM mail_rules WHERE id = $1', [idParam(req)]);
    if (!r.rowCount) throw new HttpError(404, 'bulunamadi', 'Görev bulunamadı');
    return { ok: true };
  });
  app.get('/admin/mail/sends', async (req) => {
    requireAdmin(req);
    const q = z.object({ rule: z.coerce.number().int().positive().optional(), status: z.enum(['queued', 'sent', 'failed', 'skipped', 'test']).optional() }).parse(req.query);
    const where: string[] = []; const params: unknown[] = [];
    if (q.rule) { params.push(q.rule); where.push(`s.rule_id = $${params.length}`); }
    if (q.status) { params.push(q.status); where.push(`s.status = $${params.length}`); }
    const { rows } = await pool.query(`SELECT s.id, s.email, s.status, s.note, s.subject, s.variant, s.due_at, s.sent_at, s.opened_at, s.clicked_at, t.name AS template, r.name AS rule, u.name AS "user"
       FROM mail_sends s JOIN mail_templates t ON t.id = s.template_id LEFT JOIN mail_rules r ON r.id = s.rule_id LEFT JOIN users u ON u.id = s.user_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.id DESC LIMIT 150`, params);
    return { sends: rows.map(r => ({ id: r.id, email: r.email, user: r.user, status: r.status, note: r.note, subject: r.subject, variant: r.variant, template: r.template, rule: r.rule, dueAt: r.due_at, sentAt: r.sent_at, openedAt: r.opened_at, clickedAt: r.clicked_at })) };
  });
  // sıradaki bir gönderimi iptal et
  app.delete('/admin/mail/sends/:id', async (req) => {
    requireAdmin(req);
    await pool.query("UPDATE mail_sends SET status = 'skipped', note = 'Yönetici iptal etti' WHERE id = $1 AND status = 'queued'", [idParam(req)]);
    return { ok: true };
  });

  /* ---- izleme ve abonelik (herkese açık, jetonla) ---- */
  const tok = (req: FastifyRequest) => z.string().regex(/^[A-Za-z0-9_+/=-]{8,64}$/).parse((req.params as { t: string }).t);
  app.get('/m/o/:t', async (req, reply) => {
    try { await pool.query('UPDATE mail_sends SET opened_at = now() WHERE token = $1 AND opened_at IS NULL', [tok(req)]); } catch { /* bozuk jeton */ }
    reply.header('content-type', 'image/gif').header('cache-control', 'no-store, max-age=0');
    return reply.send(GIF);
  });
  app.get('/m/c/:t', async (req, reply) => {
    const q = req.query as { u?: string; s?: string };
    const u = String(q.u ?? ''), s = String(q.s ?? '');
    let t = ''; try { t = tok(req); } catch { /* yok */ }
    const want = t ? sign(config.CODE_PEPPER, t, u) : '';
    const valid = !!t && /^https?:\/\//i.test(u) && s.length === want.length && timingSafeEqual(Buffer.from(s), Buffer.from(want));
    if (!valid) return reply.redirect(origin() + '/', 302);
    await pool.query('UPDATE mail_sends SET clicked_at = coalesce(clicked_at, now()), opened_at = coalesce(opened_at, now()) WHERE token = $1', [t]).catch(() => null);
    return reply.redirect(u, 302);
  });
  const findByTok = async (req: FastifyRequest) => {
    let t = ''; try { t = tok(req); } catch { return null; }
    return (await pool.query<{ id: number; user_id: string | null; email: string }>('SELECT id, user_id, email FROM mail_sends WHERE token = $1', [t])).rows[0];
  };
  app.get('/m/u/:t', async (req, reply) => {
    const s = await findByTok(req);
    reply.header('content-type', 'text/html; charset=utf-8').header('cache-control', 'no-store');
    if (!s?.user_id) return page('Bağlantı geçersiz', '<p>Bu bağlantı geçersiz ya da süresi dolmuş.</p>');
    // bağlantı tarayıcılar ve e-posta tarayıcıları tarafından önceden açılabilir; çıkış ancak düğmeyle olur
    return page('Abonelikten çık', `<p style="line-height:1.6">${esc(s.email)} adresine kampanya e-postası gönderilmesin mi?</p><form method="post"><button style="margin-top:12px;background:#F26B1D;color:#fff;border:0;border-radius:6px;padding:12px 24px;font-size:16px;font-weight:700;cursor:pointer">Abonelikten çık</button></form><p style="font-size:13px;color:#6A717C;margin-top:18px">Talepleriniz ve hesabınızla ilgili bilgilendirmeler gelmeye devam eder.</p>`);
  });
  app.post('/m/u/:t', async (req, reply) => {
    const s = await findByTok(req);
    if (s?.user_id) {
      await pool.query('UPDATE users SET marketing_at = NULL WHERE id = $1', [s.user_id]);
      await pool.query(`UPDATE mail_sends x SET status = 'skipped', note = 'Abonelikten çıktı' WHERE x.user_id = $1 AND x.status = 'queued'
        AND EXISTS (SELECT 1 FROM mail_templates y WHERE y.id = x.template_id AND y.kind = 'marketing')`, [s.user_id]);
    }
    reply.header('content-type', 'text/html; charset=utf-8').header('cache-control', 'no-store');
    return page('Abonelikten çıktınız', `<p style="line-height:1.6">Tamam, artık size kampanya e-postası göndermeyeceğiz.</p><p style="font-size:13px;color:#6A717C">Fikrinizi değiştirirseniz <a href="${esc(origin())}/bana-ozel?s=hesap" style="color:#1F54C9">Bana Özel → Hesap Bilgileri</a> sayfasından yeniden izin verebilirsiniz.</p>`);
  });

  // Saatlik zamanlanmış iş (/jobs/expire) zaten mailTick'i çalıştırır; bu uç ayrıca daha sık çalıştırmak için.
  app.post('/jobs/mail', async (req) => {
    const t = String(req.headers['x-job-token'] ?? '');
    if (!config.JOB_TOKEN || !safeEqual(t, config.JOB_TOKEN)) throw new HttpError(404, 'bulunamadi', 'Bulunamadı');
    return mailTick(deps, req.log);
  });
}
