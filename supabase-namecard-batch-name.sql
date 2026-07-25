-- NameCardBatch에 사용자가 직접 편집 가능한 파일 제목을 추가한다. 비워두면(=null)
-- 기존처럼 "NNN 명찰출력" 자동 번호 이름으로 표시한다.
alter table public."NameCardBatch" add column if not exists name text;
