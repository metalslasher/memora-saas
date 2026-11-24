"use server";

import { requireActionContext } from "../data/context";
import { getPracticeSummary } from "../data/practice";
import { getProfile, saveOnboarding, updateGoals } from "../data/profile";
import { runDailyFeed } from "../data/program";
import { isDailyMinutes } from "../pace";
import { cleanGoals, startingPosition, type Goal } from "../program";
import { rebuildTest, scoreTest } from "../vocab-test";
import { vocabTestPool } from "../vocab-test-pool";
import { fail, ok, type ActionResult } from "./result";

export type OnboardingInput = {
  /** null = the test was skipped. */
  test: { answers: Array<{ word: string; yes: boolean }>; checks: Array<{ word: string; correct: boolean }> } | null;
  goals: Goal[];
  dailyMinutes: number;
};

/**
 * Saves onboarding (test result is re-scored on the server from the answers),
 * sets the program position and runs the first daily feed, so practice has
 * words right away.
 */
export async function completeOnboardingAction(input: OnboardingInput): Promise<ActionResult<{ added: number }>> {
  try {
    if (!isDailyMinutes(input?.dailyMinutes)) throw new Error("Обери, скільки хвилин на день.");
    const goals = cleanGoals(input.goals);
    if (goals.length === 0) throw new Error("Обери хоча б одну ціль.");
    const { supabase, user } = await requireActionContext();
    const current = await getProfile(supabase, user.id);
    if (!current) throw new Error("Профіль не знайдено. Онови сторінку.");

    let result = null;
    let position;
    if (input.test) {
      const { state, checks } = rebuildTest(vocabTestPool, input.test.answers ?? [], input.test.checks ?? []);
      if (state.items.length === 0) throw new Error("Відповідей тесту не видно. Пройди тест ще раз.");
      result = scoreTest(state, checks);
      position = startingPosition(result.vocab);
    } else if (current.knownRank !== null && current.programRank !== null) {
      // Skipped a retake: keep the position the previous test and practice set.
      position = { knownRank: current.knownRank, programRank: current.programRank };
    } else {
      position = startingPosition(0);
    }

    const profile = await saveOnboarding(supabase, user.id, {
      result,
      position,
      goals,
      dailyMinutes: input.dailyMinutes,
    });
    const summary = await getPracticeSummary(supabase, profile.timezone);
    const added = await runDailyFeed(supabase, profile, summary);
    return ok({ added });
  } catch (error) {
    return fail(error);
  }
}

export async function updateGoalsAction(goals: Goal[]): Promise<ActionResult<Goal[]>> {
  try {
    const clean = cleanGoals(goals);
    if (clean.length === 0) throw new Error("Обери хоча б одну ціль.");
    const { supabase, user } = await requireActionContext();
    return ok(cleanGoals(await updateGoals(supabase, user.id, clean)));
  } catch (error) {
    return fail(error);
  }
}
