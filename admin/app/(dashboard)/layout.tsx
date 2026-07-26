import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-session";
import { navItemsForRole } from "@/lib/nav-items";
import { logout } from "../actions";

// Wraps every protected page (everything except /login, which is a
// sibling route outside this group and untouched here). proxy.ts already
// guarantees a valid admin session before any request reaches this
// layout -- a null getCurrentAdmin() here would mean that guarantee
// broke, not an expected "logged out" case, so this redirects rather
// than rendering a broken sidebar.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/login");
  }

  const navItems = navItemsForRole(admin.role);

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black">
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Washly Admin</p>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <p className="truncate px-3 text-xs text-zinc-500 dark:text-zinc-400">{admin.email}</p>
          <p className="px-3 text-xs text-zinc-400 dark:text-zinc-500">{admin.role}</p>
          <form action={logout} className="mt-2">
            <button
              type="submit"
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
