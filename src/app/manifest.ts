import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Memora — англійські слова",
    short_name: "Memora",
    description: "Англійські слова й фрази: активне пригадування та інтервальні повторення.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#06080c",
    theme_color: "#06080c",
    lang: "uk",
    categories: ["education"],
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    // Android "Share → Memora": a word goes to "Add word", a longer text to "From a text".
    share_target: {
      action: "/app/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    shortcuts: [
      { name: "Додати слово", url: "/app/words?add=", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
