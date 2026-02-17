-- Run this script in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.transactions_snapshots (
  id uuid primary key default gen_random_uuid(),
  transactions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_snapshots_updated_at
  on public.transactions_snapshots (updated_at desc);

-- API route uses service-role key, so RLS is optional here.
alter table public.transactions_snapshots disable row level security;
