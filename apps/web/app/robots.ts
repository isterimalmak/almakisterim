import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// /robots.txt: üye ve yönetim sayfaları ile API arama motorlarına kapalı; site haritasının adresi bildirilir.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/yonetim", "/bana-ozel", "/giris", "/guvenli-al/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
