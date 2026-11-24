import { appIconResponse } from "@/lib/memora/app-icon";

/** PNG icons for the web app manifest, rendered once at build time. */
const icons = {
  "icon-192.png": [192, "any"],
  "icon-512.png": [512, "any"],
  "maskable-192.png": [192, "maskable"],
  "maskable-512.png": [512, "maskable"],
} as const;

type IconName = keyof typeof icons;

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(icons).map((icon) => ({ icon }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ icon: string }> }) {
  const { icon } = await params;
  const entry = icons[icon as IconName];
  if (!entry) return new Response("Not found", { status: 404 });
  return appIconResponse(entry[0], entry[1]);
}
