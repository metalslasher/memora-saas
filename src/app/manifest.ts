import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Memora — тренажер пам’яті",
    short_name: "Memora",
    description:
      "Англійські слова й QA-терміни через активне пригадування та інтервальні повторення.",
    start_url: "/",
    display: "standalone",
    background_color: "#06080c",
    theme_color: "#06080c",
    lang: "uk",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
