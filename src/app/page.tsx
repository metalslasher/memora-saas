import { LandingPage } from "@/components/memora/landing-page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <LandingPage isSignedIn={Boolean(user)} />;
}
