-- Instant wash: a first-class alternative to slot booking. A student
-- standing at a free machine can start washing immediately, at the
-- regular wash price, with no booking fee and no 7-minute start window --
-- there's no no-show risk to price for or forfeit against, since the
-- wash is already running by the time the booking row exists.
--
-- Deliberately a separate RPC (start_instant_wash) rather than an
-- overload of create_booking: the pricing source (wash_price, not
-- booking_fee) and the state-machine entry point (created straight into
-- 'started', skipping 'active' entirely) are genuinely different, not a
-- variation on the same shape.

-- 3.4's per-wash price, pulled forward because instant wash needs it now.
-- Same effective-dating pattern as booking_fee/flash_slot_premium.
alter table public.pricing_config drop constraint pricing_config_key_check;
alter table public.pricing_config add constraint pricing_config_key_check
  check (key in ('booking_fee', 'flash_slot_premium', 'wash_price'));

insert into public.pricing_config (key, value) values ('wash_price', 30.00);

alter table public.bookings drop constraint bookings_booking_type_check;
alter table public.bookings add constraint bookings_booking_type_check
  check (booking_type in ('regular', 'flash', 'instant'));

-- An instant wash is still a direct, non-premium claim on the machine --
-- it must be blocked the same way a regular booking is while a flash
-- slot is open, or instant wash becomes a backdoor around the flash
-- premium entirely. Renamed (was ..._for_regular_booking) now that it
-- guards two booking types, not one; behavior for 'regular' is unchanged.
drop trigger bookings_check_no_open_flash_slot on public.bookings;
drop function public.check_no_open_flash_slot_for_regular_booking();

create or replace function public.check_no_open_flash_slot_for_direct_booking()
returns trigger
language plpgsql
as $$
begin
  if new.booking_type in ('regular', 'instant') and exists (
    select 1 from public.flash_slots
    where machine_id = new.machine_id and status = 'open'
  ) then
    raise exception 'machine % has an open flash slot -- it must be claimed as a flash booking', new.machine_id;
  end if;
  return new;
end;
$$;

create trigger bookings_check_no_open_flash_slot
  before insert on public.bookings
  for each row execute function public.check_no_open_flash_slot_for_direct_booking();

-- The instant-wash entrypoint. Creates the booking straight into
-- 'started' -- expire_overdue_bookings() only ever touches status =
-- 'active' rows, so this booking is structurally exempt from the
-- forfeiture/flash-release path, exactly as intended. start_deadline is
-- still populated (the column is NOT NULL with a > slot_start check) but
-- is inert here since the row never passes through 'active'.
--
-- Same (absent) payment routing as create_booking/claim_flash_slot: no
-- real gateway call yet (story 1.4) -- the wash_price is snapshotted onto
-- the booking row now, same as booking_fee/flash price are elsewhere,
-- and the actual wallet/UPI charge belongs right where the TODO below is.
create or replace function public.start_instant_wash(p_machine_id uuid)
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

  -- TODO(1.4): take payment here (wallet-first, UPI top-up for the
  -- remainder) before this insert -- see the comment above.

  insert into public.bookings (
    student_id, machine_id, booking_type, status,
    slot_start, slot_end, start_deadline, started_at,
    booking_fee, fee_applied_to_wash
  ) values (
    v_student_id, p_machine_id, 'instant', 'started',
    now(), now() + interval '45 minutes', now() + interval '7 minutes', now(),
    coalesce(v_wash_price, 30.00), true
  ) returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.start_instant_wash(uuid) from public;
grant execute on function public.start_instant_wash(uuid) to authenticated;
