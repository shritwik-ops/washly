-- Fixes a real gap surfaced while building 1.7's wash-history cost column:
-- wallet_transactions.amount is a wallet-BALANCE delta (by design, per its
-- own comment in 20260722090700_wallet_transactions.sql), not the actual
-- amount charged for the checkout moment. For a pure upi/card payment that
-- delta is correctly 0 (nothing left the wallet) -- but that made a ₹30
-- UPI-paid wash render as "₹0" in wash history, which is wrong, not just
-- incomplete.
--
-- total_amount is the actual amount charged (wallet + gateway combined),
-- independent of how much of it touched the wallet balance. It's exactly
-- charge_wallet_and_gateway's own p_amount parameter in every branch --
-- the function already has this number, it just wasn't being stored.
-- Historical rows before this migration are left null (no way to recover
-- the true total from amount=0 rows without parsing description text);
-- mobile falls back to abs(amount) for those.

alter table public.wallet_transactions add column total_amount numeric(10, 2);

comment on column public.wallet_transactions.total_amount is
  'Actual amount charged for this checkout moment (wallet + gateway '
  'combined), independent of amount''s wallet-balance-delta meaning. Null '
  'on rows written before this column existed.';

create or replace function public.charge_wallet_and_gateway(
  p_student_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_wallet_portion numeric,
  p_type text,
  p_booking_id uuid,
  p_description text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric(10, 2);
  v_gateway_reference text;
  v_gateway_amount numeric(10, 2);
begin
  if p_amount <= 0 then
    return;
  end if;

  select coalesce(balance, 0) into v_balance from public.wallet_balances where student_id = p_student_id;
  v_balance := coalesce(v_balance, 0);

  if p_payment_method = 'wallet' then
    if v_balance < p_amount then
      raise exception 'insufficient wallet balance';
    end if;
    insert into public.wallet_transactions (student_id, booking_id, type, amount, total_amount, payment_method, description)
    values (p_student_id, p_booking_id, p_type, -p_amount, p_amount, 'wallet', p_description || ' (₹' || p_amount || ' wallet)');

  elsif p_payment_method = 'mixed' then
    if p_wallet_portion is null or p_wallet_portion <= 0 or p_wallet_portion >= p_amount then
      raise exception 'wallet_portion must be between 0 and the amount due for a mixed payment';
    end if;
    if p_wallet_portion > v_balance then
      raise exception 'insufficient wallet balance for the requested split';
    end if;
    v_gateway_amount := p_amount - p_wallet_portion;
    v_gateway_reference := 'sim_' || gen_random_uuid()::text;
    insert into public.wallet_transactions (
      student_id, booking_id, type, amount, total_amount, payment_method, wallet_portion, gateway_reference, description
    ) values (
      p_student_id, p_booking_id, p_type, -p_wallet_portion, p_amount, 'mixed', p_wallet_portion, v_gateway_reference,
      p_description || ' (₹' || p_wallet_portion || ' wallet + ₹' || v_gateway_amount || ' gateway)'
    );

  elsif p_payment_method in ('upi', 'card') then
    v_gateway_reference := 'sim_' || gen_random_uuid()::text;
    insert into public.wallet_transactions (student_id, booking_id, type, amount, total_amount, payment_method, gateway_reference, description)
    values (p_student_id, p_booking_id, p_type, 0, p_amount, p_payment_method, v_gateway_reference, p_description || ' (₹' || p_amount || ' ' || p_payment_method || ')');

  else
    raise exception 'invalid payment method: %', p_payment_method;
  end if;
end;
$$;

create or replace function public.recharge_wallet(p_amount numeric, p_payment_method text)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_gateway_reference text;
  v_row public.wallet_transactions;
begin
  if v_student_id is null then
    raise exception 'authentication required';
  end if;
  if not exists (select 1 from public.students where id = v_student_id) then
    raise exception 'student profile not found';
  end if;
  if p_amount <= 0 then
    raise exception 'recharge amount must be positive';
  end if;
  if p_payment_method not in ('upi', 'card') then
    raise exception 'recharge must be paid via upi or card';
  end if;

  v_gateway_reference := 'sim_' || gen_random_uuid()::text;

  insert into public.wallet_transactions (student_id, type, amount, total_amount, payment_method, gateway_reference, description)
  values (v_student_id, 'recharge', p_amount, p_amount, p_payment_method, v_gateway_reference, 'Wallet recharge')
  returning * into v_row;

  return v_row;
end;
$$;
