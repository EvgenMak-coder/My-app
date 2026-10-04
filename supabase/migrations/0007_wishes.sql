-- Желания: то, что хочется купить или сделать, — название, цена и срок (необязательный).
-- Выполнить в Supabase после 0006_countdowns.sql: SQL Editor → вставить → Run.

create table wishes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  price int not null default 0 check (price >= 0),
  date date,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

alter table wishes enable row level security;

create policy own_rows on wishes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
