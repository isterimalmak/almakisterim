'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { MailHome, MailRule, MailSend, MailTemplate, MailTrigger } from '@/lib/mail';
import { api, dateTime, useLoad, useApp, PTop, Empty, Skeleton } from '@/components/mail/ms';
import { RuleModal } from '@/components/mail/RuleModal';
import { AUDIENCES, TRIGGERS, delayText, pct, trig } from '@/components/mail/kit';

type Tab = 'flows' | 'templates' | 'log';

function Studio() {
  const router = useRouter();
  const sp = useSearchParams();
  const tab = (sp.get('t') as Tab) || 'flows';
  const { toast, fail } = useApp();
  const { data, reload } = useLoad(() => api.admin.mail.home());
  const [edit, setEdit] = useState<{ rule?: MailRule; trigger?: MailTrigger; templateId?: number } | null>(null);
  const go = (t: Tab) => router.replace('/yonetim/eposta' + (t === 'flows' ? '' : `?t=${t}`), { scroll: false });

  const create = async (b: { starter?: string; copyOf?: number }) => {
    try { const r = await api.admin.mail.createTemplate(b); router.push(`/yonetim/eposta/${r.id}`); } catch (e) { fail(e); }
  };
  const toggle = async (r: MailRule) => {
    try { await api.admin.mail.updateRule(r.id, { active: !r.active }); toast(r.active ? 'Görev durduruldu' : 'Görev başladı ▶️'); await reload(); } catch (e) { fail(e); }
  };
  const delRule = async (r: MailRule) => { if (!confirm(`“${r.name}” görevi silinsin mi? Sıradaki gönderimleri de iptal olur.`)) return; try { await api.admin.mail.deleteRule(r.id); await reload(); } catch (e) { fail(e); } };
  const delTpl = async (t: MailTemplate) => { if (!confirm(`“${t.name}” şablonu silinsin mi?${t.uses ? ` Bu şablonu kullanan ${t.uses} görev de silinir.` : ''}`)) return; try { await api.admin.mail.deleteTemplate(t.id); await reload(); } catch (e) { fail(e); } };

  const T = data?.totals;
  return (
    <>
      <PTop title="E-posta Stüdyosu" sub="E-postalarını bloklarla tasarla, sonra görev ver: kime, hangi olayda ya da hangi tarihte gideceğini sen belirle."
        actions={<button className="btn btn-primary" onClick={() => create({})}>＋ Yeni e-posta</button>} />
      {!data ? <div className="stack"><Skeleton h={96} /><Skeleton h={320} /></div> : (
        <div className="stack" style={{ gap: 18 }}>
          {!data.ready ? <div className="ms-warn">⚠️ <div><b>E-posta servisi henüz bağlı değil.</b> Tasarlayabilir ve görev verebilirsin; ancak gerçek gönderim için Resend anahtarının <b>Yönetim → Entegrasyonlar → E-posta</b> bölümüne girilmesi ve <b>almakisterim.com</b> alan adının Resend'de doğrulanması gerekiyor. Kampanya e-postaları için ayrıca İYS (İleti Yönetim Sistemi) kaydı yasal zorunluluktur.</div></div> : null}
          <div className="note n-info"><span>Görevler saatlik zamanlanmış işle çalışır: “hemen” seçilen e-posta en geç bir saat içinde gider. <b>Yapay Zekâ → Otomatik e-postalar</b> açıksa hoş geldin ve talep durumu e-postaları ayrıca gider; aynı olaya burada da görev verirsen üye iki e-posta alır.</span></div>
          <div className="ms-kpis">
            <div><small>Son 30 gün gönderilen</small><b>{T!.sent.toLocaleString('tr-TR')}</b></div>
            <div><small>Açılma oranı</small><b>%{pct(T!.opened, T!.sent)}</b><i style={{ width: pct(T!.opened, T!.sent) + '%' }} /></div>
            <div><small>Tıklama oranı</small><b>%{pct(T!.clicked, T!.sent)}</b><i style={{ width: pct(T!.clicked, T!.sent) + '%' }} /></div>
            <div><small>Sırada bekleyen</small><b>{T!.queued.toLocaleString('tr-TR')}</b></div>
            <div><small>Kampanya izni veren</small><b>{T!.optin.toLocaleString('tr-TR')}<span>/{T!.users.toLocaleString('tr-TR')}</span></b><i style={{ width: pct(T!.optin, T!.users) + '%' }} /></div>
          </div>

          <div className="sp-tabs" style={{ justifyContent: 'flex-start', margin: 0 }}>
            <button className={tab === 'flows' ? 'on' : ''} onClick={() => go('flows')}>⚡ Otomasyonlar</button>
            <button className={tab === 'templates' ? 'on' : ''} onClick={() => go('templates')}>🎨 Şablonlar <small className="muted">{data.templates.length}</small></button>
            <button className={tab === 'log' ? 'on' : ''} onClick={() => go('log')}>🧾 Gönderim kaydı</button>
          </div>

          {tab === 'flows' ? <Flows data={data} onAdd={t => data.templates.length ? setEdit({ trigger: t }) : go('templates')} onEdit={r => setEdit({ rule: r })} onToggle={toggle} onDel={delRule} onStarter={k => create({ starter: k })} />
            : tab === 'templates' ? <Templates data={data} onNew={() => create({})} onStarter={k => create({ starter: k })} onCopy={id => create({ copyOf: id })} onDel={delTpl} onRule={id => setEdit({ templateId: id })} />
            : <Log rules={data.rules} />}
        </div>
      )}
      {edit && data ? <RuleModal templates={data.templates.map(t => ({ id: t.id, name: t.name, kind: t.kind }))} rule={edit.rule}
        preset={{ ...(edit.trigger ? { trigger: edit.trigger, ...(edit.trigger === 'once' ? { sendAt: new Date(Date.now() + 86400e3).toISOString() } : {}) } : {}), ...(edit.templateId ? { templateId: edit.templateId } : {}) }}
        onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); toast('Görev kaydedildi ⚡'); await reload(); }} /> : null}
    </>
  );
}
export default function Page() { return <Suspense><Studio /></Suspense>; }

