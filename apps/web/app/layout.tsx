import type { Metadata, Viewport } from "next";
import { Footer, Header } from "@/components/Header";
import { SessionProvider } from "@/components/Session";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "almakisterim.com", template: "%s · almakisterim.com" },
  description: "Ne almak istediğinizi yazın, satıcılar size teklif versin. Alıcıların ilan verdiği tersine pazaryeri.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#13235B" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <SessionProvider>
          <Header />
          <main className="page-min">{children}</main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
