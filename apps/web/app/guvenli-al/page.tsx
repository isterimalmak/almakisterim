"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { STATUS_CLASS, tl, useSafeInfo, type SafeListItem } from "@/components/Safe";
import { useSession } from "@/components/Session";
import { api } from "@/lib/api";
import { dateTr } from "@/lib/format";

// Güvenli Al tanıtımı ve üyenin alış/satışları.
export default function SafeHome() {
  const { user, ready, showSafe } = useSession();
  const info = useSafeInfo();
  const [items, setItems] = useState<SafeListItem[] | null>(null);
  useEffect(() => { if (user) void api<{ items: SafeListItem[] }>("/safe/sales").then((r) => setItems(r.items)).catch(() => setItems([])); }, [user]);

  // Yönetimden gizlendiyse (Ayarlar → Ödeme bölümleri) sayfa kapalı görünür.
  if (ready && !showSafe) return <div className="wrap" style={{ maxWidth: 720, padding: "30px 16px" }}><div className="box"><div className="empty">Bu bölüm şu anda kullanılmıyor. <Link className="link" href="/">Ana sayfaya dön</Link></div></div></div>;
  return (
    <div className="wrap safe-page">
      <div className="crumb"><Link href="/">Ana Sayfa</Link> › Güvenli Al</div>
      <section className="safe-hero">
        <Icon name="shield" size={40} />
        <div>
          <h1>Güvenli Al</h1>
          <p>Paranız, ürünü teslim alıp onaylayana kadar almakisterim güvencesinde bekler. Satıcı ödemesini ürün size ulaşınca alır.</p>
        </div>
      </section>

      <ol className="safe-how">
        <li><b>1</b><div><strong>Satıcı satışı başlatır</strong><span>Talebinize yazan satıcıyla fiyatta anlaşınca satıcı “Güvenli Al ile sat” der.</span></div></li>
        <li><b>2</b><div><strong>Siz kartla ödersiniz</strong><span>Ödeme lisanslı ödeme kuruluşunun güvenli sayfasında yapılır; para satıcıya geçmez, bizde bekler.</span></div></li>
        <li><b>3</b><div><strong>Satıcı kargolar</strong><span>{info ? `${info.ship_days} gün` : "Birkaç gün"} içinde kargolayıp takip numarasını girer; kargolamazsa paranız otomatik iade edilir.</span></div></li>
        <li><b>4</b><div><strong>Onaylarsınız, para satıcıya geçer</strong><span>Ürünü kontrol edip “Ürünü aldım” dersiniz. Sorun varsa bildirin; ekibimiz inceler, haklıysanız paranız iade edilir.</span></div></li>
      </ol>

      {info && (
        <div className="safe-fees-box">
          <div><small>Alıcı için</small><b>%{info.buyer_pct.toLocaleString("tr-TR")}</b><span>hizmet bedeli</span></div>
          <div><small>Satıcı için</small><b>%{info.seller_pct.toLocaleString("tr-TR")}</b><span>komisyon (en az {info.min_fee} TL, en fazla {info.max_fee.toLocaleString("tr-TR")} TL)</span></div>
          <div><small>Kimler kullanabilir</small><b>Kargolanabilen ürünler</b><span>Emlak ve vasıta alımlarında kullanılmaz.</span></div>
        </div>
      )}
      {info && !info.enabled && <div className="note n-info" style={{ marginBottom: 14 }}><span>Güvenli Al çok yakında açılıyor.</span></div>}

      {user ? (
        <div className="box">
          <div className="box-h"><h2>Güvenli Al alış ve satışlarım</h2></div>
          {!items ? <div className="loading">Yükleniyor…</div> : !items.length ? <div className="empty">Henüz Güvenli Al ile alış ya da satışınız yok.</div> : (
            <table className="tbl"><thead><tr><th>Ürün</th><th>Tutar</th><th>Tarih</th><th>Durum</th></tr></thead><tbody>
              {items.map((s) => (
                <tr key={s.id} className="row" onClick={() => { window.location.href = `/guvenli-al/${s.id}`; }}>
                  <td><Link className="ti-t" href={`/guvenli-al/${s.id}`}>{s.title}</Link><div className="ti-s">{s.role === "alici" ? `Alış · satıcı ${s.other_name}` : `Satış · alıcı ${s.other_name}`} · No {s.id}</div></td>
                  <td data-m="Tutar" className="nowrap">{tl(s.role === "alici" ? s.total : s.price)}</td>
                  <td data-m="Tarih" className="nowrap muted">{dateTr(s.created_at)}</td>
                  <td data-m="Durum"><span className={"lbl " + (STATUS_CLASS[s.status] ?? "l-gy")}>{s.status_text}</span></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
      ) : <div className="box"><div className="empty">Alış ve satışlarınızı görmek için <Link className="link" href="/giris?sonra=/guvenli-al">giriş yapın</Link>.</div></div>}
    </div>
  );
}
