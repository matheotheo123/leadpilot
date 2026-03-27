-- LeadPilot Database Schema
-- Run this in your Supabase SQL editor

-- Searches table — stores each search session
create table if not exists searches (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  input_type text not null check (input_type in ('description', 'url')),
  input_value text not null,
  location text,
  business_profile jsonb,
  lead_count integer default 0,
  status text default 'pending' check (status in ('pending', 'searching', 'enriching', 'done', 'error'))
);

-- Leads table — stores individual enriched leads
create table if not exists leads (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  search_id uuid references searches(id) on delete cascade,
  name text not null,
  website text,
  phone text,
  email text,
  address text,
  industry text,
  company_size text,
  score integer check (score >= 0 and score <= 100),
  pain_signals jsonb default '[]',
  why_now text,
  outreach_blueprint text,
  source text check (source in ('web', 'maps')),
  status text default 'pending' check (status in ('pending', 'enriching', 'done', 'error'))
);

-- Indexes for performance
create index if not exists leads_search_id_idx on leads(search_id);
create index if not exists leads_score_idx on leads(score desc);
create index if not exists searches_created_at_idx on searches(created_at desc);

-- RLS — enable and set open policies (tighten in production with auth)
alter table searches enable row level security;
alter table leads enable row level security;

create policy "Allow all on searches" on searches for all using (true) with check (true);
create policy "Allow all on leads" on leads for all using (true) with check (true);
