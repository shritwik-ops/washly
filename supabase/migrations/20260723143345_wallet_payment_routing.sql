-- Story 1.4: wallet + smart payment routing, wired into every checkout
-- moment that previously had a "TODO(1.4): take payment here" comment --
-- booking fee (create_booking), flash slot (claim_flash_slot), instant
-- wash (start_instant_wash) -- plus the "wash payment" checkout that 1.3
-- implied but never actually charged: when a slot-booked wash starts,
-- the booking_fee already collected counts toward the wash_price, and
-- the *remainder* is charged here for the first time (start_booking).
--
-- No real payment gateway is integrated yet (Razorpay/Cashfree per
-- CLAUDE.md's tech stack) -- every gateway-facing charge below simulates
-- an instant-success confirmation, exactly like every other payment TODO
-- already in this codebase. See the TODO comments on
-- charge_wallet_and_gateway and recharge_wallet for exactly where a real
-- integration replaces the simulation, and recharge_wallet's comment in
-- particular for why that one specifically must not be trusted as-is in
-- production (a student calling it directly gets free wallet credit,
-- since nothing here actually verifies money changed hands).

-- Shared charge logic for all three "spend" checkout moments (booking
-- fee, flash fee, wash payment). Not exposed to clients directly (no
-- grant to anon/authenticated) -- it's only ever invoked from inside the
-- other SECURITY DEFINER functions below, in the same transaction as the
-- booking/status change it's paying for, so a charge can never succeed
-- without the thing it paid for also committing (and vice versa).
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
  -- Nothing owed (e.g. a slot booking's fee already covers the full wash
  -- price) -- no ledger row, no payment_method validation needed either.
  if p_amount <= 0 then
    return;
  end if;

  select coalesce(balance, 0) into v_balance from public.wallet_balances where student_id = p_student_id;
  v_balance := coalesce(v_balance, 0);

  if p_payment_method = 'wallet' then
    -- Re-validated against a fresh balance read here, never trusting
    -- whatever the client's own (possibly stale) balance check showed --
    -- a concurrent spend elsewhere could have changed it since.
    if v_balance < p_amount then
      raise exception 'insufficient wallet balance';
    end if;
    insert into public.wallet_transactions (student_id, booking_id, type, amount, payment_method, description)
    values (p_student_id, p_booking_id, p_type, -p_amount, 'wallet', p_description || ' (₹' || p_amount || ' wallet)');

  elsif p_payment_method = 'mixed' then
    -- 1.4: the partial-balance choice always applies the student's whole
    -- current balance, never a partial-of-partial amount -- resolved
    -- client-side the same way (resolvePaymentSelection in shared/wallet.ts).
    if p_wallet_portion is null or p_wallet_portion <= 0 or p_wallet_portion >= p_amount then
      raise exception 'wallet_portion must be between 0 and the amount due for a mixed payment';
    end if;
    if p_wallet_portion > v_balance then
      raise exception 'insufficient wallet balance for the requested split';
    end if;
    v_gateway_amount := p_amount - p_wallet_portion;
    -- TODO(real gateway): verify the gateway portion actually succeeded
    -- before recording it -- this simulates an instant-success confirmation.
    v_gateway_reference := 'sim_' || gen_random_uuid()::text;
    -- `amount` is the wallet-BALANCE delta, not the transaction's total
    -- value (per the column's own comment on the table) -- only
    -- wallet_portion actually left the wallet, so that's what must hit the
    -- derived balance. The gateway_amount portion is real money that never
    -- touched the wallet; recording it as part of `amount` too would make
    -- the balance go negative by however much was paid externally, which
    -- is exactly the bug this fixes.
    insert into public.wallet_transactions (
      student_id, booking_id, type, amount, payment_method, wallet_portion, gateway_reference, description
    ) values (
      p_student_id, p_booking_id, p_type, -p_wallet_portion, 'mixed', p_wallet_portion, v_gateway_reference,
      p_description || ' (₹' || p_wallet_portion || ' wallet + ₹' || v_gateway_amount || ' gateway)'
    );

  elsif p_payment_method in ('upi', 'card') then
    -- TODO(real gateway): same simulated-success caveat as above.
    v_gateway_reference := 'sim_' || gen_random_uuid()::text;
    -- Purely external money -- amount = 0 (doesn't touch the wallet
    -- balance at all), same reasoning as the mixed case above. Still
    -- ledgered rather than skipped entirely, so the student's payment
    -- history/wash log shows every booking regardless of how it was paid.
    insert into public.wallet_transactions (student_id, booking_id, type, amount, payment_method, gateway_reference, description)
    values (p_student_id, p_booking_id, p_type, 0, p_payment_method, v_gateway_reference, p_description || ' (₹' || p_amount || ' ' || p_payment_method || ')');

  else
    raise exception 'invalid payment method: %', p_payment_method;
  end if;
end;
$$;

revoke all on function public.charge_wallet_and_gateway(uuid, numeric, text, numeric, text, uuid, text) from public;

-- 1.4's recharge: preset (₹100/₹200/₹500) or custom amount, via UPI/card.
--
-- TODO(real gateway): this simulates an instant-success Razorpay/Cashfree
-- payment. A real integration replaces the body below with a server-side
-- webhook handler that verifies the gateway's payment signature before
-- crediting -- until then, recharge_wallet as written must NOT be trusted
-- in production: any authenticated student calling this RPC directly gets
-- free wallet credit, since nothing here actually confirms money changed
-- hands. Fine for local dev / demoing the wallet mechanics and routing
-- logic, which is this migration's actual scope.
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

  insert into public.wallet_transactions (student_id, type, amount, payment_method, gateway_reference, description)
  values (v_student_id, 'recharge', p_amount, p_payment_method, v_gateway_reference, 'Wallet recharge')
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.recharge_wallet(numeric, text) from public;
grant execute on function public.recharge_wallet(numeric, text) to authenticated;

-- create_booking now takes the payment choice (resolved client-side via
-- resolvePaymentSelection against the student's own wallet balance) and
-- charges the booking fee in the same transaction as creating the
-- booking -- signature changed, so the old 2-arg version is dropped
-- first to avoid leaving an ambiguous duplicate overload for PostgREST.
drop function if exists public.create_booking(uuid, timestamptz);

create or replace function public.create_booking(
  p_machine_id uuid,
  p_slot_start timestamptz,
  p_payment_method text,
  p_wallet_portion numeric default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_student public.students;
  v_machine public.machines;
  v_booking_fee numeric(10, 2);
  v_booking public.bookings;
begin
  if v_student_id is null then
    raise exception 'authentication required';
  end if;

  select * into v_student from public.students where id = v_student_id;
  if v_student is null then
    raise exception 'student profile not found';
  end if;
  if v_student.account_status <> 'active' then
    raise exception 'account is suspended';
  end if;
  -- One booking at a time per student -- nothing else in 1.3 describes
  -- juggling multiple reservations, and the app's "your booking" card
  -- assumes a single active/started row per student.
  if exists (
    select 1 from public.bookings
    where student_id = v_student_id and status in ('active', 'started')
  ) then
    raise exception 'you already have an active booking';
  end if;

  -- 15-30 minute booking window (1.3), with a minute of tolerance either
  -- side for client/server clock drift and request latency.
  if p_slot_start < now() + interval '14 minutes' or p_slot_start > now() + interval '31 minutes' then
    raise exception 'slot_start must be 15-30 minutes from now';
  end if;

  select * into v_machine from public.machines where id = p_machine_id for update;
  if v_machine is null then
    raise exception 'machine not found';
  end if;
  if v_machine.hostel_id <> v_student.hostel_id then
    raise exception 'machine is not at your hostel';
  end if;
  if v_machine.status <> 'free' then
    raise exception 'machine is not free';
  end if;
  if exists (select 1 from public.flash_slots where machine_id = p_machine_id and status = 'open') then
    raise exception 'machine has an open flash slot -- claim it instead of booking normally';
  end if;

  select value into v_booking_fee
  from public.pricing_config
  where key = 'booking_fee'
    and effective_from <= now()
    and (effective_to is null or effective_to > now());
  v_booking_fee := coalesce(v_booking_fee, 10.00);

  insert into public.bookings (
    student_id, machine_id, booking_type, status,
    slot_start, slot_end, start_deadline, booking_fee
  ) values (
    v_student_id, p_machine_id, 'regular', 'active',
    p_slot_start, p_slot_start + interval '45 minutes', p_slot_start + interval '7 minutes',
    v_booking_fee
  ) returning * into v_booking;

  perform public.charge_wallet_and_gateway(
    v_student_id, v_booking_fee, p_payment_method, p_wallet_portion,
    'booking_fee', v_booking.id, 'Booking fee -- ' || v_machine.label
  );

  return v_booking;
end;
$$;

revoke all on function public.create_booking(uuid, timestamptz, text, numeric) from public;
grant execute on function public.create_booking(uuid, timestamptz, text, numeric) to authenticated;

-- start_booking now also collects the "wash payment" 1.4 describes: the
-- remainder of wash_price beyond the booking_fee already paid at
-- create_booking time (1.3: "the booking fee is adjusted against the
-- final wash cost"). p_payment_method/p_wallet_portion default to null
-- since the remainder can legitimately be zero (wash_price <=
-- booking_fee), in which case the client shows no payment step at all
-- and passes nothing -- charge_wallet_and_gateway no-ops for amount <= 0
-- regardless, but a *positive* remainder with no payment_method supplied
-- is a genuine client bug, not a silent skip, hence the explicit check.
drop function if exists public.start_booking(uuid);

create or replace function public.start_booking(
  p_booking_id uuid,
  p_payment_method text default null,
  p_wallet_portion numeric default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_booking public.bookings;
  v_wash_price numeric(10, 2);
  v_remainder numeric(10, 2);
begin
  if v_student_id is null then
    raise exception 'authentication required';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking is null or v_booking.student_id <> v_student_id then
    raise exception 'booking not found';
  end if;
  if v_booking.status <> 'active' then
    raise exception 'booking is not active';
  end if;
  if now() > v_booking.start_deadline then
    raise exception 'start window has passed';
  end if;

  select value into v_wash_price
  from public.pricing_config
  where key = 'wash_price'
    and effective_from <= now()
    and (effective_to is null or effective_to > now());
  v_remainder := greatest(coalesce(v_wash_price, 30.00) - v_booking.booking_fee, 0);

  if v_remainder > 0 and p_payment_method is null then
    raise exception 'payment method required to cover the remaining wash cost';
  end if;

  update public.bookings
  set status = 'started', started_at = now(), fee_applied_to_wash = true
  where id = p_booking_id
  returning * into v_booking;

  update public.students set prewash_checklist_count = prewash_checklist_count + 1 where id = v_student_id;

  if v_remainder > 0 then
    perform public.charge_wallet_and_gateway(
      v_student_id, v_remainder, p_payment_method, p_wallet_portion,
      'wash_payment', p_booking_id, 'Wash payment (remainder)'
    );
  end if;

  return v_booking;
end;
$$;

revoke all on function public.start_booking(uuid, text, numeric) from public;
grant execute on function public.start_booking(uuid, text, numeric) to authenticated;

-- start_instant_wash: same charge treatment as create_booking, at the
-- full wash_price (no deposit/remainder split -- the whole price is one
-- checkout moment, matching 1.10).
drop function if exists public.start_instant_wash(uuid);

create or replace function public.start_instant_wash(
  p_machine_id uuid,
  p_payment_method text,
  p_wallet_portion numeric default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_student public.students;
  v_machine public.machines;
  v_wash_price numeric(10, 2);
  v_booking public.bookings;
begin
  if v_student_id is null then
    raise exception 'authentication required';
  end if;

  select * into v_student from public.students where id = v_student_id;
  if v_student is null then
    raise exception 'student profile not found';
  end if;
  if v_student.account_status <> 'active' then
    raise exception 'account is suspended';
  end if;
  if exists (
    select 1 from public.bookings
    where student_id = v_student_id and status in ('active', 'started')
  ) then
    raise exception 'you already have an active booking';
  end if;

  select * into v_machine from public.machines where id = p_machine_id for update;
  if v_machine is null then
    raise exception 'machine not found';
  end if;
  if v_machine.hostel_id <> v_student.hostel_id then
    raise exception 'machine is not at your hostel';
  end if;
  if v_machine.status <> 'free' then
    raise exception 'machine is not free';
  end if;
  if exists (select 1 from public.flash_slots where machine_id = p_machine_id and status = 'open') then
    raise exception 'machine has an open flash slot -- claim it instead';
  end if;

  select value into v_wash_price
  from public.pricing_config
  where key = 'wash_price'
    and effective_from <= now()
    and (effective_to is null or effective_to > now());
  v_wash_price := coalesce(v_wash_price, 30.00);

  insert into public.bookings (
    student_id, machine_id, booking_type, status,
    slot_start, slot_end, start_deadline, started_at,
    booking_fee, fee_applied_to_wash
  ) values (
    v_student_id, p_machine_id, 'instant', 'started',
    now(), now() + interval '45 minutes', now() + interval '7 minutes', now(),
    v_wash_price, true
  ) returning * into v_booking;

  update public.students set prewash_checklist_count = prewash_checklist_count + 1 where id = v_student_id;

  perform public.charge_wallet_and_gateway(
    v_student_id, v_wash_price, p_payment_method, p_wallet_portion,
    'wash_payment', v_booking.id, 'Instant wash -- ' || v_machine.label
  );

  return v_booking;
end;
$$;

revoke all on function public.start_instant_wash(uuid, text, numeric) from public;
grant execute on function public.start_instant_wash(uuid, text, numeric) to authenticated;

-- claim_flash_slot's signature is UNCHANGED -- no client payment choice.
-- The 2-minute claim window is exactly the scenario 1.4's "a choice, not
-- forced" language doesn't fit well: interrupting a live countdown with a
-- payment-method prompt would cost the very seconds "first payment wins"
-- is supposed to reward. Routing is resolved automatically instead: pay
-- from wallet (silent, fastest) when it fully covers the price, otherwise
-- the full price goes via gateway without partially touching the wallet
-- -- preserving the student's balance untouched rather than forcing a
-- split decision mid-claim.
create or replace function public.claim_flash_slot(p_flash_slot_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_student public.students;
  v_slot public.flash_slots;
  v_booking public.bookings;
  v_balance numeric(10, 2);
  v_payment_method text;
begin
  if v_student_id is null then
    raise exception 'authentication required';
  end if;

  select * into v_student from public.students where id = v_student_id;
  if v_student is null then
    raise exception 'student profile not found';
  end if;
  if v_student.account_status <> 'active' then
    raise exception 'account is suspended';
  end if;
  if exists (
    select 1 from public.bookings
    where student_id = v_student_id and status in ('active', 'started')
  ) then
    raise exception 'you already have an active booking';
  end if;

  select * into v_slot from public.flash_slots where id = p_flash_slot_id for update;
  if v_slot is null then
    raise exception 'flash slot not found';
  end if;
  if v_slot.status <> 'open' or v_slot.expires_at < now() then
    raise exception 'flash slot is no longer available';
  end if;

  if not exists (
    select 1 from public.machines m
    where m.id = v_slot.machine_id and m.hostel_id = v_student.hostel_id
  ) then
    raise exception 'flash slot is not at your hostel';
  end if;

  insert into public.bookings (
    student_id, machine_id, booking_type, status,
    slot_start, slot_end, start_deadline, booking_fee
  ) values (
    v_student_id, v_slot.machine_id, 'flash', 'active',
    now(), now() + interval '45 minutes', now() + interval '7 minutes',
    v_slot.price
  ) returning * into v_booking;

  update public.flash_slots
  set status = 'claimed', claimed_booking_id = v_booking.id
  where id = v_slot.id and status = 'open';

  if not found then
    raise exception 'flash slot was just claimed by someone else';
  end if;

  select coalesce(balance, 0) into v_balance from public.wallet_balances where student_id = v_student_id;
  v_payment_method := case when coalesce(v_balance, 0) >= v_slot.price then 'wallet' else 'upi' end;
  perform public.charge_wallet_and_gateway(
    v_student_id, v_slot.price, v_payment_method, null,
    'flash_fee', v_booking.id, 'Flash slot claim'
  );

  return v_booking;
end;
$$;

revoke all on function public.claim_flash_slot(uuid) from public;
grant execute on function public.claim_flash_slot(uuid) to authenticated;

-- Wallet activity should refresh live wherever it's shown, same rationale
-- as machines/bookings/flash_slots.
alter publication supabase_realtime add table public.wallet_transactions;
