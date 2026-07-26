import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@washly/shared";

// Browser-side client for Client Components. Session storage/refresh is
// cookie-based (via @supabase/ssr), not localStorage -- that's what lets
// the server (proxy.ts, Server Components, Server Actions) read the same
// session, unlike mobile's AsyncStorage-backed client in lib/supabase.ts.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
