"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { LogoMark } from "./brand";
import { Button, StatusBanner } from "./shared-ui";
import { formatError } from "./utils";
import { hardNavigate } from "./hard-navigate";

/** Shown to signed-in accounts whose email is not on the beta allowlist. */
export function BetaScreen({ email }: { email: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function signOut() {
    setIsBusy(true);
    try {
      const { error: signOutError } = await createSupabaseBrowserClient().auth.signOut();
      if (signOutError) throw signOutError;
      hardNavigate("/");
    } catch (signOutError) {
      setError(formatError(signOutError));
      setIsBusy(false);
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-ink px-6 text-text">
      <div className="max-w-sm text-center">
        <LogoMark className="mx-auto size-12" />
        <h1 className="mt-5 text-xl font-semibold tracking-tight">Закрита бета</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Memora поки працює лише для запрошених.
          {email ? (
            <>
              {" "}Акаунт <span className="text-text-2">{email}</span> ще не має доступу.
            </>
          ) : null}{" "}
          Коли відкриємо реєстрацію, ти зможеш увійти з цим самим email.
        </p>
        {error ? <StatusBanner className="mt-4 text-left" tone="error" message={error} /> : null}
        <Button className="mt-6" icon={LogOut} isLoading={isBusy} onClick={() => void signOut()}>
          Вийти
        </Button>
      </div>
    </main>
  );
}
