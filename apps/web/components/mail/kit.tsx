'use client';
import type { MailAudience, MailBlock, MailRule, MailTrigger } from '@/lib/mail';

/* E-posta Stüdyosu: ortak tanımlar (blok çeşitleri, görev türleri, okunur cümleler) */

export const rid = () => Math.random().toString(36).slice(2, 10);

export const BLOCKS: { type: MailBlock['type']; icon: string; name: string; desc: string; make: () => MailBlock }[] = [
  { type: 'hero', icon: '🌅', name: 'Afiş', desc: 'Renkli ya da görselli büyük başlık', make: () => ({ id: rid(), type: 'hero', title: 'Büyük başlık', text: 'Kısa bir açıklama', image: '', bg: '#13235B', fg: '#ffffff' }) },
  { type: 'heading', icon: '🔠', name: 'Başlık', desc: 'Bölüm başlığı', make: () => ({ id: rid(), type: 'heading', text: 'Başlık', size: 'lg', align: 'left' }) },
  { type: 'text', icon: '📝', name: 'Metin', desc: 'Paragraf; **kalın** yazılabilir', make: () => ({ id: rid(), type: 'text', text: 'Merhaba {ad}, buraya mesajını yaz.', align: 'left' }) },
  { type: 'button', icon: '🔘', name: 'Düğme', desc: 'Bir sayfaya götüren düğme', make: () => ({ id: rid(), type: 'button', text: 'Hemen incele', url: '/', align: 'center' }) },
  { type: 'image', icon: '🖼', name: 'Görsel', desc: 'Fotoğraf ya da afiş; genişliği ayarlanır', make: () => ({ id: rid(), type: 'image', url: '', alt: '', link: '', width: 100, align: 'center', radius: 'lg', caption: '' }) },
  { type: 'imagetext', icon: '🪟', name: 'Görsel + yazı', desc: 'Görsel bir yanda, başlık, metin ve düğme diğer yanda; telefonda alt alta', make: () => ({ id: rid(), type: 'imagetext', image: '', alt: '', link: '', side: 'left', ratio: 40, valign: 'middle', title: 'Başlık', text: 'Kısa bir açıklama yaz.', btnText: 'İncele', btnUrl: '/' }) },
  { type: 'cards', icon: '🗂', name: 'Kartlar', desc: '2-3 sütun yan yana görselli kartlar', make: () => ({ id: rid(), type: 'cards', cols: 2, items: [{ image: '', title: 'Birinci kart', text: 'Kısa açıklama', link: '' }, { image: '', title: 'İkinci kart', text: 'Kısa açıklama', link: '' }] }) },
  { type: 'requests', icon: '📋', name: 'Talepler', desc: 'Yayındaki taleplerden en fazla 6', make: () => ({ id: rid(), type: 'requests', title: 'Öne çıkan talepler', ids: [] }) },
  { type: 'coupon', icon: '🎟', name: 'Kod', desc: 'Kampanya / indirim kodu kutusu', make: () => ({ id: rid(), type: 'coupon', code: 'KOD10', note: 'Kampanya süresince geçerli' }) },
  { type: 'divider', icon: '➖', name: 'Çizgi', desc: 'İnce ayraç', make: () => ({ id: rid(), type: 'divider' }) },
  { type: 'spacer', icon: '↕️', name: 'Boşluk', desc: 'Nefes payı', make: () => ({ id: rid(), type: 'spacer', h: 24 }) },
  { type: 'social', icon: '🔗', name: 'Sosyal medya', desc: 'Instagram, TikTok, YouTube', make: () => ({ id: rid(), type: 'social', instagram: '', tiktok: '', youtube: '' }) }
];
export const blockMeta = (t: MailBlock['type']) => BLOCKS.find(b => b.type === t)!;
export function blockLabel(b: MailBlock) {
  switch (b.type) {
    case 'hero': return b.title;
    case 'heading': case 'text': return b.text.replace(/\*\*/g, '').slice(0, 60);
    case 'button': return `${b.text} → ${b.url}`;
    case 'image': return b.url ? `${b.alt || 'Görsel'} · %${b.width ?? 100}` : 'Görsel seçilmedi';
    case 'imagetext': return `${b.side === 'left' ? 'Görsel solda' : 'Görsel sağda'} · ${b.title}`;
    case 'cards': return `${b.items.length} kart · ${b.cols} sütun`;
    case 'requests': return b.ids.length ? `${b.ids.length} talep` : 'Talep seçilmedi';
    case 'coupon': return b.code;
    case 'spacer': return `${b.h} px`;
    case 'social': return [b.instagram && 'Instagram', b.tiktok && 'TikTok', b.youtube && 'YouTube'].filter(Boolean).join(', ') || 'Bağlantı yok';
    default: return '';
  }
}

