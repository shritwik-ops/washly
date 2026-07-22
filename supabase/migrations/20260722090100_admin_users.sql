-- Admin identity + role scaffolding. This exists purely to make RLS on every
-- later table possible: a college admin must only ever see their own
-- college's rows, and a super admin sees everything.
--
-- college_id has no foreign key yet -- the colleges table is created in the
-- next migration. The constraint is added there once it exists.

create table public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('college_admin', 'super_admin')),
  college_id uuid,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  constraint admin_users_college_scope check (
    (role = 'super_admin' and college_id is null)
    or (role = 'college_admin' and college_id is not null)
  )
);

comment on table public.admin_users is
  'Provisioned out-of-band via service_role -- there is no self-signup path '
  'for admins, so no insert/update policy exists for anon/authenticated.';

-- SECURITY DEFINER so these can be called from RLS policies on admin_users
-- itself (and everywhere else) without recursing back into admin_users'
-- own RLS. Owned by the migration role, which bypasses RLS on its own
-- tables, so this reads admin_users directly regardless of the caller's
-- policy.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function public.admin_college_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select college_id from public.admin_users
  where id = auth.uid() and role = 'college_admin'
  limit 1;
$$;

alter table public.admin_users enable row level security;

create policy "admin_users_select_self_or_super_admin"
  on public.admin_users for select
  using (id = auth.uid() or public.is_super_admin());
