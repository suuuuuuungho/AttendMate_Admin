-- NameCard 탭: 생성한 명찰 출력을 "NNN 명찰출력"으로 저장해두고 언제든 그 버전 그대로
-- 다시 불러와 인쇄할 수 있게 하는 로그 테이블. members는 저장 시점의 이름/학년반을
-- 그대로 얼려서(snapshot) 담아두므로, 나중에 회원 정보가 바뀌어도 저장된 출력물은
-- 항상 그때 그 내용으로 재현된다.
create table if not exists public."NameCardBatch" (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  members jsonb not null
);

alter table public."NameCardBatch" disable row level security;
