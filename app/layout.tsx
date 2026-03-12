import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Operação 2D • Diário de Bordo",
  description: "Diário de bordo diário com integração ao Notion."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
