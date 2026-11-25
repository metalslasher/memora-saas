"use server";

import { requireActionContext } from "../data/context";
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
  PracticeSummary,
  ReviewOutcome,
  ReviewRating,
  StoredSchedule,
} from "../types";
import { validateCardStatus, validateId, validateReviewInput } from "../validation";
import { fail, ok, type ActionResult } from "./result";

/** Grades one card; the client has already moved on optimistically. */
export async function gradeCardAction(input: {
  cardId: string;
  rating: ReviewRating;
  responseText: string;
  elapsedMs: number;
}): Promise<ActionResult<ReviewOutcome>> {
  try {
    const review = validateReviewInput(input);
    const { supabase } = await requireActionContext();
    return ok(await gradeCard(supabase, review));
  } catch (error) {
    return fail(error);
  }
}

export async function undoReviewAction(
  logId: string,
): Promise<ActionResult<{ cardId: string; schedule: StoredSchedule }>> {
  try {
    const cleanId = validateId(logId, "Оцінку");
    const { supabase } = await requireActionContext();
    return ok(await undoReview(supabase, cleanId));
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
