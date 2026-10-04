-- Главная: грядущие дни — название и дата, до которой идёт отсчёт.
-- Выполнить в Supabase после 0005_subscriptions.sql: SQL Editor → вставить → Run.

create table countdowns (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  date date not null
);

alter table countdowns enable row level security;

create policy own_rows on countdowns for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
