import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";

// Dashboard placeholder -- proxy.ts already guarantees a valid admin
// session by the time any request reaches here, so this only needs to
// display who's signed in. Role-based navigation/UI is a separate next
// step (3.9 lands roles + RLS; branching the dashboard per role is not
// part of this pass).
export default async function Dashboard() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("role")
    .eq("id", data.user!.id)
    .single();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {data.user?.email}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{adminRow?.role}</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Log out
          </button>
        </form>
      </header>

      <main className="p-6">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Washly Admin
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Signed in. Role-based navigation is a separate next step.
        </p>
      </main>
    </div>
  );
}
