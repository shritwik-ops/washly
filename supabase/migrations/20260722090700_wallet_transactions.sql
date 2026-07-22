-- Wallet ledger (story 1.4). Append-only by construction: there is no
-- update or delete policy for any client-facing role, and no insert policy
-- either -- every row is written by backend/service_role logic (recharge
-- webhook, checkout, forfeiture job) so a student can never credit their
-- own wallet. Balance is never stored; it's always a derived sum via the
-- wallet_balances view below.

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  -- Which booking/wash this entry was for, if any (recharges have none).
  booking_id uuid references public.bookings(id),
  type text not null check (
    type in ('recharge', 'booking_fee', 'flash_fee', 'wash_payment', 'forfeiture', 'refund')
  ),
  -- Signed wallet-balance delta. Positive = credit, negative = debit.
  -- 'forfeiture' rows are informational (amount = 0) when the fee was
  -- already debited at booking time -- no money moves a second time, this
  -- just records that it won't be credited back.
  amount numeric(10, 2) not null,
  payment_method text check (payment_method in ('wallet', 'upi', 'card', 'mixed')),
  -- How much of a 'mixed' payment came from the wallet (1.4's partial-
  -- wallet-plus-UPI split); the remainder went via the gateway.
  wallet_portion numeric(10, 2),
  gateway_reference text,
  description text,
  created_at timestamptz not null default now(),
  check (wallet_portion is null or payment_method = 'mixed')
);

alter table public.wallet_transactions enable row level security;

-- Wallet/payment data is student-private and super-admin-only -- college
-- admins never see it (2.1: no revenue/financial figures; 1.9: payment
-- tickets route straight to super admin, not college admin).
create policy "wallet_transactions_select_self_or_super_admin"
  on public.wallet_transactions for select
  using (student_id = auth.uid() or public.is_super_admin());

create view public.wallet_balances
  with (security_invoker = true) as
  select student_id, coalesce(sum(amount), 0)::numeric(10, 2) as balance
  from public.wallet_transactions
  group by student_id;

comment on view public.wallet_balances is
  'Derived wallet balance per student. security_invoker so this respects '
  'the querying role''s RLS on wallet_transactions rather than the view '
  'owner''s.';
