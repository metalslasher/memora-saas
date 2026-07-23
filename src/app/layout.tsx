import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Memora — англійські слова та QA-терміни",
  description:
    "Коротка практика для англійських слів і QA-термінів із розумним розкладом повторень.",
  openGraph: {
    title: "Memora — запам’ятовуй надовго",
    description:
      "Англійські слова й QA-терміни через активне пригадування та розумні повторення.",
    type: "website",
    locale: "uk_UA",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className="h-full" suppressHydrationWarning>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
