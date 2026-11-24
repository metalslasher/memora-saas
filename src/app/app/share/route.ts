import { NextResponse, type NextRequest } from "next/server";
import { classifyShare, shareRedirectPath } from "@/lib/memora/share";

/**
 * Web Share Target endpoint. The manifest declares GET; POST (form data) is
 * accepted too. The proxy has already sent guests to sign in and back here.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return land(request, { title: params.get("title"), text: params.get("text"), url: params.get("url") });
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const field = (name: string) => {
    const value = form?.get(name);
    return typeof value === "string" ? value : null;
  };
  return land(request, { title: field("title"), text: field("text"), url: field("url") });
}

function land(request: NextRequest, shared: { title: string | null; text: string | null; url: string | null }) {
  // 303: the browser follows a POST with a GET.
  return NextResponse.redirect(new URL(shareRedirectPath(classifyShare(shared)), request.url), 303);
}
