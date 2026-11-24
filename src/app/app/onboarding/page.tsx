import type { Metadata } from "next";
import { OnboardingFlow } from "@/components/memora/onboarding-flow";
import { getAppContext } from "@/lib/memora/data/context";
import { cleanGoals } from "@/lib/memora/program";

export const metadata: Metadata = { title: "Рівень і цілі · Memora" };

export default async function OnboardingPage() {
  const { profile } = await getAppContext();
  return (
    <OnboardingFlow
      initialGoals={cleanGoals(profile.goals)}
      initialMinutes={profile.dailyMinutes}
      isRetake={profile.onboardedAt !== null}
    />
  );
}
