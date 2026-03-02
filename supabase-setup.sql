-- Run this in your Supabase project → SQL Editor → New Query

create table if not exists reports (
  id           bigserial primary key,
  generated_at timestamptz not null default now(),
  scope        text not null default 'full',
  competitor_data jsonb not null default '[]',
  executive_report text not null default '',
  errors       jsonb not null default '[]'
);

-- Allow read access from the dashboard (GitHub Pages)
alter table reports enable row level security;

create policy "Public read" on reports
  for select using (true);

-- Only the service role (GitHub Actions) can insert/delete
create policy "Service insert" on reports
  for insert with check (true);

create policy "Service delete" on reports
  for delete using (true);