/** Otomasyonlar: her olay bir akış; görevler gecikmeye göre zaman çizelgesinde sıralanır */
function Flows({ data, onAdd, onEdit, onToggle, onDel, onStarter }: { data: MailHome; onAdd: (t: MailTrigger) => void; onEdit: (r: MailRule) => void; onToggle: (r: MailRule) => void; onDel: (r: MailRule) => void; onStarter: (k: string) => void }) {
  const tname = (id: number) => data.templates.find(t => t.id === id)?.name ?? 'Silinmiş şablon';
  if (!data.templates.length) return (
    <div className="ms-start">
      <div><h2>Hazır şablonlardan başla</h2><p className="muted">Bir tanesine dokun; düzenleyicide açılır, metinleri ve renkleri istediğin gibi değiştir. Sonra “⚡ Görev ver” ile kime ne zaman gideceğini seç.</p></div>
      <Starters data={data} onPick={onStarter} />
    </div>
  );
  return (
    <div className="ms-flows">
      {TRIGGERS.map(t => {
        const rs = data.rules.filter(r => r.trigger === t.key).sort((a, b) => t.key === 'once' ? +new Date(b.sendAt ?? 0) - +new Date(a.sendAt ?? 0) : a.delayMin - b.delayMin);
        return (
          <section key={t.key} className={'ms-flow' + (rs.some(r => r.active) ? ' live' : '')}>
            <header><span className="ms-fi">{t.icon}</span><div className="grow"><b>{t.name}</b><small>{t.desc}</small></div><button className="btn btn-sm" onClick={() => onAdd(t.key)}>＋ Ekle</button></header>
            {rs.length ? (
              <ol className="ms-steps">
                {rs.map(r => {
                  const s = r.stats;
                  const when = t.key === 'once' ? (r.sendAt ? new Date(r.sendAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '') : t.key === 'no_request' ? `${delayText(Math.max(60, r.delayMin)).replace(' sonra', '')} bekleyince` : delayText(r.delayMin);
                  const abWin = r.subjectB && s.ab.A.sent && s.ab.B.sent ? (pct(s.ab.B.opened, s.ab.B.sent) > pct(s.ab.A.opened, s.ab.A.sent) ? 'B' : 'A') : null;
                  return (
                    <li key={r.id} className={r.active ? 'on' : ''}>
                      <span className="ms-when">{when}</span>
                      <div className="ms-step">
                        <div className="ms-step-h">
                          <div className="grow"><b>{tname(r.templateId)}</b><small>{r.name}{t.key === 'once' ? ` · ${AUDIENCES.find(a => a.key === r.audience)?.name}` : ''}{r.quietHours ? ' · 🌙' : ''}{r.subjectB ? ' · 🧪 A/B' : ''}</small></div>
                          {t.key === 'once' && r.firedAt ? <span className="badge b-ok">Gönderildi</span> : <label className="switch" title={r.active ? 'Durdur' : 'Başlat'}><input type="checkbox" checked={r.active} onChange={() => onToggle(r)} /><span /></label>}
                        </div>
                        <div className="ms-stats">
                          <span title="Gönderilen">📨 {s.sent}</span><span title="Açılan">👁 %{pct(s.opened, s.sent)}</span><span title="Tıklanan">👆 %{pct(s.clicked, s.sent)}</span>
                          {s.queued ? <span title="Sırada">⏳ {s.queued}</span> : null}{s.skipped ? <span title="Atlanan (izin yok, abonelikten çıktı…)">⤼ {s.skipped}</span> : null}{s.failed ? <span className="bad" title="Gönderilemeyen">⚠ {s.failed}</span> : null}
                          {abWin ? <span className="win">🏆 {abWin} konusu önde</span> : null}
                        </div>
                        <div className="ms-step-a">
                          <Link className="btn btn-sm btn-ghost" href={`/yonetim/eposta/${r.templateId}`}>🎨 Tasarım</Link>
                          <button className="btn btn-sm btn-ghost" onClick={() => onEdit(r)}>⚙️ Ayarlar</button>
                          <Link className="btn btn-sm btn-ghost" href={`/yonetim/eposta?t=log&rule=${r.id}`}>🧾 Kayıt</Link>
                          <button className="btn btn-sm btn-ghost" onClick={() => onDel(r)}>🗑</button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : <button className="ms-add" onClick={() => onAdd(t.key)}>＋ Bu olaya bir e-posta bağla</button>}
          </section>
        );
      })}
    </div>
  );
}

function Starters({ data, onPick }: { data: MailHome; onPick: (k: string) => void }) {
  return <div className="ms-starters">{data.starters.map(s => <button key={s.key} onClick={() => onPick(s.key)}><span>{s.icon}</span><b>{s.name}</b><small>{s.desc}</small><em>{trig(s.trigger).icon} {trig(s.trigger).name}</em></button>)}</div>;
}

function Templates({ data, onNew, onStarter, onCopy, onDel, onRule }: { data: MailHome; onNew: () => void; onStarter: (k: string) => void; onCopy: (id: number) => void; onDel: (t: MailTemplate) => void; onRule: (id: number) => void }) {
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="ms-gal">
        <button className="ms-tpl ms-new" onClick={onNew}><span>＋</span><b>Boş e-posta</b><small>Sıfırdan tasarla</small></button>
        {data.templates.map(t => (
          <div key={t.id} className="ms-tpl">
            <Link href={`/yonetim/eposta/${t.id}`} className="ms-thumb"><Thumb t={t} /></Link>
            <div className="ms-tpl-b">
              <Link href={`/yonetim/eposta/${t.id}`}><b>{t.name}</b></Link>
              <small className="ellip">{t.subject || 'Konu yok'}</small>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <span className={'badge ' + (t.kind === 'marketing' ? 'b-brand' : 'b-mute')}>{t.kind === 'marketing' ? '📣 Kampanya' : 'ℹ️ Bilgilendirme'}</span>
                {t.uses ? <span className="badge b-ok">⚡ {t.uses} görev</span> : <span className="badge b-mute">Görev yok</span>}
              </div>
              <div className="row" style={{ gap: 4 }}>
                <Link className="btn btn-sm" href={`/yonetim/eposta/${t.id}`}>✏️ Düzenle</Link>
                <button className="btn btn-sm" onClick={() => onRule(t.id)}>⚡ Görev ver</button>
                <button className="btn btn-sm btn-ghost" onClick={() => onCopy(t.id)} title="Kopyala">⧉</button>
                <button className="btn btn-sm btn-ghost" onClick={() => onDel(t)} title="Sil">🗑</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div><div className="ms-h" style={{ marginBottom: 8 }}>Hazır şablonlar</div><Starters data={data} onPick={onStarter} /></div>
    </div>
  );
}

/** Şablon küçük resmi: gerçek e-posta küçültülmüş hâliyle */
function Thumb({ t }: { t: MailTemplate }) {
  const [html, setHtml] = useState('');
  useEffect(() => { api.admin.mail.render({ name: t.name, subject: t.subject, preheader: t.preheader, kind: t.kind, blocks: t.blocks, theme: t.theme }).then(r => setHtml(r.html)).catch(() => {}); }, [t]);
  return html ? <iframe title="" tabIndex={-1} sandbox="" srcDoc={html} /> : <Skeleton h={260} />;
}

const ST: Record<MailSend['status'], [string, string]> = { queued: ['⏳ Sırada', 'b-info'], sent: ['✓ Gönderildi', 'b-ok'], failed: ['⚠ Gönderilemedi', 'b-bad'], skipped: ['⤼ Atlandı', 'b-mute'], test: ['🧪 Deneme', 'b-teal'] };
function Log({ rules }: { rules: MailRule[] }) {
  const sp = useSearchParams();
  const rule = Number(sp.get('rule')) || undefined;
  const [status, setStatus] = useState<string>('');
  const { fail } = useApp();
  const { data, reload } = useLoad(() => api.admin.mail.sends({ rule, status: status || undefined }), [rule, status]);
  const r = rules.find(x => x.id === rule);
  return (
    <div className="stack">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {r ? <span className="badge b-brand">⚡ {r.name} <Link href="/yonetim/eposta?t=log" style={{ marginLeft: 6 }}>✕</Link></span> : null}
        <div className="seg">{[['', 'Hepsi'], ['queued', 'Sırada'], ['sent', 'Gönderilen'], ['skipped', 'Atlanan'], ['failed', 'Hatalı'], ['test', 'Deneme']].map(([k, l]) => <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k!)}>{l}</button>)}</div>
      </div>
      {!data ? <Skeleton h={300} /> : !data.sends.length ? <Empty icon="🧾" title="Kayıt yok" text="Görevler çalıştıkça her gönderim burada görünür." /> : (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Kişi</th><th>E-posta</th><th>Durum</th><th>Zaman</th><th className="r">Açtı · Tıkladı</th><th /></tr></thead>
          <tbody>{data.sends.map(s => (
            <tr key={s.id}>
              <td><b className="small">{s.user ?? '—'}</b><div className="xs muted">{s.email}</div></td>
              <td><span className="small">{s.template}</span><div className="xs muted ellip" style={{ maxWidth: 260 }}>{s.subject ?? s.rule ?? ''}{s.variant === 'B' ? ' · B' : ''}</div></td>
              <td><span className={'badge ' + ST[s.status][1]}>{ST[s.status][0]}</span>{s.note && s.status !== 'test' ? <div className="xs muted">{s.note}</div> : null}</td>
              <td className="xs">{dateTime(s.sentAt ?? s.dueAt)}</td>
              <td className="r">{s.openedAt ? '👁' : '·'} {s.clickedAt ? '👆' : '·'}</td>
              <td>{s.status === 'queued' ? <button className="btn btn-sm btn-ghost" onClick={async () => { try { await api.admin.mail.cancelSend(s.id); await reload(); } catch (e) { fail(e); } }}>İptal</button> : null}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
