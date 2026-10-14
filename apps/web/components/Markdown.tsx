import Link from "next/link";
import type { ReactNode } from "react";

// Blog yazıları için küçük, güvenli Markdown gösterici: HTML çalıştırmaz, yalnızca bilinen biçimleri React öğesine çevirir.
// Desteklenenler: ## ve ### başlık, paragraf, - / * madde listesi, 1. numaralı liste, **kalın**, *eğik*, [bağlantı](https://… veya /yol).

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<strong key={k}>{m[1]}</strong>);
    else if (m[2]) out.push(<em key={k}>{m[2]}</em>);
    else if (m[3] && m[4]) out.push(m[4].startsWith("/")
      ? <Link key={k} href={m[4]} className="link">{m[3]}</Link>
      : <a key={k} href={m[4]} className="link" target="_blank" rel="noopener noreferrer nofollow">{m[3]}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [], list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (para.length) { blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(" "), `p${blocks.length}`)}</p>); para = []; }
    if (list) {
      const items = list.items.map((it, j) => <li key={j}>{inline(it, `l${blocks.length}-${j}`)}</li>);
      blocks.push(list.ordered ? <ol key={`o${blocks.length}`}>{items}</ol> : <ul key={`u${blocks.length}`}>{items}</ul>);
      list = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m: RegExpExecArray | null;
    if (!line.trim()) { flush(); continue; }
    if ((m = /^(#{2,4})\s+(.*)$/.exec(line))) {
      flush();
      const k = `h${blocks.length}`;
      blocks.push(m[1] === "##" ? <h2 key={k}>{inline(m[2]!, k)}</h2> : <h3 key={k}>{inline(m[2]!, k)}</h3>);
      continue;
    }
    if ((m = /^\s*[-*]\s+(.*)$/.exec(line)) || (m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      const ordered = /^\s*\d/.test(line);
      if (para.length) { const p = para; para = []; blocks.push(<p key={`p${blocks.length}`}>{inline(p.join(" "), `p${blocks.length}`)}</p>); }
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push(m[1]!);
      continue;
    }
    if (list) flush();
    // "# Başlık" sayfa başlığıyla çakışmasın diye ara başlık olarak gösterilir.
    para.push(line.replace(/^#\s+/, ""));
  }
  flush();
  return <div className="md">{blocks}</div>;
}
