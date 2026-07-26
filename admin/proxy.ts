import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/proxy";

// Named `proxy.ts`, not `middleware.ts` -- this Next.js version (16)
// deprecated and renamed the `middleware` file convention to `proxy`
// (confirmed against node_modules/next/dist/docs/.../proxy.md before
// writing this). Same execution model: runs on every matched request,
// before rendering.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
