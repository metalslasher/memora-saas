import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Memora — тренажер пам’яті для англійської та QA",
  description:
    "Згадуй, а не перечитуй. Memora тренує англійські слова й QA-терміни через активне пригадування та розумні інтервальні повторення.",
  applicationName: "Memora",
  openGraph: {
    title: "Memora — запам’ятовуй надовго",
    description:
      "Англійські слова й QA-терміни через активне пригадування та інтервальні повторення.",
    type: "website",
    locale: "uk_UA",
  },
  appleWebApp: {
    capable: true,
    title: "Memora",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#06080c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      className={`h-full ${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-ink text-text antialiased">{children}</body>
    </html>
  );
}
