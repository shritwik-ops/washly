import { cache } from "react";
import { createClient } from "./supabase/server";

export type AdminRole =
  | "super_admin"
  | "operations_admin"
  | "support_admin"
  | "finance_admin"
  | "college_admin";

export interface CurrentAdmin {
  id: string;
  email: string;
  role: AdminRole;
}

// Single source of truth for "who is the logged-in admin and what's their
// role" -- the dashboard placeholder previously inlined this query itself;
// now the layout (for the sidebar) and any page that needs it call this
// instead. Wrapped in React's cache() so multiple calls within the same
// request (layout + page both need it) dedupe to one query rather than
// re-fetching per component, same pattern the Next.js DAL docs recommend.
//
// proxy.ts already guarantees a valid session + matching admin_users row
// before any request reaches here, so a null return would mean something
// is wrong with that guarantee, not an expected "not logged in" case.
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!adminRow) return null;

  return { id: user.id, email: user.email ?? "", role: adminRow.role as AdminRole };
});
