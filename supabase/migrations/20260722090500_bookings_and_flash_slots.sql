-- The booking state machine (story 1.3). Deliberately modeled as two
-- entities rather than one status column:
--
--   bookings    -- one student's reservation of one machine.
--                  active -> started -> completed
--                  active -> expired                 (no-show, fee forfeited)
--
--   flash_slots -- the 2-minute premium-price competition that opens on a
--                  machine after its booking expires. open -> claimed
--                  open -> reverted   (nobody claimed it in time)
--
-- Keeping them separate avoids overloading bookings.status with states
-- that belong to a different lifecycle, and lets the flash competition
-- carry its own concurrency-safe "first payment wins" guarantee.
--
-- All status transitions are time-based or payment-gated and are driven by
-- backend/service_role logic (scheduled jobs, edge functions) per stories
-- 1.3/1.5 -- there is deliberately no client-side UPDATE policy on either
-- table yet.

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  machine_id uuid not null references public.machines(id),
  booking_type text not null default 'regular'
    check (booking_type in ('regular', 'flash')),
  status text not null default 'active'
    check (status in ('active', 'started', 'completed', 'expired')),
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  -- slot_start + 7 minutes (1.3); the forfeiture cutoff.
  start_deadline timestamptz not null,
  started_at timestamptz,
  expired_at timestamptz,
  -- Snapshotted from pricing_config at creation time (₹10 regular / ₹40
  -- flash) so later price changes don't retroactively alter this booking.
  booking_fee numeric(10, 2) not null check (booking_fee >= 0),
  fee_applied_to_wash boolean not null default false,
  no_show boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slot_end > slot_start),
  check (start_deadline > slot_start)
);

-- Guards against double-booking a machine: only one active/started booking
-- can exist for a given machine at a time.
create unique index bookings_one_active_per_machine
  on public.bookings (machine_id)
  where status in ('active', 'started');

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

alter table public.bookings enable row level security;

create policy "bookings_select_self_or_admin"
  on public.bookings for select
  using (
    student_id = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1 from public.machines m
      join public.hostels h on h.id = m.hostel_id
      where m.id = bookings.machine_id and h.college_id = public.admin_college_id()
    )
  );

-- A student may only book a machine at their own hostel, for themself, and
-- only as a 'regular' booking -- claiming a 'flash' slot is payment-gated
-- and exclusively handled server-side (service_role), never inserted
-- directly by the client.
create policy "bookings_insert_self"
  on public.bookings for insert
  with check (
    student_id = auth.uid()
    and booking_type = 'regular'
    and exists (
      select 1 from public.students s
      join public.machines m on m.hostel_id = s.hostel_id
      where s.id = auth.uid() and m.id = bookings.machine_id
    )
  );

-- The forfeited machine's 2-minute, premium-priced re-release window.
create table public.flash_slots (
  id uuid primary key default gen_random_uuid(),
  original_booking_id uuid not null references public.bookings(id),
  machine_id uuid not null references public.machines(id),
  -- Snapshotted from pricing_config (₹40 default) at release time.
  price numeric(10, 2) not null check (price >= 0),
  opens_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'open'
    check (status in ('open', 'claimed', 'reverted')),
  claimed_booking_id uuid unique references public.bookings(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > opens_at),
  check ((status = 'claimed') = (claimed_booking_id is not null))
);

-- Only one open flash slot per machine at a time. Combined with the unique
-- claimed_booking_id above and the status/claimant check constraint, the
-- winning claim is a single `update ... where id = $slot and status =
-- 'open'` -- concurrent attempts serialize on the row lock and only the
-- first sees status = 'open', which is the database-level "first payment
-- wins" guarantee CLAUDE.md calls for.
create unique index flash_slots_one_open_per_machine
  on public.flash_slots (machine_id)
  where status = 'open';

create trigger flash_slots_set_updated_at
  before update on public.flash_slots
  for each row execute function public.set_updated_at();

alter table public.flash_slots enable row level security;

-- Visible to every verified student at the hostel (they all get the flash
-- alert per 1.3), plus the relevant admins.
create policy "flash_slots_select_hostel_or_admin"
  on public.flash_slots for select
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.machines m
      join public.hostels h on h.id = m.hostel_id
      where m.id = flash_slots.machine_id and h.college_id = public.admin_college_id()
    )
    or exists (
      select 1 from public.students s
      join public.machines m on m.hostel_id = s.hostel_id
      where s.id = auth.uid() and m.id = flash_slots.machine_id
    )
  );

-- Without this, a machine sitting in an open flash window could still be
-- booked at the regular ₹10 fee directly (bookings_one_active_per_machine
-- only blocks active/started bookings, and the expired original booking no
-- longer counts) -- which would defeat the flash premium entirely. A
-- 'flash' booking created via the service-role claim flow is unaffected.
create or replace function public.check_no_open_flash_slot_for_regular_booking()
returns trigger
language plpgsql
as $$
begin
  if new.booking_type = 'regular' and exists (
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
  for each row execute function public.check_no_open_flash_slot_for_regular_booking();
