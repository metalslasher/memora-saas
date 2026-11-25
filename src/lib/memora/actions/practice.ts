"use server";

import { requireActionContext } from "../data/context";
import { syncGoalDay } from "../data/goal";
import {
  getPracticeSession,
  gradeCard,
  setCardStatus,
  undoReview,
} from "../data/practice";
import { getProfile } from "../data/profile";
import type {
  CardStatus,
  PracticeCard,
  GoalSync,
  PracticeSummary,
  ReviewOutcome,
  ReviewRating,
  StoredSchedule,
} from "../types";
import { validateCardStatus, validateId, validateReviewInput } from "../validation";
import { fail, ok, type ActionResult } from "./result";

/** Re-checks today's goal; a failure here must never lose the review itself. */
async function syncGoalSafely(
  db: Parameters<typeof syncGoalDay>[0],
  userId: string,
  wasMet: boolean,
): Promise<GoalSync | null> {
  try {
    const profile = await getProfile(db, userId);
    return profile ? await syncGoalDay(db, profile, wasMet) : null;
  } catch {
    return null;
  }
}

/** Grades one card; the client has already moved on optimistically. */
export async function gradeCardAction(input: {
  cardId: string;
  rating: ReviewRating;
  responseText: string;
  elapsedMs: number;
  countedMs: number;
  /** The client already shows today's goal as met: nothing to re-check. */
  goalMet: boolean;
}): Promise<ActionResult<ReviewOutcome & { goal: GoalSync | null }>> {
  try {
    const review = validateReviewInput(input);
    const { supabase, user } = await requireActionContext();
    const outcome = await gradeCard(supabase, review);
    const goal = input.goalMet === true ? null : await syncGoalSafely(supabase, user.id, false);
    return ok({ ...outcome, goal });
  } catch (error) {
    return fail(error);
  }
}

export async function undoReviewAction(
  logId: string,
  goalMet: boolean,
): Promise<ActionResult<{ cardId: string; schedule: StoredSchedule; goal: GoalSync | null }>> {
  try {
    const cleanId = validateId(logId, "Оцінку");
    const { supabase, user } = await requireActionContext();
    const undone = await undoReview(supabase, cleanId);
    return ok({ ...undone, goal: await syncGoalSafely(supabase, user.id, goalMet === true) });
  } catch (error) {
    return fail(error);
  }
}

export async function setCardStatusAction(
  cardId: string,
  status: CardStatus,
): Promise<ActionResult> {
  try {
    const cleanId = validateId(cardId, "Картку");
    const cleanStatus = validateCardStatus(status);
    const { supabase } = await requireActionContext();
    await setCardStatus(supabase, cleanId, cleanStatus);
    return ok();
  } catch (error) {
    return fail(error);
  }
}

/** Reloads the session cards, allowing `extraNew` new words beyond today's pace. */
export async function loadPracticeAction(
  extraNew: number,
): Promise<ActionResult<{ cards: PracticeCard[]; summary: PracticeSummary }>> {
  try {
    const extra = Number.isInteger(extraNew) ? Math.min(Math.max(extraNew, 0), 100) : 0;
    const { supabase, user } = await requireActionContext();
    const profile = await getProfile(supabase, user.id);
    if (!profile) throw new Error("Профіль не знайдено. Онови сторінку.");
    return ok(await getPracticeSession(supabase, profile, extra));
  } catch (error) {
    return fail(error);
  }
}
