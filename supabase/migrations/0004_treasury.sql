-- Казна: кредиты, жалованье, доходы и расходы.
-- Выполнить в Supabase после 0003_goals.sql: SQL Editor → вставить → Run.

create table credits (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  total int not null check (total >= 0),
  remaining int not null check (remaining >= 0),
  position int not null default 0
);

create table salaries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  day int not null check (day between 1 and 31),
  amount int not null check (amount >= 0)
);

create table transactions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  amount int not null check (amount >= 0),
  category text not null,
  note text not null default '',
  at timestamptz not null default now()
);

create index on transactions (user_id, at);

alter table credits enable row level security;
alter table salaries enable row level security;
alter table transactions enable row level security;

create policy own_rows on credits for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on salaries for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on transactions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
