-- NameCard 탭: 명찰 "디자인"을 템플릿으로 따로 저장해두고, 여러 개를 만들어 골라 쓸 수 있게
-- 하는 테이블. 템플릿은 제목 2줄 텍스트 + 학년반 뒤에 붙는 문구 + 배경색 + 필드별(제목1/
-- 제목2/이름/학년반) 정렬·글자색 스타일을 담는다. 실제 학생을 채운 결과(NameCardBatch)와는
-- 별개 — 템플릿은 "빈 명찰의 디자인", 배치는 "그 디자인으로 채운 완성본 스냅샷"이다.
create table if not exists public."NameCardTemplate" (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  title1 text not null default '',
  title2 text not null default '',
  division_suffix text not null default '',
  background text not null default '#ffffff',
  style jsonb not null default '{}'::jsonb
);

alter table public."NameCardTemplate" disable row level security;
