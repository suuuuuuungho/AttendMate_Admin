-- Control Panel용 타임 활성/비활성 테이블. 각 타임을 한 행씩 두고 Active로 켜고 끈다.
-- AttendMate/AttendMate_Stat은 Active=false인 타임을 드롭다운에서 숨긴다.
CREATE TABLE IF NOT EXISTS public."TimeControl" (
  "Time" text PRIMARY KEY,
  "Active" boolean NOT NULL DEFAULT true
);

ALTER TABLE public."TimeControl" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."TimeControl" REPLICA IDENTITY FULL;

-- 기존 6개 타임을 전부 활성 상태로 미리 채워둔다 (이미 있으면 건드리지 않음).
INSERT INTO public."TimeControl" ("Time", "Active") VALUES
  ('7/27(월) 저녁', true),
  ('7/28(화) 오전', true),
  ('7/28(화) 저녁', true),
  ('7/29(수) 오전', true),
  ('7/29(수) 저녁', true),
  ('7/30(목) 오전', true)
ON CONFLICT ("Time") DO NOTHING;
