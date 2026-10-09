import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #6cf0d6 0%, #9b8cff 100%)",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32">
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
    size,
  );
}
