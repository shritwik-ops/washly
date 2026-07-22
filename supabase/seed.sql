-- Local dev fixtures for testing the college/hostel picker (story 1.1).
-- One active college with hostels (should appear in the picker), one
-- inactive college (should NOT appear -- proves the is_active RLS filter,
-- not just app-level filtering).

insert into public.colleges (id, name, city, is_active) values
  ('00000000-0000-0000-0000-000000000001', 'Springfield Institute of Technology', 'Springfield', true),
  ('00000000-0000-0000-0000-000000000002', 'Shelbyville College of Engineering', 'Shelbyville', false);

insert into public.hostels (id, college_id, name) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Hostel A'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Hostel B'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Hostel C'),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000002', 'Hostel A');

-- Machines for testing live status + booking (stories 1.2/1.3). Hostel A
-- gets one of each status so the grid has something to show immediately;
-- Hostel B is empty on purpose (proves the "no machines yet" empty state).
insert into public.machines (id, hostel_id, label, status) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000011', 'Machine 1', 'free'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000011', 'Machine 2', 'free'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000011', 'Machine 3', 'maintenance'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000013', 'Machine 1', 'free');
