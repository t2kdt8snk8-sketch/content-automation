create extension if not exists "pgcrypto";

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  main_track text not null,
  main_artist text not null,
  status text not null check (
    status in ('draft', 'researching', 'researched', 'verifying', 'verified', 'selected', 'failed')
  ),
  selected_candidate_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hook_candidates (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  track_name text not null,
  artist_name text not null,
  sound_concept text not null,
  connection_reason text not null,
  awareness_metric text not null,
  research_sources jsonb not null default '[]'::jsonb,
  verification_status text null check (verification_status in ('verified', 'uncertain')),
  verification_summary text null,
  uncertainty_flags jsonb not null default '[]'::jsonb,
  verification_sources jsonb not null default '[]'::jsonb,
  display_order integer not null,
  created_at timestamptz not null default now()
);

create index if not exists workflows_status_idx on public.workflows(status);
create index if not exists hook_candidates_workflow_idx on public.hook_candidates(workflow_id);

alter table public.workflows enable row level security;
alter table public.hook_candidates enable row level security;

create policy "anon read workflows"
on public.workflows
for select
to anon
using (true);

create policy "anon insert workflows"
on public.workflows
for insert
to anon
with check (true);

create policy "anon update workflows"
on public.workflows
for update
to anon
using (true)
with check (true);

create policy "anon read hook_candidates"
on public.hook_candidates
for select
to anon
using (true);

create policy "anon insert hook_candidates"
on public.hook_candidates
for insert
to anon
with check (true);

create policy "anon update hook_candidates"
on public.hook_candidates
for update
to anon
using (true)
with check (true);

create policy "anon delete hook_candidates"
on public.hook_candidates
for delete
to anon
using (true);
