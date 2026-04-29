-- Run this in your Supabase project → SQL Editor → New Query
--
-- This is the canonical schema for the FLO CI Agent. Drop-in replacement for
-- flo-ci-github/supabase-setup.sql. Adds the previously-undefined
-- promoted_seeds table so future setups don't drift.

-- ─── reports table (executive briefings) ──────────────────────────────────
create table if not exists reports (
  id           bigserial primary key,
  generated_at timestamptz not null default now(),
  scope        text not null default 'full',
  competitor_data jsonb not null default '[]',
  executive_report text not null default '',
  errors       jsonb not null default '[]'
);

alter table reports enable row level security;

drop policy if exists "Public read"    on reports;
drop policy if exists "Service insert" on reports;
drop policy if exists "Service delete" on reports;

create policy "Public read"    on reports for select using (true);
create policy "Service insert" on reports for insert with check (true);
create policy "Service delete" on reports for delete using (true);

-- ─── promoted_seeds table (auto-promoted new entrants) ────────────────────
-- The agent inserts a row the first time it discovers a new entrant, then
-- increments run_count on subsequent discoveries. When run_count >= 2 the
-- competitor is merged into the seed list at runtime
-- (see scripts/run-research.js → loadPromotedSeeds / updatePromotedSeeds).
-- Both INSERT and UPDATE policies are required for the upsert pattern.
create table if not exists promoted_seeds (
  name        text primary key,
  segment     text not null,
  sub_segment text,
  focus       text,
  first_seen  timestamptz not null default now(),
  run_count   int not null default 1
);

alter table promoted_seeds enable row level security;

drop policy if exists "Public read"    on promoted_seeds;
drop policy if exists "Service insert" on promoted_seeds;
drop policy if exists "Service update" on promoted_seeds;
drop policy if exists "Service delete" on promoted_seeds;

create policy "Public read"    on promoted_seeds for select using (true);
create policy "Service insert" on promoted_seeds for insert with check (true);
create policy "Service update" on promoted_seeds for update using (true) with check (true);
create policy "Service delete" on promoted_seeds for delete using (true);
