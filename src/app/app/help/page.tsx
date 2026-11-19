import type { Metadata } from "next";
import { HelpView } from "@/components/memora/help-view";

export const metadata: Metadata = { title: "Довідка · Memora" };

export default function HelpPage() {
  return <HelpView />;
}
