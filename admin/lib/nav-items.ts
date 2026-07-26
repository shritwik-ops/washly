import type { AdminRole } from "./admin-session";

export interface NavItem {
  href: string;
  label: string;
  roles: AdminRole[];
  // Only pricing needs this today (finance_admin has read-only access per
  // 3.9's role scope) -- a function rather than a static label since it
  // depends on which role is viewing, not the item itself.
  labelForRole?: (role: AdminRole) => string;
}

// One flat list, filtered per-viewer by role -- rather than duplicating
// per-role lists, which would drift the moment a role's scope changes.
// Order matters here: it's also the sidebar's render order.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", roles: ["super_admin", "finance_admin"] },
  { href: "/colleges", label: "Colleges", roles: ["super_admin", "operations_admin"] },
  { href: "/machines", label: "Machines", roles: ["super_admin", "operations_admin"] },
  {
    href: "/pricing",
    label: "Pricing",
    roles: ["super_admin", "operations_admin", "finance_admin"],
    labelForRole: (role) => (role === "finance_admin" ? "Pricing (read-only)" : "Pricing"),
  },
  { href: "/users", label: "Users", roles: ["super_admin", "support_admin"] },
  { href: "/support-tickets", label: "Support Tickets", roles: ["super_admin", "support_admin"] },
  { href: "/admin-users", label: "Admin Users", roles: ["super_admin"] },
];

export function navItemsForRole(role: AdminRole) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => ({
    href: item.href,
    label: item.labelForRole ? item.labelForRole(role) : item.label,
  }));
}
