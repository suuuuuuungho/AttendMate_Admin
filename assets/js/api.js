import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const headers = (extra = {}) => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  ...extra,
});
const returnRepresentation = () => headers({ Prefer: "return=representation" });

function toMember(row) {
  return { 회원ID: String(row.ID), 이름: row.Name, 학년반: row.Division, 전화: row.Phone || "" };
}

// PostgREST 기본 1000행 제한을 넘는 전체 회원(1487명)을 한 번에 다 받아오기 위한 페이지네이션.
const PAGE_SIZE = 1000;
async function fetchAllRows(path) {
  let all = [];
  let offset = 0;
  while (true) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${SUPABASE_URL}${path}${sep}limit=${PAGE_SIZE}&offset=${offset}`, { headers: headers() });
    const page = await res.json();
    if (!Array.isArray(page) || !page.length) break;
    all = all.concat(page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

/* ===================== Member CRUD ===================== */

export async function getAllMembers() {
  try {
    const data = await fetchAllRows(`/rest/v1/Member?select=ID,Name,Division,Phone&order=Division.asc,Name.asc`);
    return { members: data.map(toMember) };
  } catch (e) {
    return { members: [] };
  }
}

/**
 * 신규 등록 전용 자동 회원ID. 실제 교적 ID(31~299757 등)와 절대 겹치지 않도록
 * "999999" 접두어 뒤에 순번을 붙인다 (예: 9999991, 9999992, ..., 999999100).
 * ID 컬럼이 숫자(bigint)라서 문자를 섞을 수 없어 이 형태로 정했다.
 */
export async function getNextGeneratedId() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/Member?select=ID&ID=gte.9999990&order=ID.desc&limit=1`,
      { headers: headers() }
    );
    const data = await res.json();
    if (Array.isArray(data) && data.length) {
      const suffix = parseInt(String(data[0].ID).slice(6), 10);
      const next = (Number.isNaN(suffix) ? 0 : suffix) + 1;
      return "999999" + next;
    }
    return "9999991";
  } catch (e) {
    return "9999991";
  }
}

/** ID가 이미 있으면 회원ID 중복 — 등록 전 존재 여부를 먼저 확인한다. */
export async function memberExists(id) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/Member?ID=eq.${Number(id)}&select=ID`, { headers: headers() });
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch (e) {
    return false;
  }
}

export async function createMember({ 회원ID, 이름, 학년반, 전화 }) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/Member`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ ID: Number(회원ID), Name: 이름, Division: 학년반, Phone: 전화 || null }),
    });
    if (res.status === 201) return { success: true };
    if (res.status === 409) return { success: false, error: "이미 존재하는 회원ID입니다: " + 회원ID };
    const data = await res.json().catch(() => ({}));
    return { success: false, error: data.message || "등록에 실패했습니다" };
  } catch (e) {
    return { success: false, error: "네트워크 오류: " + e.message };
  }
}

export async function updateMember({ 회원ID, 이름, 학년반, 전화 }) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/Member?ID=eq.${Number(회원ID)}`, {
      method: "PATCH",
      headers: returnRepresentation(),
      body: JSON.stringify({ Name: 이름, Division: 학년반, Phone: 전화 || null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.message || "수정에 실패했습니다" };
    }
    const data = await res.json();
    if (!data || !data.length) return { success: false, error: "회원을 찾을 수 없습니다" };
    return { success: true };
  } catch (e) {
    return { success: false, error: "네트워크 오류: " + e.message };
  }
}

/* ===================== 보고서 ===================== */

/** 보고서 집계용 — 전체 Log(회원ID, 타임)를 페이지네이션으로 다 받아온다. */
export async function getAttendanceLog() {
  try {
    const data = await fetchAllRows(`/rest/v1/Log?select=ID,Time`);
    return { records: data.map((r) => ({ 회원ID: String(r.ID), 타임: r.Time })) };
  } catch (e) {
    return { records: [] };
  }
}

/* ===================== 명찰 출력 로그 (NameCard) =====================
 * 저장 시점의 이름/학년반을 그대로 얼려서(snapshot) 담아두므로, 나중에 회원 정보가
 * 바뀌어도 저장된 출력물은 항상 그때 그 내용으로 재현된다. */

/** members: [{ 회원ID, 이름, 학년반 }, ...] — 채워진 슬롯 순서 그대로.
 * name을 비워두면(null) 목록에서 "NNN 명찰출력" 자동 번호 이름으로 표시된다. */
export async function saveNameCardBatch(members, name) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/NameCardBatch`, {
      method: "POST",
      headers: returnRepresentation(),
      body: JSON.stringify({ members, name: name || null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.message || "저장에 실패했습니다" };
    }
    const data = await res.json();
    if (!data || !data.length) return { success: false, error: "저장 결과를 확인할 수 없습니다" };
    return { success: true, batch: data[0] };
  } catch (e) {
    return { success: false, error: "네트워크 오류: " + e.message };
  }
}

