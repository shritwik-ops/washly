-- Washing machines (story 1.2). Status here is the live free/in-use/
-- maintenance signal shown to students; "time remaining" for an in-use
-- machine is derived from its active booking, not stored here.

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  hostel_id uuid not null references public.hostels(id),
  label text not null,
  status text not null default 'free'
    check (status in ('free', 'in_use', 'maintenance')),
  status_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hostel_id, label)
);

create trigger machines_set_updated_at
  before update on public.machines
  for each row execute function public.set_updated_at();

alter table public.machines enable row level security;

-- A student sees only the machines at their own hostel (1.2). Admins see
-- their own college's machines (or everything, for super admin).
create policy "machines_select_own_hostel_or_admin"
  on public.machines for select
  using (
    exists (
      select 1 from public.students s
      where s.id = auth.uid() and s.hostel_id = machines.hostel_id
    )
    or public.is_super_admin()
    or exists (
      select 1 from public.hostels h
      where h.id = machines.hostel_id and h.college_id = public.admin_college_id()
    )
  );

-- Status transitions driven by the booking state machine and the IoT
-- bridge (stories 1.3/1.5) happen via service_role, which bypasses RLS.
-- Only inventory management (super admin, story 3.3) writes through the
-- client.
create policy "machines_write_super_admin"
  on public.machines for all
  using (public.is_super_admin())
  with check (public.is_super_admin());
