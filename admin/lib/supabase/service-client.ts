import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@washly/shared";

// Service-role client -- bypasses RLS entirely. `server-only` makes any
// accidental import from a Client Component a build error, not just a
// runtime leak, and SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix
// so Next never inlines it into a client bundle regardless.
//
// Used for exactly one thing: auth.admin.inviteUserByEmail() when adding
// a new admin (creating an auth.users row requires the Admin API, which
// requires this key -- there's no anon-key equivalent). Every other
// admin_users read/write in this feature goes through the normal
// cookie-bound server client so it stays subject to RLS, not bypassed by
// default just because this client exists.
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
