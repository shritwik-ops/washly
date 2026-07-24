-- Story 1.7: wash history + subscription usage indicator.
--
-- Wash history itself needs no new table -- it's just completed bookings
-- (now reachable thanks to 1.6's complete_finished_washes) joined against
-- their wallet_transactions for cost/payment-source, both already
-- RLS-scoped to the student. The subscription indicator, though, needs a
-- table that doesn't exist yet: CLAUDE.md lists `subscriptions` among the
-- core entities, and 1.4 already named "subscription purchase" as a
-- checkout moment, but nothing before this migration created it.
--
-- Deliberately minimal and read-only from the client: tier pricing,
-- purchase flow, and per-college overrides are story 3.4's job, not
-- 1.7's. Every student has zero rows here today (no purchase path exists
-- yet), so the mobile indicator is built to render a graceful "no active
-- subscription" state -- that's the honest current state, not a bug.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  tier text not null,
  wash_allowance integer not null check (wash_allowance > 0),
  washes_used integer not null default 0 check (washes_used >= 0),
  starts_at timestamptz not null default now(),
  renews_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  check (renews_at > starts_at)
);

-- Only one active subscription per student at a time -- 1.7's "6 of 10
-- washes used this month" reads a single row, not a history of past plans.
create unique index subscriptions_one_active_per_student
  on public.subscriptions (student_id)
  where status = 'active';

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_self_or_super_admin"
  on public.subscriptions for select
  using (student_id = auth.uid() or public.is_super_admin());
