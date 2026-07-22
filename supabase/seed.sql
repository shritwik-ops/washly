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
