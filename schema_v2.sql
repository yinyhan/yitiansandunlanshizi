-- ============================================================
-- Schema v2 — 单密码 owner_token 鉴权 + Edge Function 后端
-- 适合 Vercel + Supabase Edge Functions 部署
-- 在 Supabase Dashboard > SQL Editor 中执行（幂等，可重复跑）
-- ============================================================

-- 1. plans 表（行程）
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_date date,
  end_date date,
  cover_image text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. days 表（每日）
create table if not exists public.days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  day_date date not null,
  note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_days_plan on public.days(plan_id);

-- 3. activities 表（每条活动）
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.days(id) on delete cascade,
  title text not null,
  start_time time,
  end_time time,
  location text,
  address text,
  notes text,
  cost numeric(10,2),
  currency text default 'CNY',
  category text,
  image text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_activities_day on public.activities(day_id);

-- 4. checklist 表（清单）
create table if not exists public.checklist (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  content text not null,
  is_checked boolean not null default false,
  category text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_checklist_plan on public.checklist(plan_id);

-- 5. expenses 表（开销）
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  category text,
  amount numeric(10,2) not null,
  currency text default 'CNY',
  description text,
  expense_date date,
  payer text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_expenses_plan on public.expenses(plan_id);

-- 6. updated_at 自动维护触发器
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_plans_updated      on public.plans;
drop trigger if exists trg_days_updated       on public.days;
drop trigger if exists trg_activities_updated on public.activities;
drop trigger if exists trg_checklist_updated  on public.checklist;
drop trigger if exists trg_expenses_updated   on public.expenses;

create trigger trg_plans_updated      before update on public.plans      for each row execute function public.tg_set_updated_at();
create trigger trg_days_updated       before update on public.days       for each row execute function public.tg_set_updated_at();
create trigger trg_activities_updated before update on public.activities for each row execute function public.tg_set_updated_at();
create trigger trg_checklist_updated  before update on public.checklist  for each row execute function public.tg_set_updated_at();
create trigger trg_expenses_updated   before update on public.expenses   for each row execute function public.tg_set_updated_at();

-- 7. RLS: 所有 anon 角色拒访问（必须走 Edge Function）
--    Edge Function 用 service_role key 绕过 RLS，由代码层做 owner_token 校验
alter table public.plans      enable row level security;
alter table public.days       enable row level security;
alter table public.activities enable row level security;
alter table public.checklist  enable row level security;
alter table public.expenses   enable row level security;

drop policy if exists "deny all anon plans"      on public.plans;
drop policy if exists "deny all anon days"       on public.days;
drop policy if exists "deny all anon activities" on public.activities;
drop policy if exists "deny all anon checklist"  on public.checklist;
drop policy if exists "deny all anon expenses"   on public.expenses;

create policy "deny all anon plans"      on public.plans      for all to anon using (false) with check (false);
create policy "deny all anon days"       on public.days       for all to anon using (false) with check (false);
create policy "deny all anon activities" on public.activities for all to anon using (false) with check (false);
create policy "deny all anon checklist"  on public.checklist  for all to anon using (false) with check (false);
create policy "deny all anon expenses"   on public.expenses   for all to anon using (false) with check (false);

-- ============================================================
-- 鉴权说明
-- ============================================================
-- Edge Function 用 service_role key 调用 Supabase，会完全绕过 RLS，
-- 所以"鉴权"由 Edge Function 代码自己做：检查请求头里的 owner_token
-- 与请求要操作的 plan 是否一致（保存在 Edge Function 环境变量中）。
--
-- 如果未来想让前端直连 Supabase（绕过 Edge Function），需另加 user_id 列
-- 并改成 "用户只能看自己的数据" 的策略。
