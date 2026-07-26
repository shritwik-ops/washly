import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-session";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";
import { deactivateAdmin } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  operations_admin: "Operations Admin",
  support_admin: "Support Admin",
  finance_admin: "Finance Admin",
  college_admin: "College Admin",
};

// super_admin-only, enforced here independently of the sidebar's own role
// filtering -- a support_admin typing this URL directly would otherwise
// still reach a server component that queries admin_users successfully
// (RLS scopes columns/rows, not whole-page access).
export default async function AdminUsersPage() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== "super_admin") {
    redirect("/");
  }

  const supabase = await createClient();
  const [{ data: admins }, { data: colleges }] = await Promise.all([
    supabase
      .from("admin_users")
      .select("id, full_name, email, role, college_id, is_active, created_at")
      .order("created_at", { ascending: false }),
    // Needed for the college_admin picker in InviteForm, and to label
    // each college_admin row's college below -- colleges_select_active_or_admin
    // already lets super_admin see every college, active or not.
    supabase.from("colleges").select("id, name").order("name"),
  ]);

  const collegeNameById = new Map((colleges ?? []).map((c) => [c.id, c.name]));

  return (
    <div>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Admin Users</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Only super_admin can create, edit, or deactivate other admins (story 3.9).
      </p>

      <div className="mt-4">
        <InviteForm colleges={colleges ?? []} />
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">Role</th>
            <th className="py-2 pr-4 font-medium">College</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Created</th>
            <th className="py-2 pr-4 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {(admins ?? []).map((row) => {
            const isSelf = row.id === admin.id;
            return (
              <tr
                key={row.id}
                className="border-b border-zinc-100 text-zinc-800 dark:border-zinc-900 dark:text-zinc-200"
              >
                <td className="py-2 pr-4">{row.full_name ?? "--"}</td>
                <td className="py-2 pr-4">{row.email ?? "--"}</td>
                <td className="py-2 pr-4">{ROLE_LABEL[row.role] ?? row.role}</td>
                <td className="py-2 pr-4 text-zinc-500 dark:text-zinc-400">
                  {row.college_id ? collegeNameById.get(row.college_id) ?? "--" : "--"}
                </td>
                <td className="py-2 pr-4">
                  {row.is_active ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                  ) : (
                    <span className="text-zinc-400">Deactivated</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-zinc-500 dark:text-zinc-400">
                  {new Date(row.created_at).toLocaleDateString()}
                </td>
                <td className="py-2 pr-4">
                  {isSelf ? (
                    <span className="text-xs text-zinc-400">You</span>
                  ) : row.is_active ? (
                    <form action={deactivateAdmin.bind(null, row.id)}>
                      <button
                        type="submit"
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                      >
                        Deactivate
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
