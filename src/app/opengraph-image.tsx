import { ImageResponse } from "next/og";

// Link preview for the landing (Telegram, Facebook, etc.). Rendered once at build.
export const alt = "Memora — англійські слова, які ти згадаєш, а не лише впізнаєш";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const title = "Англійські слова, які ти згадаєш, а не лише впізнаєш";
const facts = ["Спершу згадай", "Повтори за FSRS", "6 типів вправ"];
const card = "I finally _____ it _____.";

/** Geist with Cyrillic, subset to the glyphs used; null if Google Fonts is unreachable. */
async function loadFont(weight: number, text: string) {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Geist:wght@${weight}&text=${encodeURIComponent(text)}`,
    ).then((response) => response.text());
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((response) => response.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const text = ["Memora", title, ...facts, card, "Встав пропущене слово", "figured out"].join("");
  const [semibold, regular] = await Promise.all([loadFont(600, text), loadFont(400, text)]);
  const fonts = [
    ...(semibold ? [{ name: "Geist", data: semibold, weight: 600 as const, style: "normal" as const }] : []),
    ...(regular ? [{ name: "Geist", data: regular, weight: 400 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "64px 72px",
          fontFamily: "Geist",
          color: "#edf2f9",
          background:
            "radial-gradient(60% 70% at 85% 10%, rgba(62,224,191,0.22), transparent 70%), radial-gradient(40% 60% at 5% 0%, rgba(155,140,255,0.18), transparent 70%), #06080c",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #6cf0d6 0%, #9b8cff 100%)",
              }}
            >
              <svg width={44} height={44} viewBox="0 0 32 32">
                <path
                  d="M9 22.5V11.9c0-.9 1.1-1.4 1.8-.7L16 16.7l5.2-5.5c.7-.7 1.8-.2 1.8.7v10.6"
                  fill="none"
                  stroke="#03120f"
                  strokeWidth="2.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="16" cy="8.3" r="1.8" fill="#03120f" />
              </svg>
            </div>
            <span style={{ fontSize: 38, fontWeight: 600 }}>Memora</span>
          </div>
          <div style={{ display: "flex", fontSize: 62, fontWeight: 600, lineHeight: 1.1, maxWidth: 640 }}>
            {title}
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            {facts.map((fact) => (
              <div
                key={fact}
                style={{
                  display: "flex",
                  fontSize: 22,
                  color: "#b9c4d2",
                  border: "1px solid #2c3747",
                  borderRadius: 999,
                  padding: "8px 20px",
                  lineHeight: 1.3,
                }}
              >
                {fact}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 400,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              borderRadius: 32,
              border: "1px solid #2c3747",
              background: "linear-gradient(180deg, #161d27 0%, #10151d 100%)",
              padding: "40px 28px",
            }}
          >
            <span style={{ fontSize: 20, color: "#7d8a9c" }}>Встав пропущене слово</span>
            <span style={{ marginTop: 16, fontSize: 30, fontWeight: 600, textAlign: "center" }}>{card}</span>
            <div
              style={{
                marginTop: 32,
                width: "100%",
                height: 60,
                borderRadius: 16,
                border: "2px solid #3ee0bf",
                display: "flex",
                alignItems: "center",
                padding: "0 18px",
                fontSize: 24,
                color: "#edf2f9",
              }}
            >
              figured out
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
