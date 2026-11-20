import type { Metadata } from "next";
import { SettingsWorkspace } from "@/components/memora/settings-workspace";
import { countLibrary } from "@/lib/memora/data/backup";
import { getAppContext } from "@/lib/memora/data/context";

export const metadata: Metadata = { title: "Профіль · Memora" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ recovery?: string }>;
}) {
  const [{ supabase, user, profile }, params] = await Promise.all([getAppContext(), searchParams]);
  const counts = await countLibrary(supabase);
  const snapshot = crypto.randomUUID();

  return (
    <SettingsWorkspace
      key={snapshot}
      counts={counts}
      email={user.email ?? null}
      isRecovery={params.recovery === "1"}
      dailyMinutes={profile.dailyMinutes}
      snapshot={snapshot}
    />
  );
}
