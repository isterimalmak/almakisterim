import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { Footer, Header } from "@/components/Header";
import { SessionProvider } from "@/components/Session";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "almakisterim.com", template: "%s · almakisterim.com" },
  description: "Ne almak istediğinizi yazın, satıcılar size ulaşsın. Alıcıların ilan verdiği tersine pazaryeri.",
  applicationName: "almakisterim",
  appleWebApp: { capable: true, title: "almakisterim", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#13235B", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
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
