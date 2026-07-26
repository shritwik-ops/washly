-- Story 3.9: deactivating an admin (not hard-deleting -- keeps the audit
-- trail in admin_action_log meaningful, and matches how the rest of this
-- schema treats "remove access" as a status flip rather than a delete,
-- e.g. students.account_status).
--
-- Deliberately does not touch RLS or the is_*_admin() helper functions --
-- those all check role only. The enforcement point for is_active is
-- proxy.ts's existing admin_users lookup (checked on every request), not
-- a blanket RLS change here. A deactivated admin whose session is still
-- live gets caught on their very next request, same as the existing
-- "no matching admin_users row" path already does.

alter table public.admin_users add column is_active boolean not null default true;

comment on column public.admin_users.is_active is
  'Deactivation flag (story 3.9) -- checked by the admin panel''s proxy.ts '
  'on every request, not by RLS. Deactivating is a status flip, not a '
  'delete, so admin_action_log entries referencing this admin stay '
  'meaningful.';
