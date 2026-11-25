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
  // Only small counters use it; preloading would compete with the main font on slow phones.
  preload: false,
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const description =
  "Тренажер англійських слів для україномовних: спершу згадуєш сам, потім бачиш відповідь, а повтори приходять саме тоді, коли слово починає забуватися. 10–15 хвилин на день.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Memora — англійські слова, які ти згадаєш",
  description,
  applicationName: "Memora",
  openGraph: {
    title: "Memora — англійські слова, які ти згадаєш, а не лише впізнаєш",
    description,
    type: "website",
    locale: "uk_UA",
    siteName: "Memora",
  },
  twitter: { card: "summary_large_image" },
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
