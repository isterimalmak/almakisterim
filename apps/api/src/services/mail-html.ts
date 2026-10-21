// Sistem e-postaları için marka şablonu (Marka Bahçem'deki template() gibi): düz metinden logolu, düğmeli HTML üretilir.
// Satırdaki tek başına adres düğme olur; 6 haneli kod iri kutuda gösterilir. Düz metin sürümü de aynen gider.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const URL_RE = /https?:\/\/[^\s)]+/g;

/** Adrese göre düğme yazısı */
export function buttonText(url: string) {
  const p = url.replace(/^https?:\/\/[^/]+/, "");
  if (p.startsWith("/talep-ver")) return "Ücretsiz talep ver";
  if (p.startsWith("/talep/")) return "Talebi görüntüle";
  if (p.startsWith("/guvenli-al")) return "Satışı görüntüle";
  if (p.includes("s=alarm")) return "Talep alarmı kur";
  if (p.includes("s=mesaj")) return "Mesajları aç";
  if (p.startsWith("/bana-ozel")) return "Hesabıma git";
  return "almakisterim'e git";
}

const NAVY = "#13235B", ORANGE = "#F26B1D";
const font = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function brandHtml(subject: string, text: string, origin: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  const parts: string[] = [];
  let bullets: string[] = [];
  const flush = () => { if (bullets.length) { parts.push(`<ul style="margin:0 0 14px;padding-left:20px">${bullets.map((b) => `<li style="margin:0 0 6px">${b}</li>`).join("")}</ul>`); bullets = []; } };
  const linkify = (s: string) => esc(s).replace(URL_RE, (u) => `<a href="${u}" style="color:${ORANGE};font-weight:600">${u.replace(/^https?:\/\//, "")}</a>`);
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) { flush(); continue; }
    if (/^almakisterim(\.com)?$/i.test(l)) continue; // imza, alt bilgide zaten var
    const only = l.match(/^(https?:\/\/\S+)$/);
    const code = l.match(/^(.*?kodunuz:\s*)(\d{6})(\.?\s*)(.*)$/i);
    if (only) { flush(); parts.push(`<p style="margin:20px 0"><a href="${esc(only[1]!)}" style="display:inline-block;background:${ORANGE};color:#fff;padding:13px 24px;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px">${buttonText(only[1]!)}</a></p>`); continue; }
    if (code) { flush(); parts.push(`<p style="margin:0 0 10px">${esc(code[1]!.replace(/:\s*$/, ""))}:</p><div style="margin:0 0 14px;padding:16px;border:2px dashed ${ORANGE};border-radius:14px;text-align:center;font-size:32px;font-weight:800;letter-spacing:8px;color:${NAVY}">${code[2]}</div>${code[4] ? `<p style="margin:0 0 12px;color:#6A717C;font-size:13px">${esc(code[4])}</p>` : ""}`); continue; }
    const b = l.match(/^[•\-*]\s+(.*)$/);
    if (b) { bullets.push(linkify(b[1]!)); continue; }
    flush();
    parts.push(`<p style="margin:0 0 12px">${linkify(l)}</p>`);
  }
  flush();
  const site = origin.replace(/\/$/, "");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F1F2F4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F2F4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="padding:22px 32px 18px;text-align:center;border-bottom:1px solid #E9EBEE"><a href="${esc(site)}/" style="${font};font-size:24px;font-weight:800;color:${NAVY};text-decoration:none">almakisterim<span style="color:${ORANGE}">.com</span></a></td></tr>
<tr><td style="padding:26px 32px 8px;${font};font-size:15px;line-height:1.6;color:#1F2328">
<h2 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:${NAVY}">${esc(subject)}</h2>
${parts.join("\n")}
</td></tr>
<tr><td style="padding:22px 32px 26px;${font};font-size:12px;line-height:1.6;color:#8A93A6;text-align:center;border-top:1px solid #F1F2F4">almakisterim.com · Almak istediğinizi yazın, satıcılar size ulaşsın.<br>Bu e-postayı siz istemediyseniz yok sayabilirsiniz.</td></tr>
</table></td></tr></table></body></html>`;
}
