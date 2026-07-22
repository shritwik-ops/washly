-- Story 1.2 (live machine status) + 1.3 (booking, forfeiture, flash
-- re-release) server-side logic: machine status derivation, the
-- booking/flash-slot lifecycle scheduler, and the RPC entrypoints clients
-- call instead of writing to bookings/flash_slots directly.

-- "In use (time remaining)" (1.2) without granting every student read
-- access to whichever other student's booking currently occupies a
-- machine -- machines stays the one hostel-wide-visible surface, bookings
-- stays private per bookings_select_self_or_admin.
alter table public.machines add column busy_until timestamptz;

create index bookings_active_start_deadline_idx
  on public.bookings (start_deadline)
  where status = 'active';

create index flash_slots_open_expires_at_idx
  on public.flash_slots (expires_at)
  where status = 'open';

-- Backend/scheduler writes (pg_cron, the RPCs below) run with no JWT at all
-- -- auth.uid() is null, not some admin's id. The original version of this
-- trigger only recognized real admins as "acting_as_admin", so a
-- service-context update to no_show_count (forfeiture, 1.3) hit the
-- "students may not modify ..." branch and failed. Treat "no JWT" as
-- backend context, same trust level service_role already gets everywhere
-- else in this schema.
create or replace function public.enforce_student_update_permissions()
returns trigger
language plpgsql
as $$
declare
  acting_as_admin boolean := auth.uid() is null or public.is_super_admin() or public.admin_college_id() = old.college_id;
begin
  if acting_as_admin then
    if new.full_name is distinct from old.full_name
      or new.phone is distinct from old.phone
      or new.hostel_id is distinct from old.hostel_id
      or new.college_id is distinct from old.college_id
      or new.roll_number is distinct from old.roll_number
      or new.id_image_url is distinct from old.id_image_url
    then
      raise exception 'admins may only change verification and account status fields';
    end if;
  else
    if new.id_verification_status is distinct from old.id_verification_status
      or new.id_rejection_reason is distinct from old.id_rejection_reason
      or new.account_status is distinct from old.account_status
      or new.no_show_count is distinct from old.no_show_count
      or new.college_id is distinct from old.college_id
    then
      raise exception 'students may not modify verification, account status, no-show count, or college assignment';
    end if;
    -- Resubmitting a new ID after rejection puts verification back to pending.
    if new.id_image_url is distinct from old.id_image_url and old.id_verification_status = 'rejected' then
      new.id_verification_status := 'pending';
      new.id_rejection_reason := null;
    end if;
  end if;
  return new;
end;
$$;

-- Keeps machines.status/busy_until (1.2) in sync with whichever booking
-- currently occupies a machine. bookings_one_active_per_machine guarantees
-- there's ever only one active/started booking per machine, so these
-- updates are unconditionally correct -- no need to check whether another
-- booking is still holding the machine.
create or replace function public.sync_machine_status_on_booking_insert()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('active', 'started') then
    update public.machines
    set status = 'in_use', busy_until = new.slot_end, status_updated_at = now()
    where id = new.machine_id;
  end if;
  return new;
end;
$$;

create trigger bookings_sync_machine_status_insert
  after insert on public.bookings
  for each row execute function public.sync_machine_status_on_booking_insert();

create or replace function public.sync_machine_status_on_booking_update()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('active', 'started') then
      update public.machines
      set status = 'in_use', busy_until = new.slot_end, status_updated_at = now()
      where id = new.machine_id;
    elsif new.status in ('completed', 'expired') then
      update public.machines
      set status = 'free', busy_until = null, status_updated_at = now()
      where id = new.machine_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger bookings_sync_machine_status_update
  after update of status on public.bookings
  for each row execute function public.sync_machine_status_on_booking_update();

-- 1.3's forfeiture + flash-release, run periodically by pg_cron (below).
-- The three writes (expire the booking, bump the no-show count, open the
-- flash slot) share one CTE-chained statement so they commit atomically --
-- there's never a moment where a booking is expired but no flash slot
-- exists yet for someone else to grab the machine through.
create or replace function public.expire_overdue_bookings()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flash_premium numeric(10, 2);
begin
  select value into v_flash_premium
  from public.pricing_config
  where key = 'flash_slot_premium'
    and effective_from <= now()
    and (effective_to is null or effective_to > now());

  with expired as (
    update public.bookings
    set status = 'expired', expired_at = now(), no_show = true
    where status = 'active' and start_deadline < now()
    returning id, student_id, machine_id
  ), bump_no_show as (
    update public.students s
    set no_show_count = s.no_show_count + 1
    from expired e
    where s.id = e.student_id
  )
  insert into public.flash_slots (original_booking_id, machine_id, price, opens_at, expires_at)
  select e.id, e.machine_id, coalesce(v_flash_premium, 40.00), now(), now() + interval '2 minutes'
  from expired e;
