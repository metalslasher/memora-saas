"use client";

import { RotateCw } from "lucide-react";
import { LogoMark } from "@/components/memora/brand";
import { Button } from "@/components/memora/shared-ui";
import { formatError } from "@/components/memora/utils";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto grid min-h-[50svh] max-w-sm place-items-center text-center">
      <div>
        <LogoMark className="mx-auto size-12" />
        <h1 className="mt-5 text-lg font-semibold">Не вдалося завантажити дані</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {error.digest ? "Сервер не відповів як слід. Спробуй ще раз за хвилину." : formatError(error)}
        </p>
        <Button className="mt-5" icon={RotateCw} variant="primary" onClick={reset}>
          Спробувати ще раз
        </Button>
      </div>
    </div>
  );
}
