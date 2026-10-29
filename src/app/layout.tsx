import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sideria Flow",
    template: "%s | Sideria Flow",
  },
  description:
    "Plataforma de gestión de solicitudes de compra para empresas. Flujos de aprobación, trazabilidad y reportes en tiempo real.",
  keywords: ["solicitudes de compra", "aprobaciones", "gestión empresarial"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
