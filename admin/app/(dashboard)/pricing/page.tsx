import { getCurrentAdmin } from "@/lib/admin-session";

export default async function PricingPage() {
  const admin = await getCurrentAdmin();
  const readOnly = admin?.role === "finance_admin";

  return (
    <div>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Pricing{readOnly ? " (read-only)" : ""}
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Coming soon -- pricing &amp; fee configuration (story 3.4).
        {readOnly ? " Your role has read-only access to this once it's built." : ""}
      </p>
    </div>
  );
}
