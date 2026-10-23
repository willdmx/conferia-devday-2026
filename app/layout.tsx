import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conferia — O combinado, conferido.",
  description: "Compare um contrato fictício com suas entregas. Quantidades, prazos e valores, com evidências e revisão humana.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
