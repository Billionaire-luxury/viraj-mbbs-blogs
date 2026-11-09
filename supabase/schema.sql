-- =====================================================================
--  Run this once in Supabase: Dashboard → SQL Editor → New query → Run
--  It creates the two tables and the security rules.
-- =====================================================================

create extension if not exists pgcrypto;

-- Blog posts -----------------------------------------------------------
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null check (char_length(title) between 1 and 200),
  category     text not null default 'General',
  excerpt      text not null default '',
  cover_url    text not null default '',
  content      text not null default '',
  status       text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Appointments ---------------------------------------------------------
create table if not exists public.appointments (
  id           uuid primary key default gen_random_uuid(),
  patient_name text not null check (char_length(patient_name) between 1 and 120),
  phone        text not null check (char_length(phone) between 7 and 30),
  email        text not null default '' check (char_length(email) <= 160),
  age          int  check (age between 0 and 130),
  gender       text not null default '' check (char_length(gender) <= 20),
  appt_date    date not null,
  appt_time    text not null check (char_length(appt_time) <= 10),
  reason       text not null default '' check (char_length(reason) <= 1000),
  status       text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  notes        text not null default '' check (char_length(notes) <= 2000),
  created_at   timestamptz not null default now()
);
create index if not exists appointments_date_idx on public.appointments (appt_date, appt_time);

-- Security (Row Level Security) ---------------------------------------
-- Visitors (anon):   can read PUBLISHED posts, and can CREATE a pending appointment.
--                    They can never read, change or delete appointments.
-- Doctor (signed in): full access to everything.
alter table public.posts        enable row level security;
alter table public.appointments enable row level security;

drop policy if exists "public reads published posts" on public.posts;
create policy "public reads published posts" on public.posts
  for select to anon using (status = 'published');

drop policy if exists "doctor manages posts" on public.posts;
create policy "doctor manages posts" on public.posts
  for all to authenticated using (true) with check (true);

drop policy if exists "public books appointments" on public.appointments;
create policy "public books appointments" on public.appointments
  for insert to anon
  with check (status = 'pending' and notes = '' and appt_date >= current_date and appt_date <= current_date + 60);

drop policy if exists "doctor manages appointments" on public.appointments;
create policy "doctor manages appointments" on public.appointments
  for all to authenticated using (true) with check (true);

-- IMPORTANT: turn OFF public sign-ups so only you have a doctor account:
-- Dashboard → Authentication → Sign In / Providers → "Allow new users to sign up" = off
