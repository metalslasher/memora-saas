import { appIconResponse } from "@/lib/memora/app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIconResponse(180, "apple");
}
