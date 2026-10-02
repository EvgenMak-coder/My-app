-- Цели: пять уровней важности, прогресс, архив.
-- Выполнить в Supabase после 0002_training.sql: SQL Editor → вставить → Run.

create table goals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  level int not null default 3 check (level between 0 and 4),
  progress int not null default 0 check (progress between 0 and 100),
  color text not null,
  -- опыт за завершение выдаётся один раз, даже если цель вернули из архива
  rewarded boolean not null default false,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  position int not null default 0
);

create index on goals (user_id, done_at);

alter table goals enable row level security;

create policy own_rows on goals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table xp_events drop constraint xp_events_source_check;
alter table xp_events add constraint xp_events_source_check check (source in ('skill', 'area', 'deed', 'titan', 'goal'));
