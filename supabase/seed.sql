-- Seed content ported from prototype/app.js + index.html so the app has real data on day one.

insert into public.jumuah_times (label, khutbah_time, iqamah_time, sort_order) values
  ('First Jumu''ah', '13:15', '13:30', 1),
  ('Second Jumu''ah', '14:00', '14:15', 2);

insert into public.donation_categories (slug, title, description, icon, url, sort_order) values
  ('zakaat', 'Zakaat', 'Zakaat is one of the five pillars of Islam. It is obligatory for every Muslim who meets the criteria of nisab. Your Zakaat is distributed to those in need within the community.', 'balance-scale', 'https://wembleycentralmasjid.co.uk/donate/', 1),
  ('sadaqah', 'Sadaqah', 'Sadaqah is voluntary charity given for the sake of Allah. Any amount, big or small, makes a difference. All Sadaqah is used to benefit the local community.', 'heart', 'https://wembleycentralmasjid.co.uk/donate/', 2),
  ('sponsor', 'Sponsor the Masjid', 'For just 30p a day (approximately £100 per year), you can become one of 1,000 sponsors helping to cover the Masjid''s annual running costs including utilities, maintenance and staffing.', 'star', 'https://wembleycentralmasjid.co.uk/donate/', 3),
  ('general', 'General Donation', 'General donations go towards the day-to-day running of the Masjid, maintenance, utility bills and community programmes.', 'mosque', 'https://wembleycentralmasjid.co.uk/donate/', 4);

insert into public.madrasah_classes (name, days, time_range, sort_order) values
  ('Quran Reading', 'Mon - Fri', '5:00 - 6:30 pm', 1),
  ('Islamic Studies', 'Sat - Sun', '10:00 - 12:00 pm', 2),
  ('Arabic Language', 'Sat', '2:00 - 3:30 pm', 3),
  ('Tajweed', 'Sun', '2:00 - 3:30 pm', 4),
  ('Hifz Programme', 'Mon - Fri', '4:00 - 7:00 pm', 5);

insert into public.services (title, description, icon, sort_order) values
  ('Nikaah', 'Book at least 3 weeks in advance', 'heart', 1),
  ('Zakaat & Sadaqah', 'Disbursement services', 'hand-holding-usd', 2),
  ('Funeral', 'Support during bereavement', 'moon', 3),
  ('Open Days', 'Community visits welcome', 'door-open', 4),
  ('School Visits', 'Educational outreach', 'school', 5);

insert into public.banners (badge, title, subtitle, action_type, action_target, sort_order) values
  ('Sponsor Campaign', 'Spare just 30p a day', 'Become one of 1,000 sponsors', 'screen', '/donate', 1),
  ('Enrolment Open', 'Madrasah Classes', 'Quran, Arabic, Tajweed and Hifz', 'screen', '/madrasah', 2);

insert into public.notices (icon, message, action_type, action_target) values
  ('car', 'Stadium event days: parking restrictions apply', 'screen', '/more/stadium');

insert into public.app_config (key, value) values
  ('contact', '{"phone": "020 8900 9673", "email": "wembleycentralmasjid@gmail.com", "address": "35-37 Ealing Road, Wembley, Middlesex, HA0 4AE"}'),
  ('charity_number', '"285630"'),
  ('qibla_bearing_degrees', '119'),
  ('hijri_offset_days', '0'),
  ('is_ramadan', 'false'),
  ('live_events_url', 'null'),
  ('tour_url', 'null'),
  ('donation_fallback_url', '"https://wembleycentralmasjid.co.uk/donate/"'),
  ('map', '{"lat": 51.5479, "lng": -0.2963}');
