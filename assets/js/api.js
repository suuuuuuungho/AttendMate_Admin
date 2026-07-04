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
    const data = await fetchAllRows(`/rest/v1/Member?select=ID,Name,Division,Phone&order=ID.asc`);
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

export async function setTimeControl(time, active) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/TimeControl?Time=eq.${encodeURIComponent(time)}`, {
      method: "PATCH",
      headers: returnRepresentation(),
      body: JSON.stringify({ Active: active }),
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
