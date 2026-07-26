import { getCurrentAdmin } from "@/lib/admin-session";

// Dashboard (3.1: platform-wide revenue/health figures) -- not built yet.
// This just confirms the shared role/session lookup and the sidebar
// render correctly; the real dashboard is a separate story.
export default async function Dashboard() {
  const admin = await getCurrentAdmin();

  return (
    <div>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Signed in as {admin?.email} ({admin?.role}). Platform revenue/health figures (story 3.1)
        are not built yet.
      </p>
    </div>
  );
}
