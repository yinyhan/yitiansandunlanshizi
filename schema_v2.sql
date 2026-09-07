-- ============================================================
-- Schema v2 — 加入 owner_token 单密码保护
-- 适合 Vercel + Supabase Edge Functions 部署
-- 在 Supabase Dashboard > SQL Editor 中执行（幂等，可重复跑）
-- ============================================================

-- 1. 给每张表加 owner_token 列
alter table public.trips      add column if not exists owner_token text not null default '';
alter table public.people     add column if not exists owner_token text not null default '';
alter table public.itinerary  add column if not exists owner_token text not null default '';
alter table public.expenses   add column if not exists owner_token text not null default '';
alter table public.photos     add column if not exists owner_token text not null default '';

-- 2. owner_token 索引（按 token 查 trip 用）
create index if not exists idx_trips_owner_token      on public.trips(owner_token);
create index if not exists idx_people_owner_token     on public.people(owner_token);
create index if not exists idx_itinerary_owner_token  on public.itinerary(owner_token);
create index if not exists idx_expenses_owner_token   on public.expenses(owner_token);
create index if not exists idx_photos_owner_token     on public.photos(owner_token);

-- ============================================================
-- 说明
-- ============================================================
-- Edge Function 用 service_role key 调用 Supabase，会完全绕过 RLS，
-- 所以"鉴权"由 Edge Function 代码自己做：检查请求头里的 owner_token
-- 与数据库里对应 trip 的 owner_token 是否一致。
--
-- RLS 保持现状（公开读写），因为我们信任 Edge Function 这一层把关。
-- 如果未来想让前端直连 Supabase（绕过 Edge Function），才需要收紧 RLS。
