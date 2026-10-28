import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { Footer, Header } from "@/components/Header";
import { SessionProvider } from "@/components/Session";
import { ldJson, SITE_URL } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "almakisterim.com – Ne almak istediğinizi yazın, satıcılar size ulaşsın", template: "%s · almakisterim.com" },
  description: "Türkiye'nin alım talebi sitesi: araç, ev, telefon, eşya ya da hizmet… Ne almak istediğinizi ücretsiz yazın, elinde olan satıcılar size ulaşsın. Satıcılar almak isteyen müşteriyi burada bulur.",
  openGraph: { type: "website", locale: "tr_TR", siteName: "almakisterim.com", images: [{ url: "/logo.png" }] },
  twitter: { card: "summary_large_image" },
  applicationName: "almakisterim",
  appleWebApp: { capable: true, title: "almakisterim", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#13235B", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        {/* Arama motorları için şirket ve site bilgisi; site içi arama Google sonuçlarında kutu olarak görünebilir. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson([
          { "@context": "https://schema.org", "@type": "Organization", name: "almakisterim.com", url: SITE_URL, logo: `${SITE_URL}/logo.png` },
          { "@context": "https://schema.org", "@type": "WebSite", name: "almakisterim.com", url: SITE_URL, inLanguage: "tr-TR",
            potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/kategori?q={search_term_string}`, "query-input": "required name=search_term_string" } },
        ]) }} />
        <SessionProvider>
          <Header />
          <main className="page-min">{children}</main>
          <Footer />
          <AppShell />
        </SessionProvider>
      </body>
    </html>
  );
}
