-- Control Panel용 문자 발송 on/off 스위치. 단일 행(id=1)만 두고 Enabled로 켜고 끈다.
-- notify_attendance_sms 트리거(supabase-parent-sms.sql, AttendMate 저장소)가 이 값을
-- 확인해서 꺼져 있으면 문자 발송 자체를 건너뛴다.
CREATE TABLE IF NOT EXISTS public."SmsControl" (
  "id" smallint PRIMARY KEY DEFAULT 1 CHECK ("id" = 1),
  "Enabled" boolean NOT NULL DEFAULT true
);

ALTER TABLE public."SmsControl" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."SmsControl" REPLICA IDENTITY FULL;

INSERT INTO public."SmsControl" ("id", "Enabled") VALUES (1, true)
ON CONFLICT ("id") DO NOTHING;

-- notify_attendance_sms를 다시 정의해서 맨 앞에 SmsControl 확인을 추가한다
-- (나머지 로직은 supabase-parent-sms.sql과 동일).
CREATE OR REPLACE FUNCTION public.notify_attendance_sms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_member record;
  v_event text;
  v_time text;
  v_sms_enabled boolean;
begin
  select "Enabled" into v_sms_enabled from public."SmsControl" where "id" = 1;
  if v_sms_enabled is false then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    v_event := 'checkin';
    v_time := new."Time";
    select "Name", "Division", "ParentPhone" into v_member from public."Member" where "ID" = new."ID";
  elsif tg_op = 'DELETE' then
    v_event := 'cancel';
    v_time := old."Time";
    select "Name", "Division", "ParentPhone" into v_member from public."Member" where "ID" = old."ID";
  else
    return coalesce(new, old);
  end if;

  if v_member is null or v_member."ParentPhone" is null or v_member."ParentPhone" = '' then
    return coalesce(new, old);
  end if;

  perform net.http_post(
    url := 'https://hmczbuzziorgqwgyhati.supabase.co/functions/v1/send-attendance-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_IXVkIRdwEmrEW9Bshsb5dw_okT8thEw'
    ),
    body := jsonb_build_object(
      'event', v_event,
      'time', v_time,
      'name', v_member."Name",
      'division', v_member."Division",
      'parentPhone', v_member."ParentPhone"
    )
  );

  return coalesce(new, old);
end;
$$;
