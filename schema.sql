-- ============================================================
-- Supabase / PostgreSQL 数据库初始化脚本
-- 在 Supabase Dashboard > SQL Editor 中执行
-- ============================================================

-- 1. trips 表
create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  share_code  text unique not null,
  title       text not null default '未命名旅程',
  city        text not null default '',
  map_path    text,
  cover_image_path  text,
  start_date  date,
  end_date    date,
  tab_labels  jsonb not null default '{"setup":"行程","album":"画册","money":"账单","photos":"相册"}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. people 表
create table if not exists public.people (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  name        text not null,
  created_at   timestamptz not null default now()
);

-- 3. itinerary 表
create table if not exists public.itinerary (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  date        date not null,
  hour        integer not null,
  title       text not null default '',
  note        text not null default '',
  created_at  timestamptz not null default now()
);

-- 4. expenses 表
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  category    text not null default '其他',
  date        date not null default current_date,
  note        text not null default '',
  amounts     jsonb not null default '{}',
  paid_by     text not null default '',
  created_at  timestamptz not null default now()
);

-- 5. photos 表
create table if not exists public.photos (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  path        text not null,
  caption     text not null default '',
  uploader_name text not null default '旅行者',
  taken_at    bigint,
  created_at  timestamptz not null default now()
);

-- 6. updated_at 自动更新触发器
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trips_updated_at
  before update on public.trips
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Row Level Security (RLS) — 所有表公开读写（无登录系统）
-- 如需加认证，在这里收紧规则
-- ============================================================
alter table public.trips    enable row level security;
alter table public.people   enable row level security;
alter table public.itinerary enable row level security;
alter table public.expenses  enable row level security;
alter table public.photos   enable row level security;

-- 公开读写策略
create policy "public_all_trips" on public.trips for all using (true) with check (true);
create policy "public_all_people" on public.people for all using (true) with check (true);
create policy "public_all_itinerary" on public.itinerary for all using (true) with check (true);
create policy "public_all_expenses" on public.expenses for all using (true) with check (true);
create policy "public_all_photos" on public.photos for all using (true) with check (true);

-- ============================================================
-- Storage — 图片上传 bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('travel-photos', 'travel-photos', true)
on conflict (id) do nothing;

create policy "public_upload_photos"
  on storage.objects for all
  using (bucket_id = 'travel-photos')
  with check (bucket_id = 'travel-photos');

-- ============================================================
-- API — 共享码（share_code）索引，加速查询
-- ============================================================
create index if not exists idx_trips_share_code on public.trips(share_code);
create index if not exists idx_people_trip_id   on public.people(trip_id);
create index if not exists idx_itinerary_trip_id on public.itinerary(trip_id);
create index if not exists idx_expenses_trip_id  on public.expenses(trip_id);
create index if not exists idx_photos_trip_id    on public.photos(trip_id);
