export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export function ok<T = null>(data: T = null as T): ActionResult<T> {
  return { ok: true, data };
}

/** Converts any thrown value into a message for the UI (Ukrainian where ours). */
export function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof Error && error.message) return { ok: false, error: error.message };
  if (typeof error === "object" && error && "message" in error) {
    return { ok: false, error: String((error as { message?: unknown }).message ?? "Невідома помилка.") };
  }
  return { ok: false, error: "Щось пішло не так. Спробуй ще раз." };
}

/** Client helper: returns the data or throws the action's error. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
