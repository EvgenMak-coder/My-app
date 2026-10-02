-- «Небесный дракон»: начальная схема.
-- Выполнить один раз в Supabase: SQL Editor → вставить → Run.

create table profile (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  dragon_name text not null default 'Небесный дракон'
);

create table life_areas (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  name text not null,
  value int not null default 0 check (value between 0 and 100),
  position int not null default 0
);

create table life_area_history (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  area_id uuid not null references life_areas on delete cascade,
  value int not null check (value between 0 and 100),
  at timestamptz not null default now()
);

create table skills (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  category text not null check (category in ('hard', 'soft', 'hobby')),
  name text not null,
  value int not null default 0 check (value between 0 and 100),
  position int not null default 0
);

create table skill_history (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  skill_id uuid not null references skills on delete cascade,
  value int not null check (value between 0 and 100),
  at timestamptz not null default now()
);

create table xp_events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source text not null check (source in ('skill', 'area', 'deed')),
  amount int not null check (amount >= 0),
  note text not null default '',
  at timestamptz not null default now()
);

create index on life_area_history (area_id, at);
create index on skill_history (skill_id, at);
create index on xp_events (user_id, at);

-- Каждый видит и меняет только свои строки; без входа не видно ничего.
alter table profile enable row level security;
alter table life_areas enable row level security;
alter table life_area_history enable row level security;
alter table skills enable row level security;
alter table skill_history enable row level security;
alter table xp_events enable row level security;

create policy own_rows on profile for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on life_areas for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on life_area_history for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on skills for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on skill_history for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on xp_events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
