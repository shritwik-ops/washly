"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdmin } from "@/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service-client";

const PLATFORM_ROLES = [
  "super_admin",
  "operations_admin",
  "support_admin",
  "finance_admin",
] as const;

// college_admin is a 5th valid role but, unlike the other 4, requires a
// college_id -- admin_users_college_scope's check constraint enforces
// exactly this split (platform roles => college_id null, college_admin
// => college_id not null). Validating it here isn't redundant with that
// constraint; it's the difference between a clear form error and a raw
// constraint-violation message, and more importantly it runs BEFORE the
// invite email goes out, not after.
const ALL_ROLES = [...PLATFORM_ROLES, "college_admin"] as const;

export type InviteState = { error?: string; success?: string } | undefined;

export async function inviteAdmin(
  _prevState: InviteState,
  formData: FormData
): Promise<InviteState> {
  // Re-checked here independently of the page's own redirect -- a page
  // guard doesn't stop a direct call to this action from another route.
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== "super_admin") {
    return { error: "Not authorized." };
  }

  const fullName = (formData.get("full_name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim();
  const role = formData.get("role") as string | null;
  const collegeId = (formData.get("college_id") as string | null)?.trim() || null;

  if (!fullName || !email || !role) {
    return { error: "Fill in all fields." };
  }
  if (!ALL_ROLES.includes(role as (typeof ALL_ROLES)[number])) {
    return { error: "Invalid role." };
  }

  const isCollegeAdmin = role === "college_admin";
  if (isCollegeAdmin && !collegeId) {
    return { error: "Select a college for a College Admin." };
  }
  if (!isCollegeAdmin && collegeId) {
    return { error: `${role} is platform-wide and shouldn't have a college selected.` };
  }

  const supabase = await createClient();

  if (isCollegeAdmin) {
    // Confirm the college actually exists before sending any invite --
    // colleges_select_active_or_admin already lets super_admin see every
    // college (active or not), so this is a real existence check, not
    // just trusting whatever id the form posted.
    const { data: college } = await supabase
      .from("colleges")
      .select("id")
      .eq("id", collegeId!)
      .maybeSingle();
    if (!college) {
      return { error: "That college doesn't exist." };
    }
  }

  // inviteUserByEmail, not signUp -- there's no password field on this
  // form. This creates the auth.users row and emails the new admin a link
  // to set their own password; only the Admin API (service-role key) can
  // do this, which is why this is the one place in the admin panel that
  // touches the service-role client. Deliberately the LAST validation
  // step -- everything above must pass first so a malformed submission
  // never triggers a real invite email.
  const serviceClient = createServiceClient();
  const { data: invited, error: inviteError } =
    await serviceClient.auth.admin.inviteUserByEmail(email);

  if (inviteError || !invited?.user) {
    return { error: inviteError?.message ?? "Could not send the invite." };
  }

  // Back to the normal cookie-bound client for the admin_users row --
  // RLS's admin_users_insert_super_admin policy already permits this
  // caller's own session to do it, no service-role needed here.
  const { error: insertError } = await supabase.from("admin_users").insert({
    id: invited.user.id,
    role,
    full_name: fullName,
    email,
    college_id: collegeId,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  await supabase.rpc("log_admin_action", {
    p_action: "invite_admin",
    p_target_table: "admin_users",
    p_target_id: invited.user.id,
    p_detail: { email, role, full_name: fullName, college_id: collegeId },
  });

  revalidatePath("/admin-users");
  return { success: `Invited ${email} as ${role}.` };
}

export async function deactivateAdmin(targetId: string) {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== "super_admin") {
    throw new Error("Not authorized.");
  }
  // Obvious footgun per the requirement: a super_admin locking themselves
  // out with no other super_admin around to undo it.
  if (admin.id === targetId) {
    throw new Error("You can't deactivate your own account.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_users")
    .update({ is_active: false })
    .eq("id", targetId);

  if (error) {
    throw new Error(error.message);
  }

  await supabase.rpc("log_admin_action", {
    p_action: "deactivate_admin",
    p_target_table: "admin_users",
    p_target_id: targetId,
  });

  revalidatePath("/admin-users");
}
