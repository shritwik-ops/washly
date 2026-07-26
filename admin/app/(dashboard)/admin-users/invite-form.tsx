"use client";

import { useActionState, useState } from "react";
import { inviteAdmin, type InviteState } from "./actions";

const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "operations_admin", label: "Operations Admin" },
  { value: "support_admin", label: "Support Admin" },
  { value: "finance_admin", label: "Finance Admin" },
  { value: "college_admin", label: "College Admin" },
];

interface College {
  id: string;
  name: string;
}

export function InviteForm({ colleges }: { colleges: College[] }) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(
    inviteAdmin,
    undefined
  );
  // college_admin is the only role that needs a college -- every other
  // platform role has college_id null, per admin_users_college_scope's
  // check constraint. Toggling the picker client-side just mirrors what
  // the constraint (and the action's own validation) already require.
  const [role, setRole] = useState("");

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="full_name" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          required
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="role" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Role
        </label>
        <select
          id="role"
          name="role"
          required
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          <option value="" disabled>
            Select role
          </option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {role === "college_admin" ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="college_id" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            College
          </label>
          <select
            id="college_id"
            name="college_id"
            required
            defaultValue=""
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="" disabled>
              Select college
            </option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? "Sending invite..." : "Invite admin"}
      </button>

      {state?.error ? (
        <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p className="w-full text-sm text-emerald-600 dark:text-emerald-400">{state.success}</p>
      ) : null}
    </form>
  );
}
