import type { Metadata } from "next";

// Üyeye özel / işlem sayfası: arama motorlarında listelenmez.
export const metadata: Metadata = { title: "Giriş Yap", robots: { index: false, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