end;
$$;

revoke all on function public.expire_overdue_bookings() from public;

-- 1.3: "if nobody claims the flash slot within 2 minutes, it reverts to the
-- normal booking flow". The machine is already back to 'free' (set when
-- the original booking expired above) and
-- bookings_check_no_open_flash_slot_for_regular_booking only blocks a
-- regular booking while a flash slot is *open*, so flipping this to
-- 'reverted' is the entire reversion -- normal booking unblocks itself.
create or replace function public.revert_expired_flash_slots()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.flash_slots
  set status = 'reverted'
  where status = 'open' and expires_at < now();
end;
$$;

revoke all on function public.revert_expired_flash_slots() from public;

create or replace function public.run_booking_scheduler()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.expire_overdue_bookings();
  perform public.revert_expired_flash_slots();
end;
$$;

revoke all on function public.run_booking_scheduler() from public;

-- pg_cron jobs run as the role that scheduled them (the migration role,
-- superuser) -- it owns these functions, so the revokes above don't stop
-- the scheduler itself, only client access via PostgREST's RPC endpoint.
-- 20s cadence: tight enough against the 2-minute flash window to matter,
-- loose enough not to be a meaningful load source at this scale.
create extension if not exists pg_cron;

select cron.schedule('washly-booking-scheduler', '20 seconds', $$select public.run_booking_scheduler()$$);

-- Booking creation is now exclusively through create_booking() below --
-- letting clients insert bookings directly meant trusting a
-- client-supplied booking_fee/slot_end/start_deadline, which is exactly
-- the kind of gap CLAUDE.md's payment-idempotency note warns about.
-- Mirrors how flash claims were already RPC-only.
drop policy "bookings_insert_self" on public.bookings;

-- 1.3: the only way a client creates a booking. booking_fee, slot_end, and
-- start_deadline are computed here, never trusted from the client.
create or replace function public.create_booking(p_machine_id uuid, p_slot_start timestamptz)
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

  insert into public.bookings (
    student_id, machine_id, booking_type, status,
    slot_start, slot_end, start_deadline, booking_fee
  ) values (
    v_student_id, p_machine_id, 'regular', 'active',
    p_slot_start, p_slot_start + interval '45 minutes', p_slot_start + interval '7 minutes',
    coalesce(v_booking_fee, 10.00)
  ) returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.create_booking(uuid, timestamptz) from public;
grant execute on function public.create_booking(uuid, timestamptz) to authenticated;

-- 1.3: the "Start wash" tap within the 7-minute window. Only flips the
-- booking to 'started' -- actually triggering the ESP32 relay is story
-- 1.5's IoT bridge, layered on top of this later per CLAUDE.md's build
-- order.
create or replace function public.start_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := auth.uid();
  v_booking public.bookings;
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

  update public.bookings
  set status = 'started', started_at = now(), fee_applied_to_wash = true
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.start_booking(uuid) from public;
grant execute on function public.start_booking(uuid) to authenticated;

-- 1.3: claiming a forfeited machine's 2-minute flash window. The
-- concurrency-safe "first payment wins" guarantee CLAUDE.md calls for is
-- this row lock plus flash_slots_one_open_per_machine -- a second,
-- concurrent claim blocks on "for update" until the first commits, then
-- sees status <> 'open' and fails cleanly (its booking insert rolls back
-- with it, since both happen in this one function invocation).
--
-- No real payment gateway yet (story 1.4) -- claiming succeeds
-- immediately. The gateway call belongs right where the TODO below is;
-- nothing else about this function (the lock, the booking created, the
-- slot flip) changes when it lands.
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

  -- TODO(1.4): take payment here (or verify a completed payment) before
  -- this insert -- see the comment above.

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

  return v_booking;
end;
$$;

revoke all on function public.claim_flash_slot(uuid) from public;
grant execute on function public.claim_flash_slot(uuid) to authenticated;

-- 1.2/1.3 need live updates with no manual refresh: machine status, flash
-- slot alerts, and a student's own booking transitioning under them
-- (e.g. auto-expiring while the screen is open).
alter publication supabase_realtime add table public.machines;
alter publication supabase_realtime add table public.flash_slots;
alter publication supabase_realtime add table public.bookings;
