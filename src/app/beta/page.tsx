import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BetaScreen } from "@/components/memora/beta-screen";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Закрита бета · Memora" };

export default async function BetaPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return <BetaScreen email={user.email ?? null} />;
}
