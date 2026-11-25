import { ImageResponse } from "next/og";

/**
 * The app icon as a PNG at any size. "maskable" fills the whole square and keeps
 * the glyph inside the central safe zone (Android crops it to its own shape);
 * the regular icon is a rounded square on transparency.
 */
export function appIconResponse(size: number, variant: "any" | "maskable" | "apple") {
  const glyph = Math.round(size * (variant === "maskable" ? 0.5 : 0.66));
  const radius = variant === "any" ? Math.round(size * 0.22) : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius,
          background: "linear-gradient(135deg, #6cf0d6 0%, #9b8cff 100%)",
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 32 32">
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
    ),
    { width: size, height: size },
  );
}
