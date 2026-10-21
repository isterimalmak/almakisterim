/* ---- E-posta Stüdyosu ---- (Marka Bahçem shared/src/types.ts'den alındı; tetikleyiciler, kitleler ve "Talepler" bloğu almakisterim'e uyarlandı) */
export type MailAlign = 'left' | 'center' | 'right';
/** Her bölüm: isteğe bağlı arka plan rengi ('' = kart rengi) ve üst boşluk (px) */
export type MailSection = { bg?: string; pt?: number };
export type MailFont = 'serif' | 'sans';
export type MailCard = { image: string; title: string; text: string; link: string };
export type MailBlock =
  | { id: string; type: 'hero'; title: string; text: string; image: string; bg: string; fg: string; align?: MailAlign; size?: 'md' | 'lg' | 'xl'; pad?: 'sm' | 'md' | 'lg'; btnText?: string; btnUrl?: string }
  | ({ id: string; type: 'heading'; text: string; size: 'xl' | 'lg' | 'md' | 'sm'; align: MailAlign; font?: MailFont; color?: string; bold?: boolean; italic?: boolean; upper?: boolean } & MailSection)
  | ({ id: string; type: 'text'; text: string; align: MailAlign; font?: MailFont; size?: 'sm' | 'md' | 'lg'; color?: string } & MailSection)
  | ({ id: string; type: 'button'; text: string; url: string; align: MailAlign; color?: string; fg?: string; size?: 'sm' | 'md' | 'lg'; shape?: 'pill' | 'rounded' | 'square'; style?: 'solid' | 'outline'; full?: boolean } & MailSection)
  | ({ id: string; type: 'image'; url: string; alt: string; link: string; width?: number; align?: MailAlign; radius?: 'none' | 'sm' | 'lg'; caption?: string; edge?: boolean } & MailSection)
  | ({ id: string; type: 'imagetext'; image: string; alt: string; link: string; side: 'left' | 'right'; ratio: 33 | 40 | 50; valign: 'top' | 'middle'; title: string; text: string; btnText: string; btnUrl: string } & MailSection)
  | ({ id: string; type: 'cards'; cols: 2 | 3; items: MailCard[] } & MailSection)
  | ({ id: string; type: 'requests'; title: string; ids: number[]; cols?: 2 | 3 } & MailSection)
  | ({ id: string; type: 'coupon'; code: string; note: string } & MailSection)
  | ({ id: string; type: 'divider'; color?: string; thick?: number; width?: number } & MailSection)
  | { id: string; type: 'spacer'; h: number }
  | ({ id: string; type: 'social'; instagram: string; tiktok: string; youtube: string } & MailSection);
export type MailTheme = { accent: string; bg: string; card: string; headFont?: MailFont; logo?: boolean };
export type MailTemplate = { id: number; name: string; subject: string; preheader: string; kind: 'info' | 'marketing'; blocks: MailBlock[]; theme: MailTheme; updatedAt: string; uses?: number };
export type MailTrigger = 'signup' | 'request_published' | 'request_expired' | 'no_request' | 'once';
export type MailAudience = 'all' | 'buyers' | 'sellers' | 'corporate';
export type MailRuleStats = { queued: number; sent: number; skipped: number; failed: number; opened: number; clicked: number; ab: { A: { sent: number; opened: number }; B: { sent: number; opened: number } } };
export type MailRule = { id: number; name: string; templateId: number; trigger: MailTrigger; audience: MailAudience; delayMin: number; sendAt: string | null; quietHours: boolean; subjectB: string | null; active: boolean; firedAt: string | null; stats: MailRuleStats };
export type MailRuleInput = { name: string; templateId: number; trigger: MailTrigger; audience: MailAudience; delayMin: number; sendAt: string | null; quietHours: boolean; subjectB: string | null; active: boolean };
export type MailHome = {
  ready: boolean; provider?: "smtp" | "resend" | null; from: string;
  usage?: { day: number; month: number; limits: { day: number; month: number }; warn: boolean };
  totals: { sent: number; opened: number; clicked: number; queued: number; users: number; optin: number };
  templates: MailTemplate[]; rules: MailRule[];
  starters: { key: string; icon: string; name: string; desc: string; trigger: MailTrigger }[];
};
export type MailSend = { id: number; email: string; user: string | null; status: 'queued' | 'sent' | 'failed' | 'skipped' | 'test'; note: string | null; subject: string | null; variant: 'A' | 'B'; template: string; rule: string | null; dueAt: string; sentAt: string | null; openedAt: string | null; clickedAt: string | null };
