import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@washly/shared";

// Server-side client for Server Components and Server Actions. Reads/
// writes the session via Next's cookies() API (async in this Next
// version) rather than any storage adapter.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component, which can't set cookies on
            // the response -- fine as long as proxy.ts is also refreshing
            // the session on every request (it is), so this is a
            // read-only path here, not a lost session write.
          }
        },
      },
    }
  );
}