export const TRIGGERS: { key: MailTrigger; icon: string; name: string; when: string; desc: string }[] = [
  { key: 'signup', icon: '🎉', name: 'Yeni üye olunca', when: 'Biri üye olduktan', desc: 'Hoş geldin serisi kur: hemen, 3 gün sonra, 1 hafta sonra…' },
  { key: 'request_published', icon: '✅', name: 'Talep yayına girince', when: 'Talebi yayına girdikten', desc: 'Talep sahibine bilgi, ipuçları, Güvenli Al' },
  { key: 'request_expired', icon: '⏰', name: 'Talebin süresi dolunca', when: 'Talebinin süresi dolduktan', desc: 'Yeniden talep vermeye davet' },
  { key: 'no_request', icon: '💬', name: 'Üye olup talep vermeyince', when: 'Üye olup talep vermeden', desc: 'Kibar bir hatırlatma (kişi başı bir kez)' },
  { key: 'once', icon: '📅', name: 'Belirli bir tarihte', when: 'Seçtiğin tarihte', desc: 'Kampanya, duyuru; bir kitleye tek seferde' }
];
export const trig = (k: MailTrigger) => TRIGGERS.find(t => t.key === k)!;

export const AUDIENCES: { key: MailAudience; icon: string; name: string }[] = [
  { key: 'all', icon: '👥', name: 'Herkes' }, { key: 'buyers', icon: '🛍', name: 'Alıcılar' },
  { key: 'sellers', icon: '🏪', name: 'Satıcılar' }, { key: 'corporate', icon: '🏢', name: 'Kurumsal' }
];

export const DELAYS: [number, string][] = [[0, 'Hemen'], [60, '1 saat'], [180, '3 saat'], [1440, '1 gün'], [4320, '3 gün'], [10080, '1 hafta']];
export function delayText(min: number) {
  if (!min) return 'hemen';
  if (min % 10080 === 0) return `${min / 10080} hafta sonra`;
  if (min % 1440 === 0) return `${min / 1440} gün sonra`;
  if (min % 60 === 0) return `${min / 60} saat sonra`;
  return `${min} dakika sonra`;
}

/** Görevin okunur cümlesi: "Biri üye olduktan 1 gün sonra «Hoş geldin» gönderilir" */
export function ruleSentence(r: Pick<MailRule, 'trigger' | 'delayMin' | 'sendAt' | 'audience' | 'quietHours'>, tpl: string) {
  const t = trig(r.trigger);
  const aud = AUDIENCES.find(a => a.key === r.audience)?.name.toLocaleLowerCase('tr') ?? '';
  const night = r.quietHours ? ' Gece 21:00–09:00 arasına denk gelirse sabah 09:00\'da gider.' : '';
  if (r.trigger === 'once') return `${r.sendAt ? new Date(r.sendAt).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'Seçeceğin tarihte'} «${tpl}» ${aud} kitlesine bir kez gönderilir.${night}`;
  if (r.trigger === 'no_request') return `Üye olup ${delayText(Math.max(60, r.delayMin)).replace(' sonra', '')} içinde talep vermeyen kişiye «${tpl}» bir kez gönderilir.${night}`;
  return `${t.when} ${delayText(r.delayMin)} «${tpl}» gönderilir.${night}`;
}

export const pct = (a: number, b: number) => b ? Math.round(a / b * 100) : 0;

/** Konu ve içerik için hızlı kontrol listesi */
export function checklist(t: { subject: string; preheader: string; kind: 'info' | 'marketing'; blocks: MailBlock[] }) {
  const all = JSON.stringify(t.blocks) + t.subject;
  return [
    { ok: !!t.subject.trim(), text: 'Konu yazıldı' },
    { ok: t.subject.length <= 60, text: `Konu kısa (${t.subject.length}/60): telefonda kesilmez` },
    { ok: !!t.preheader.trim(), text: 'Ön izleme metni var (gelen kutusunda konunun yanında görünür)' },
    { ok: all.includes('{ad}'), text: 'Kişiselleştirme: {ad} kullanıldı' },
    { ok: t.blocks.some(b => b.type === 'button'), text: 'En az bir düğme var' },
    { ok: !t.blocks.some(b => (b.type === 'image' && (!b.url || !b.alt)) || (b.type === 'imagetext' && (!b.image || !b.alt)) || (b.type === 'cards' && b.items.some(i => !i.image))), text: 'Görsellerin hepsi seçili ve açıklamalı' },
    { ok: !t.blocks.some(b => b.type === 'requests' && !b.ids.length), text: 'Talep bölümlerinde talep seçildi' },
    { ok: !/[A-ZÇĞİÖŞÜ]{6,}/.test(t.subject) && !/!!/.test(t.subject), text: 'Konuda bağıran BÜYÜK HARF ya da !! yok (spam riski)' }
  ];
}
