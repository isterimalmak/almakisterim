import type { MetadataRoute } from "next";

// Telefonda "Ana ekrana ekle" ile uygulama gibi açılır (adres çubuğu olmadan).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "almakisterim.com",
    short_name: "almakisterim",
    description: "Ne almak istediğinizi yazın, satıcılar size teklif versin.",
    lang: "tr",
    start_url: "/?kaynak=uygulama",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F4F7",
    theme_color: "#13235B",
    categories: ["shopping", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Talep Ver", url: "/talep-ver", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Tüm Talepler", url: "/kategori", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Bana Özel", url: "/bana-ozel", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
