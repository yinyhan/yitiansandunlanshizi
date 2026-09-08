-- ============================================================
-- 重置数据库：对齐前端 API 期望（trips / people / itinerary / expenses / photos）
-- 幂等脚本：可重复执行，不会因表已存在而失败
-- ⚠️ 此脚本会删掉所有旧数据
-- ============================================================

-- 1. 先删所有可能存在的表（CASCADE 处理外键依赖）
DROP TABLE IF EXISTS public.expenses  CASCADE;
DROP TABLE IF EXISTS public.itinerary CASCADE;
DROP TABLE IF EXISTS public.people    CASCADE;
DROP TABLE IF EXISTS public.photos    CASCADE;
DROP TABLE IF EXISTS public.trips     CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.days       CASCADE;
DROP TABLE IF EXISTS public.plans      CASCADE;
DROP TABLE IF EXISTS public.checklist  CASCADE;

-- 2. 启用 UUID 生成
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 3. trips：旅行主表
CREATE TABLE public.trips (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code      text UNIQUE NOT NULL,
  owner_token     text NOT NULL,
  title           text NOT NULL DEFAULT '未命名旅程',
  city            text NOT NULL DEFAULT '',
  map_path        text,
  cover_image_path text,
  start_date      date,
  end_date        date,
  tab_labels      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trips_share_code_idx ON public.trips (share_code);

-- 4. people：同行人
CREATE TABLE public.people (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  owner_token text NOT NULL,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS people_trip_id_idx ON public.people (trip_id);

-- 5. itinerary：行程
CREATE TABLE public.itinerary (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  owner_token text NOT NULL,
  date        date NOT NULL,
  hour        int  NOT NULL,
  title       text NOT NULL DEFAULT '',
  note        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS itinerary_trip_id_idx ON public.itinerary (trip_id);
CREATE INDEX IF NOT EXISTS itinerary_date_idx    ON public.itinerary (date);

-- 6. expenses：开支
CREATE TABLE public.expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  owner_token text NOT NULL,
  category    text NOT NULL DEFAULT '其他',
  date        date NOT NULL,
  note        text NOT NULL DEFAULT '',
  amounts     jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_by     text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_trip_id_idx ON public.expenses (trip_id);

-- 7. photos：照片
CREATE TABLE public.photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  owner_token   text NOT NULL,
  path          text NOT NULL,
  caption       text NOT NULL DEFAULT '',
  uploader_name text NOT NULL DEFAULT '旅行者',
  taken_at      bigint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photos_trip_id_idx ON public.photos (trip_id);

-- 8. 触发器函数
CREATE OR REPLACE FUNCTION public.touch_trip_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.trips SET updated_at = now() WHERE id = NEW.trip_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS touch_trip_people     ON public.people;
DROP TRIGGER IF EXISTS touch_trip_itinerary  ON public.itinerary;
DROP TRIGGER IF EXISTS touch_trip_expenses   ON public.expenses;
DROP TRIGGER IF EXISTS touch_trip_photos     ON public.photos;

CREATE TRIGGER touch_trip_people    AFTER INSERT OR UPDATE OR DELETE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.touch_trip_updated_at();
CREATE TRIGGER touch_trip_itinerary AFTER INSERT OR UPDATE OR DELETE ON public.itinerary
  FOR EACH ROW EXECUTE FUNCTION public.touch_trip_updated_at();
CREATE TRIGGER touch_trip_expenses  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_trip_updated_at();
CREATE TRIGGER touch_trip_photos    AFTER INSERT OR UPDATE OR DELETE ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.touch_trip_updated_at();

-- 9. RLS
ALTER TABLE public.trips     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read trips"     ON public.trips;
DROP POLICY IF EXISTS "anon read people"    ON public.people;
DROP POLICY IF EXISTS "anon read itinerary" ON public.itinerary;
DROP POLICY IF EXISTS "anon read expenses"  ON public.expenses;
DROP POLICY IF EXISTS "anon read photos"    ON public.photos;

CREATE POLICY "anon read trips"     ON public.trips     FOR SELECT USING (true);
CREATE POLICY "anon read people"    ON public.people    FOR SELECT USING (true);
CREATE POLICY "anon read itinerary" ON public.itinerary FOR SELECT USING (true);
CREATE POLICY "anon read expenses"  ON public.expenses  FOR SELECT USING (true);
CREATE POLICY "anon read photos"    ON public.photos    FOR SELECT USING (true);

-- 10. 验证
SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='trips')     AS trips,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='people')    AS people,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='itinerary') AS itinerary,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='expenses')  AS expenses,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='photos')    AS photos;
