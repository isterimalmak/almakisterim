import type { Metadata } from "next";

// Alıcıların arama motorundan geldiği sayfa ("alım ilanı ver", "almak istiyorum"): dizinde kalır.
export const metadata: Metadata = {
  title: "Ücretsiz Alım Talebi Ver – Ne Almak İstediğinizi Yazın",
  description: "Almak istediğiniz ürün ya da hizmeti tek cümleyle yazın, elinde olan satıcılar size ulaşsın. Talep vermek ücretsiz; numaranız yalnızca sınırlı sayıda satıcıya açılır.",
  alternates: { canonical: "/talep-ver" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