export async function getNameCardBatches() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/NameCardBatch?select=id,created_at,name,members&order=id.desc`, {
      headers: headers(),
    });
    if (!res.ok) return { batches: [], available: false };
    const data = await res.json();
    return { batches: data, available: true };
  } catch (e) {
    return { batches: [], available: false };
  }
}

export async function deleteNameCardBatch(id) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/NameCardBatch?id=eq.${Number(id)}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.message || "삭제에 실패했습니다" };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: "네트워크 오류: " + e.message };
  }
}

/* ===================== 명찰 템플릿 (NameCard) =====================
 * 배치(NameCardBatch)와 별개 — 템플릿은 "빈 명찰의 디자인"(제목 텍스트/학년반 접미사/
 * 배경색/필드별 정렬·색)만 담는다. 학생을 채운 결과는 여전히 배치로 저장된다. */

export async function getNameCardTemplates() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/NameCardTemplate?select=*&order=id.asc`, { headers: headers() });
    if (!res.ok) return { templates: [], available: false };
    const data = await res.json();
    return { templates: data, available: true };
  } catch (e) {
    return { templates: [], available: false };
  }
}

/** template: { name, title1, title2, division_suffix, background, style } */
export async function createNameCardTemplate(template) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/NameCardTemplate`, {
      method: "POST",
      headers: returnRepresentation(),
      body: JSON.stringify(template),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.message || "템플릿 생성에 실패했습니다" };
    }
    const data = await res.json();
    if (!data || !data.length) return { success: false, error: "생성 결과를 확인할 수 없습니다" };
    return { success: true, template: data[0] };
  } catch (e) {
    return { success: false, error: "네트워크 오류: " + e.message };
  }
}

export async function updateNameCardTemplate(id, template) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/NameCardTemplate?id=eq.${Number(id)}`, {
      method: "PATCH",
      headers: returnRepresentation(),
      body: JSON.stringify(template),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.message || "템플릿 수정에 실패했습니다" };
    }
    const data = await res.json();
    if (!data || !data.length) return { success: false, error: "템플릿을 찾을 수 없습니다" };
    return { success: true, template: data[0] };
  } catch (e) {
    return { success: false, error: "네트워크 오류: " + e.message };
  }
}

export async function deleteNameCardTemplate(id) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/NameCardTemplate?id=eq.${Number(id)}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.message || "삭제에 실패했습니다" };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: "네트워크 오류: " + e.message };
  }
}

/* ===================== 타임 제어 (Control Panel) ===================== */

/**
 * TimeControl 테이블에서 각 타임의 활성 여부를 읽는다. 아직 테이블이 없거나
 * 특정 타임 행이 없으면 기본값 true(활성)로 취급해 기존 동작을 그대로 유지한다.
 */
export async function getTimeControls() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/TimeControl?select=Time,Active`, { headers: headers() });
    if (!res.ok) return { controls: {}, available: false };
    const data = await res.json();
    const controls = {};
    for (const row of data || []) controls[row.Time] = row.Active;
    return { controls, available: true };
  } catch (e) {
    return { controls: {}, available: false };
  }
}

/**
 * PATCH(수정)만 하면 TIMES에 새 타임을 추가했을 때 TimeControl에 아직 그 행이
 * 없어서 "찾을 수 없음"으로 실패한다. upsert(POST + on_conflict)로 없으면
 * 새로 만들고 있으면 갱신하도록 해서, SQL로 미리 행을 심어둘 필요를 없앤다.
 */
export async function setTimeControl(time, active) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/TimeControl?on_conflict=Time`, {
      method: "POST",
      headers: { ...returnRepresentation(), Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ Time: time, Active: active }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.message || "변경에 실패했습니다" };
    }
    const data = await res.json();
    if (!data || !data.length) return { success: false, error: "타임 설정을 찾을 수 없습니다" };
    return { success: true };
  } catch (e) {
    return { success: false, error: "네트워크 오류: " + e.message };
  }
}

/* ===================== 문자 발송 제어 (Control Panel) =====================
 * SmsControl은 id=1 단일 행만 쓰는 전역 스위치 — 꺼두면 출석/출석취소 트리거가
 * 학부모 문자 발송(notify_attendance_sms)을 건너뛴다. */

export async function getSmsControl() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/SmsControl?id=eq.1&select=Enabled`, { headers: headers() });
    if (!res.ok) return { enabled: true, available: false };
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return { enabled: true, available: false };
    return { enabled: data[0].Enabled, available: true };
  } catch (e) {
    return { enabled: true, available: false };
  }
}

export async function setSmsControl(enabled) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/SmsControl?on_conflict=id`, {
      method: "POST",
      headers: { ...returnRepresentation(), Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ id: 1, Enabled: enabled }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.message || "변경에 실패했습니다" };
    }
    const data = await res.json();
    if (!data || !data.length) return { success: false, error: "설정을 찾을 수 없습니다" };
    return { success: true };
  } catch (e) {
    return { success: false, error: "네트워크 오류: " + e.message };
  }
}
