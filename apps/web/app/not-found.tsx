import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap" style={{ padding: "40px 16px" }}>
      <div className="box"><div className="empty">Aradığınız sayfa bulunamadı. <Link className="link" href="/">Ana sayfaya dönün</Link>.</div></div>
    </div>
  );
}
