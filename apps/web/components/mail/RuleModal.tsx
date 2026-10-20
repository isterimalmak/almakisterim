'use client';
import { useEffect, useState } from 'react';
import type { MailRule, MailRuleInput } from '@/lib/mail';
import { api, useApp, Modal } from './ms';
import { AUDIENCES, DELAYS, TRIGGERS, ruleSentence } from './kit';

type T = { id: number; name: string; kind: 'info' | 'marketing' };
const local = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

/** Görev ver: şablon, ne zaman (olay ya da tarih), kime, gecikme, sessiz saatler, A/B konu */
export function RuleModal({ templates, rule, preset, onClose, onSaved }: { templates: T[]; rule?: MailRule; preset?: Partial<MailRuleInput>; onClose: () => void; onSaved: () => void }) {
  const { fail } = useApp();
  const tomorrow = new Date(Date.now() + 86400e3); tomorrow.setHours(10, 0, 0, 0);
  const [f, setF] = useState<MailRuleInput>(() => rule
    ? { name: rule.name, templateId: rule.templateId, trigger: rule.trigger, audience: rule.audience, delayMin: rule.delayMin, sendAt: rule.sendAt, quietHours: rule.quietHours, subjectB: rule.subjectB, active: rule.active }
    : { name: '', templateId: templates[0]?.id ?? 0, trigger: 'signup', audience: 'all', delayMin: 0, sendAt: null, quietHours: true, subjectB: null, active: true, ...preset });
  const [custom, setCustom] = useState(() => !DELAYS.some(([m]) => m === f.delayMin));
  const [ab, setAb] = useState(!!f.subjectB);
  const [aud, setAud] = useState<{ count: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const tpl = templates.find(t => t.id === f.templateId);
  const set = (p: Partial<MailRuleInput>) => setF(x => ({ ...x, ...p }));
  const fired = !!rule?.firedAt;

  useEffect(() => {
    if (f.trigger !== 'once' || !tpl) { setAud(null); return; }
    api.admin.mail.audience(f.audience, tpl.kind).then(setAud).catch(() => setAud(null));
  }, [f.trigger, f.audience, tpl?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const name = f.name.trim() || `${TRIGGERS.find(t => t.key === f.trigger)!.name} · ${tpl?.name ?? ''}`.slice(0, 80);
    if (f.trigger === 'once' && !f.sendAt) { fail(new Error('Gönderim tarihini seç')); return; }
    const body: MailRuleInput = { ...f, name, subjectB: ab && f.subjectB?.trim() ? f.subjectB.trim() : null, delayMin: f.trigger === 'once' ? 0 : f.trigger === 'no_request' ? Math.max(60, f.delayMin) : f.delayMin };
    if (f.trigger === 'once' && f.active && aud && !confirm(`${aud.count} kişiye ${new Date(f.sendAt!).toLocaleString('tr-TR')} tarihinde gönderilecek. Onaylıyor musun?`)) return;
    setBusy(true);
    try { if (rule) await api.admin.mail.updateRule(rule.id, body); else await api.admin.mail.createRule(body); onSaved(); } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const delays = f.trigger === 'no_request' ? DELAYS.filter(([m]) => m >= 60) : DELAYS;
  return (
    <Modal wide title={rule ? '⚡ Görevi düzenle' : '⚡ Görev ver'} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Vazgeç</button><button className="btn btn-primary" disabled={busy || !f.templateId} onClick={save}>{busy ? 'Kaydediliyor…' : rule ? 'Kaydet' : f.active ? '⚡ Kaydet ve başlat' : 'Taslak olarak kaydet'}</button></>}>
      <div className="stack" style={{ gap: 16 }}>
        <div className="g2e" style={{ gap: 12 }}>
          <label className="ms-f"><span>Hangi e-posta?</span>
            <select className="input" value={f.templateId} disabled={fired} onChange={e => set({ templateId: Number(e.target.value) })}>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}{t.kind === 'marketing' ? ' · kampanya' : ''}</option>)}
            </select>
          </label>
          <label className="ms-f"><span>Görevin adı <small className="muted">(isteğe bağlı)</small></span><input className="input" maxLength={80} value={f.name} onChange={e => set({ name: e.target.value })} placeholder="ör. Hoş geldin serisi · 1. gün" /></label>
        </div>

        <div className="ms-f"><span>Ne zaman gitsin?</span>
          <div className="ms-trig">{TRIGGERS.map(t => (
            <button key={t.key} type="button" disabled={fired} className={f.trigger === t.key ? 'on' : ''} onClick={() => { set({ trigger: t.key, ...(t.key === 'no_request' && f.delayMin < 60 ? { delayMin: 1440 } : {}), ...(t.key === 'once' && !f.sendAt ? { sendAt: tomorrow.toISOString() } : {}) }); setCustom(false); }}>
              <span>{t.icon}</span><b>{t.name}</b><small>{t.desc}</small>
            </button>
          ))}</div>
        </div>

        {f.trigger === 'once' ? (
          <div className="g2e" style={{ gap: 12 }}>
            <div className="ms-f"><span>Kime?</span>
              <div className="seg">{AUDIENCES.map(a => <button key={a.key} disabled={fired} className={f.audience === a.key ? 'on' : ''} onClick={() => set({ audience: a.key })}>{a.icon} {a.name}</button>)}</div>
              {aud ? <div className="ms-aud"><b>≈ {aud.count.toLocaleString('tr-TR')} kişi</b>{tpl?.kind === 'marketing' && aud.total > aud.count ? <small> · {aud.total - aud.count} kişi kampanya izni vermediği için alamaz</small> : null}</div> : null}
            </div>
            <label className="ms-f"><span>Tarih ve saat</span><input className="input" type="datetime-local" disabled={fired} value={local(f.sendAt)} min={local(new Date().toISOString())} onChange={e => set({ sendAt: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
          </div>
        ) : (
          <div className="ms-f"><span>{f.trigger === 'no_request' ? 'Üyelikten ne kadar sonra?' : 'Ne kadar sonra?'}</span>
            <div className="ms-chips big">
              {delays.map(([m, l]) => <button key={m} type="button" className={!custom && f.delayMin === m ? 'on' : ''} onClick={() => { set({ delayMin: m }); setCustom(false); }}>{l}</button>)}
              <button type="button" className={custom ? 'on' : ''} onClick={() => setCustom(true)}>Özel…</button>
            </div>
            {custom ? <div className="row" style={{ gap: 8, marginTop: 8 }}><input className="input" type="number" min={0} max={90} style={{ width: 90 }} value={Math.round(f.delayMin / 1440 * 10) / 10 || ''} onChange={e => set({ delayMin: Math.round(Number(e.target.value) * 1440) })} /><span className="small">gün sonra</span></div> : null}
          </div>
        )}

        <div className="ms-opts">
          <label className="ms-opt"><span className="switch"><input type="checkbox" checked={f.quietHours} onChange={e => set({ quietHours: e.target.checked })} /><span /></span><div><b>🌙 Gece rahatsız etme</b><small>21:00–09:00 arasına denk gelen e-posta sabah 09:00'da gider.</small></div></label>
          <label className="ms-opt"><span className="switch"><input type="checkbox" checked={ab} onChange={e => setAb(e.target.checked)} /><span /></span><div><b>🧪 A/B konu testi</b><small>Alıcıların yarısına ikinci bir konu gider; hangisinin daha çok açıldığını görürsün.</small></div></label>
          {ab ? <input className="input" maxLength={150} value={f.subjectB ?? ''} onChange={e => set({ subjectB: e.target.value })} placeholder="B konusu, ör. {ad}, bunu kaçırma 👀" /> : null}
          <label className="ms-opt"><span className="switch"><input type="checkbox" checked={f.active} onChange={e => set({ active: e.target.checked })} /><span /></span><div><b>▶️ Görev etkin</b><small>Kapalıysa taslak olarak bekler, hiçbir şey gönderilmez.</small></div></label>
        </div>

        <div className="ms-sentence">💬 {ruleSentence({ trigger: f.trigger, delayMin: f.delayMin, sendAt: f.sendAt, audience: f.audience, quietHours: f.quietHours }, tpl?.name ?? '…')}
          {tpl?.kind === 'marketing' ? <div className="xs" style={{ marginTop: 6 }}>📣 Kampanya e-postası: yalnızca izin verenlere gider ve aynı kişiye günde en fazla bir kampanya e-postası gönderilir.</div> : null}
        </div>
      </div>
    </Modal>
  );
}
