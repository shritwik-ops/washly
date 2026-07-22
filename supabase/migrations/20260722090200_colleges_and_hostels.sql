-- Colleges, hostels, and the "college not yet on Washly" lead-capture path
-- from story 1.1's edge case.

create table public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger colleges_set_updated_at
  before update on public.colleges
  for each row execute function public.set_updated_at();

alter table public.admin_users
  add constraint admin_users_college_id_fkey
  foreign key (college_id) references public.colleges(id);

create table public.hostels (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (college_id, name)
);

create trigger hostels_set_updated_at
  before update on public.hostels
  for each row execute function public.set_updated_at();

-- Signup-time lead capture when a student's college isn't listed yet.
-- No student account exists at this point, so this is just contact info.
create table public.college_leads (
  id uuid primary key default gen_random_uuid(),
  college_name text not null,
  city text,
  contact_phone text not null,
  created_at timestamptz not null default now()
);

alter table public.colleges enable row level security;
alter table public.hostels enable row level security;
alter table public.college_leads enable row level security;

-- Anyone (pre-auth or authenticated) can browse active colleges for the
-- signup picker. Super admin sees everything, including inactive ones.
create policy "colleges_select_active_or_super_admin"
  on public.colleges for select
  using (is_active or public.is_super_admin());

create policy "colleges_write_super_admin"
  on public.colleges for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "hostels_select_active_college_or_admin"
  on public.hostels for select
  using (
    exists (
      select 1 from public.colleges c
      where c.id = hostels.college_id and c.is_active
    )
    or public.is_super_admin()
    or public.admin_college_id() = hostels.college_id
  );

create policy "hostels_write_super_admin"
  on public.hostels for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Signup flow only ever inserts a lead; nobody reads these back except the
-- super admin following up on launch demand.
create policy "college_leads_insert_anyone"
  on public.college_leads for insert
  with check (true);

create policy "college_leads_manage_super_admin"
  on public.college_leads for select
  using (public.is_super_admin());

create policy "college_leads_update_super_admin"
  on public.college_leads for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "college_leads_delete_super_admin"
  on public.college_leads for delete
  using (public.is_super_admin());
