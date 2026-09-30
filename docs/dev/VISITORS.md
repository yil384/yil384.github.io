# Footer visitor map: one-time Supabase setup

The map (`assets/js/site/visitors.js`) uses the same Supabase project as the Picasso Lab map, but its own table so
the two sites' visits never mix. Run this once in the Supabase SQL editor (project `azkluwobpiaymxsfukly`):

```sql
create table if not exists public.home_visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  lat real, lon real,          -- rounded to 0.1 degree by the browser (about 10 km)
  city text, country text
);
alter table public.home_visits enable row level security;
create policy "anyone can read home visits" on public.home_visits for select to anon using (true);
create policy "anyone can add a home visit" on public.home_visits for insert to anon
  with check (lat between -90 and 90 and lon between -180 and 180 and length(coalesce(city, '')) < 80 and length(coalesce(country, '')) < 80);
```

No IP address is stored or shown: the visitor's browser asks a geo-IP service (ipwho.is, then ipapi.co, then geojs.io)
for an approximate location and sends only city, country and the rounded point. One visit per browser session, and
only from https://yil384.github.io (local test servers never write). Until the table exists the map shows no dots.
