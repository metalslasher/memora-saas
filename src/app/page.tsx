import { LandingPage } from "@/components/memora/landing-page";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/memora/share";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && next) redirect(next);
  return <LandingPage isSignedIn={Boolean(user)} next={next} />;
}
