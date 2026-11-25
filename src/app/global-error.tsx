"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/memora/report-client";

// Last resort: the root layout itself failed, so no Tailwind/fonts — plain inline styles.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!error.digest) reportClientError(error);
  }, [error]);

  return (
    <html lang="uk">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "grid",
          placeItems: "center",
          background: "#06080c",
          color: "#e8edf3",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 18 }}>Щось пішло не так</h1>
          <p style={{ color: "#9aa6b5", fontSize: 14, lineHeight: 1.5 }}>
            Ми вже отримали звіт про помилку. Спробуй ще раз.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 16, padding: "12px 20px", borderRadius: 12, border: 0, background: "#3ee0bf", color: "#06080c", fontWeight: 600, fontSize: 14 }}
          >
            Спробувати ще раз
          </button>
        </div>
      </body>
    </html>
  );
}
