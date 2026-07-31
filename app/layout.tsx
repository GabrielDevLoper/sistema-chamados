import type { Metadata, Viewport } from "next";
import { DM_Sans, Libre_Baskerville } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const libre = Libre_Baskerville({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host =
    incomingHeaders.get("x-forwarded-host") ??
    incomingHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    incomingHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const image = new URL("/og.png", `${protocol}://${host}`).toString();

  return {
    title: "Atendimento simples. Filas organizadas.",
    description:
      "Retirada de senhas e gestão de atendimento em uma fila integrada.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Atendimento simples. Filas organizadas.",
      description:
        "Retirada de senhas e gestão de atendimento em uma fila integrada.",
      images: [{ url: image, width: 1730, height: 909 }],
      locale: "pt_BR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Atendimento simples. Filas organizadas.",
      description:
        "Retirada de senhas e gestão de atendimento em uma fila integrada.",
      images: [image],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#123d3a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${dmSans.variable} ${libre.variable}`}>{children}</body>
    </html>
  );
}
