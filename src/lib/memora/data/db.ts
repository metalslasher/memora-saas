import type { PostgrestSingleResponse, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { StoredSchedule } from "../types";

export type Db = SupabaseClient<Database>;

type CardsRow = Database["public"]["Tables"]["cards"]["Row"];
type ScheduleColumns = Pick<
  CardsRow,
  | "due"
  | "stability"
  | "difficulty"
  | "elapsed_days"
  | "scheduled_days"
  | "learning_steps"
  | "reps"
  | "lapses"
  | "state"
  | "last_review"
>;

export const scheduleColumns =
  "due,stability,difficulty,elapsed_days,scheduled_days,learning_steps,reps,lapses,state,last_review";

export function scheduleFromRow(row: ScheduleColumns): StoredSchedule {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.last_review ?? null,
  };
}

export function scheduleToRow(schedule: StoredSchedule): ScheduleColumns {
  return {
    due: schedule.due,
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    elapsed_days: schedule.elapsed_days,
    scheduled_days: schedule.scheduled_days,
    learning_steps: schedule.learning_steps,
    reps: schedule.reps,
    lapses: schedule.lapses,
    state: schedule.state,
    last_review: schedule.last_review,
  };
}

/** Returns the data of a query that must return something; throws otherwise. */
export function must<T>(result: PostgrestSingleResponse<T>): NonNullable<T> {
  if (result.error) throw result.error;
  if (result.data === null || result.data === undefined) throw new Error("Запис не знайдено.");
  return result.data;
}

/** Returns the data of a query that may legitimately find nothing. */
export function maybe<T>(result: PostgrestSingleResponse<T>): T | null {
  if (result.error) throw result.error;
  return result.data;
}

/** For writes without a returned row: only surfaces the error. */
export function check(result: { error: unknown }) {
  if (result.error) throw result.error;
}

export function isUniqueViolation(error: unknown) {
  return errorCode(error) === "23505";
}

export function isRlsViolation(error: unknown) {
  return errorCode(error) === "42501";
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
}
