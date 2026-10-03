-- Казна: подписки — ежемесячные списания в заданное число.
-- Выполнить в Supabase после 0004_treasury.sql: SQL Editor → вставить → Run.

create table subscriptions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  amount int not null check (amount >= 0),
  day int not null check (day between 1 and 31),
  category text not null default 'other',
  started_at date not null default current_date,
  ended_at date
);

alter table subscriptions enable row level security;

create policy own_rows on subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
