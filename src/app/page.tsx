import { Landing } from "@/components/memora/landing/landing";

// Static page: sign-in state is read on the client, ?next= is handled by the proxy.
export const dynamic = "force-static";

export default function Home() {
  return <Landing />;
}
