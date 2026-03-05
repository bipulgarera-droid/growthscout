-- Create the table for storing generated website previews
create table if not exists personalized_previews (
  id uuid default uuid_generate_v4() primary key,
  slug text not null unique,
  business_name text not null,
  logo_url text,
  contact_info jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (optional, good practice)
alter table personalized_previews enable row level security;

-- Allow public read access (so the website can fetch data)
drop policy if exists "Allow public read access" on personalized_previews;
create policy "Allow public read access"
  on personalized_previews
  for select
  using (true);

-- Allow public insert access (Required because we are using the Anon Key)
drop policy if exists "Allow public insert" on personalized_previews;
create policy "Allow public insert"
  on personalized_previews
  for insert
  with check (true);
