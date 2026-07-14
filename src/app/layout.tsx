import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Memora",
  description: "Регулярне пригадування для англійських слів і QA-термінів.",
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
