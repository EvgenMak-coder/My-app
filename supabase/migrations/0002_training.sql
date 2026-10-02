-- Тренировки: титаны (пять показателей), их история и журнал.
-- Выполнить в Supabase после 0001_init.sql: SQL Editor → вставить → Run.

create table titans (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  name text not null,
  value int not null default 0 check (value between 0 and 100),
  position int not null default 0
);

create table titan_history (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  titan_id uuid not null references titans on delete cascade,
  value int not null check (value between 0 and 100),
  at timestamptz not null default now()
);

create table workouts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  titan_id uuid not null references titans on delete cascade,
  type text not null default '',
  result text not null default '',
  gain int not null default 0 check (gain >= 0),
  at timestamptz not null default now()
);

create index on titan_history (titan_id, at);
create index on workouts (user_id, at);

alter table titans enable row level security;
alter table titan_history enable row level security;
alter table workouts enable row level security;

create policy own_rows on titans for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on titan_history for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on workouts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- опыт теперь приходит и за рост титанов
alter table xp_events drop constraint xp_events_source_check;
alter table xp_events add constraint xp_events_source_check check (source in ('skill', 'area', 'deed', 'titan'));
