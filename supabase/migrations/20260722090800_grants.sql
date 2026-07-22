-- Supabase's project template only grants TRIGGER/TRUNCATE/REFERENCES to
-- anon/authenticated/service_role by default -- SELECT/INSERT/UPDATE/DELETE
-- must be granted explicitly, with RLS doing the actual row-level
-- filtering on top. Verified locally: without this, every policy in the
-- prior migrations is unreachable and every query fails with "permission
-- denied for table ...", regardless of how correct the RLS policy is.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on
  public.admin_users,
  public.colleges,
  public.hostels,
  public.college_leads,
  public.students,
  public.machines,
  public.bookings,
  public.flash_slots,
  public.pricing_config,
  public.wallet_transactions
to anon, authenticated, service_role;

grant select on public.wallet_balances to anon, authenticated, service_role;

-- So tables added in future migrations don't fall into the same trap.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
