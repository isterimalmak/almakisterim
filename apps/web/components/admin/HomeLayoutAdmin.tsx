"use client";

import { useSession } from "@/components/Session";
import { api } from "@/lib/api";
import { HOME_SECTIONS, homeOrder, sectionName, type HomeSection } from "@/lib/home";

// Yönetim → Ana Sayfa Düzeni: orta sütundaki bölümler yukarı/aşağı taşınır, gizlenir ya da gösterilir; değişiklik hemen kaydedilir.
export function HomeLayoutAdmin() {
  const { homeOrder: saved, homeHidden, homeVitrin, homeLatest, refresh, toast } = useSession();
  const order = homeOrder(saved);
  const hidden = (id: HomeSection) => (id === "vitrin" ? !homeVitrin : id === "latest" ? !homeLatest : homeHidden.includes(id));
  const save = async (body: Record<string, unknown>, msg: string) => {
    try { await api("/admin/settings", { method: "PUT", body }); await refresh(); toast(msg); }
    catch (e) { toast((e as Error).message); }
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    void save({ home_order: next }, `${sectionName(order[i]!)} ${d < 0 ? "yukarı" : "aşağı"} taşındı.`);
  };
  const flip = (id: HomeSection) => {
    const on = hidden(id);
    const body = id === "vitrin" ? { home_vitrin: on } : id === "latest" ? { home_latest: on }
      : { home_hidden: on ? homeHidden.filter((x) => x !== id) : [...new Set([...homeHidden, id])] };
    void save(body, `${sectionName(id)} ${on ? "ana sayfada gösteriliyor." : "ziyaretçilerden gizlendi."}`);
  };
  const reset = () => void save({ home_order: HOME_SECTIONS.map((s) => s.id) }, "Bölümler ilk sıraya döndü.");

  return (
    <div className="ap-box"><div className="ap-box-h"><h2>Ana Sayfa Düzeni</h2></div><div className="ap-box-b">
      <div className="note n-info" style={{ marginBottom: 12 }}><span>
        Ana sayfanın ortasındaki bölümler aşağıdaki sırayla görünür. Okla yukarı/aşağı taşıyın, istemediğinizi gizleyin; değişiklik hemen kaydedilir.
        Site yeniyken talep az olduğu için <b>vitrini ve son talepleri gizleyip</b> yerlerine soldaki menüden <b>Reklam Alanları</b> bölümünden resim/video ekleyebilirsiniz.
        Ana sayfada yönetici olarak gizli bölümlerin yerini ve &quot;Göster&quot; düğmesini yalnızca siz görürsünüz.
      </span></div>
      <ol className="hl-list">
        {order.map((id, i) => (
          <li key={id} className={hidden(id) ? "off" : ""}>
            <span className="hl-n">{i + 1}</span>
            <span className="hl-t"><b>{sectionName(id)}</b><small>{hidden(id) ? "Gizli" : "Görünüyor"}</small></span>
            <button type="button" className="btn btn-wh btn-sm" disabled={i === 0} aria-label={`${sectionName(id)} yukarı taşı`} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="btn btn-wh btn-sm" disabled={i === order.length - 1} aria-label={`${sectionName(id)} aşağı taşı`} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className={"btn btn-sm " + (hidden(id) ? "btn-or" : "btn-wh")} aria-label={`${sectionName(id)} ${hidden(id) ? "göster" : "gizle"}`} onClick={() => flip(id)}>{hidden(id) ? "Göster" : "Gizle"}</button>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-gh btn-sm" style={{ marginTop: 10 }} onClick={reset}>İlk sıraya döndür</button>
    </div></div>
  );
}
