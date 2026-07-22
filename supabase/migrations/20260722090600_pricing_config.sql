-- Platform-wide pricing, editable by super admin without an app release
-- (story 3.4, needed now because 1.3/1.4 both depend on the booking fee
-- and flash slot premium). Scoped to just those two keys for now -- per-
-- college overrides and per-wash/subscription pricing are 3.4 proper and
-- come later.
--
-- Effective-dating: changing a price doesn't mutate the old row, it closes
-- it out (sets effective_to) and inserts a new one, so a booking that
-- snapshotted the old value is unaffected.

create table public.pricing_config (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key in ('booking_fee', 'flash_slot_premium')),
  value numeric(10, 2) not null check (value >= 0),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

-- Only one currently-open-ended (i.e. active) row per key at a time.
create unique index pricing_config_one_active_per_key
  on public.pricing_config (key)
  where effective_to is null;

alter table public.pricing_config enable row level security;

-- Everyone (including anon, pre-signup) can read the currently active
-- price so the app can display it. Super admin can also see history.
create policy "pricing_config_select_active_or_super_admin"
  on public.pricing_config for select
  using (
    public.is_super_admin()
    or (effective_from <= now() and (effective_to is null or effective_to > now()))
  );

create policy "pricing_config_write_super_admin"
  on public.pricing_config for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

insert into public.pricing_config (key, value) values
  ('booking_fee', 10.00),
  ('flash_slot_premium', 40.00);
