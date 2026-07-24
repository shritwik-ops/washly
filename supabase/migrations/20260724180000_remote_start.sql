-- Story 1.5: remote start. "Start wash" already flips a booking to
-- 'started' (1.3/1.4's start_booking/start_instant_wash) -- what's missing
-- is the actual device round-trip this story describes: a command sent to
-- the ESP32 relay, a real confirmation before the student sees "started",
-- and a failure path that must not charge.
--
-- No real ESP32 bridge exists yet (that's its own Edge Function per
-- CLAUDE.md's IoT layer, layered on top of this later). Standing in for it
-- here is the same kind of simulation already used for the payment
-- gateway: a per-machine dev/test toggle that fails the *next* start
-- attempt on that machine, atomically, before either function's charge or
-- status change -- so "no charge on a failed start" is genuinely testable
-- locally, not just asserted. A real bridge replaces the check below with
-- an actual relay call; nothing else about either function changes when
-- it lands.

alter table public.machines add column simulate_relay_failure boolean not null default false;

comment on column public.machines.simulate_relay_failure is
  'Dev/test-only stand-in for the ESP32 relay bridge (story 1.5). When '
  'true, the next start_booking/start_instant_wash attempt on this machine '
  'raises before any charge or status change, so the no-charge-on-failure '
  'path is testable without real hardware. Super-admin/service_role only '
  '-- no client-facing toggle.';

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
  v_relay_failure boolean;
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

  -- 1.5: the device round-trip. Locked with the booking above so a retry
  -- racing a concurrent attempt can't double-charge -- this whole function
  -- is one transaction, so a raise here rolls back cleanly with no status
  -- change and no charge at all.
  select simulate_relay_failure into v_relay_failure
  from public.machines where id = v_booking.machine_id for update;
  if v_relay_failure then
    raise exception 'machine did not respond -- try starting again';
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

  -- 1.5: same device round-trip as start_booking, before the booking is
  -- even inserted -- a failed relay leaves nothing behind to roll back.
  if v_machine.simulate_relay_failure then
    raise exception 'machine did not respond -- try starting again';
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
