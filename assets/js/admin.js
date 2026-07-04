import { ADMIN_PASSWORD, TIMES } from "./config.js?v=2";
import {
  getAllMembers,
  getNextGeneratedId,
  createMember,
  updateMember,
  getTimeControls,
  setTimeControl,
} from "./api.js?v=2";
import { initAppSwitcher } from "./app-switcher.js?v=2";

initAppSwitcher();

/* ===================== 비밀번호 게이트 ===================== */
const passwordGateEl = document.getElementById("passwordGate");
const appRootEl = document.getElementById("appRoot");
const passwordInput = document.getElementById("passwordInput");
const passwordError = document.getElementById("passwordError");
const passwordSubmitBtn = document.getElementById("passwordSubmitBtn");

const AUTH_KEY = "attendmate_admin_authed";

function unlock() {
  sessionStorage.setItem(AUTH_KEY, "1");
  passwordGateEl.style.display = "none";
  appRootEl.style.display = "block";
  initAdmin();
}

function tryPassword() {
  if (passwordInput.value === ADMIN_PASSWORD) {
    unlock();
  } else {
    passwordError.style.display = "block";
    passwordInput.value = "";
    passwordInput.focus();
  }
}

passwordSubmitBtn.addEventListener("click", tryPassword);
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryPassword();
});

if (sessionStorage.getItem(AUTH_KEY) === "1") {
  unlock();
} else {
  passwordInput.focus();
}

/* ===================== 초기화(비밀번호 통과 후) ===================== */
let initialized = false;
function initAdmin() {
  if (initialized) return;
  initialized = true;
  initTabs();
  initMemberTab();
  initControlTab();
}

/* ===================== 탭 전환 ===================== */
function initTabs() {
  const tabs = [...document.querySelectorAll(".admin-tab")];
  const panels = {
    member: document.getElementById("tab-member"),
    namecard: document.getElementById("tab-namecard"),
    control: document.getElementById("tab-control"),
  };

  function selectTab(key) {
    for (const tab of tabs) {
      tab.setAttribute("aria-selected", String(tab.dataset.tab === key));
    }
    for (const [k, panel] of Object.entries(panels)) {
      panel.style.display = k === key ? "block" : "none";
    }
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => selectTab(tab.dataset.tab)));
  selectTab("member");
}

/* ===================== 진행 상태 토스트 ===================== */
let activeToastEl = null;
function showToast(text) {
  if (activeToastEl) activeToastEl.remove();
  const el = document.createElement("div");
  el.className = "toast toast--processing";
  el.textContent = text;
  document.body.appendChild(el);
  activeToastEl = el;
  return {
    complete(msg) {
      el.className = "toast toast--success";
      el.textContent = msg;
      setTimeout(() => {
        if (activeToastEl === el) activeToastEl = null;
        el.remove();
      }, 1800);
    },
    fail(msg) {
      el.className = "toast toast--error";
      el.textContent = msg;
      setTimeout(() => {
        if (activeToastEl === el) activeToastEl = null;
        el.remove();
      }, 2500);
    },
  };
}

/* ===================== Member 탭 ===================== */
let allMembers = [];
let membersLoaded = false;

const memberSearchInput = document.getElementById("memberSearchInput");
const memberCountEl = document.getElementById("memberCount");
const memberTableBody = document.getElementById("memberTableBody");
const memberEmptyEl = document.getElementById("memberEmpty");
const memberAddBtn = document.getElementById("memberAddBtn");

const memberModal = document.getElementById("memberModal");
const memberModalTitle = document.getElementById("memberModalTitle");
const memberIdInput = document.getElementById("memberIdInput");
const memberNameInput = document.getElementById("memberNameInput");
const memberDivisionInput = document.getElementById("memberDivisionInput");
const memberPhoneInput = document.getElementById("memberPhoneInput");
const memberModalError = document.getElementById("memberModalError");
const memberModalCancelBtn = document.getElementById("memberModalCancelBtn");
const memberModalSaveBtn = document.getElementById("memberModalSaveBtn");

let editingMemberId = null; // null이면 신규 등록, 값이 있으면 그 회원ID를 수정 중

async function initMemberTab() {
  memberCountEl.textContent = "명단을 불러오는 중...";
  const res = await getAllMembers();
  allMembers = res.members || [];
  membersLoaded = true;
  populateDivisionOptions();
  memberCountEl.textContent = `전체 ${allMembers.length}명`;
  renderMemberTable(allMembers); // 기본 상태는 전체 명단 — 검색은 이 목록을 좁힐 뿐

  memberSearchInput.addEventListener("input", () => {
    const q = memberSearchInput.value.trim().toLowerCase();
    if (!q) {
      memberCountEl.textContent = `전체 ${allMembers.length}명`;
      renderMemberTable(allMembers);
      return;
    }
    const matches = allMembers.filter(
      (m) =>
        m.이름.toLowerCase().includes(q) ||
        m.회원ID.toLowerCase().includes(q) ||
        (m.학년반 || "").toLowerCase().includes(q) ||
        (m.전화 || "").includes(q)
    );
    memberCountEl.textContent = `${matches.length}명 검색됨`;
    renderMemberTable(matches.slice(0, 200));
  });
}

/** 실제 명단에 있는 학년반 값들로 드롭다운을 채운다 — 오타/자유입력을 막는다. */
function populateDivisionOptions() {
  const divisions = [...new Set(allMembers.map((m) => m.학년반).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ko", { numeric: true })
  );
  memberDivisionInput.innerHTML = divisions.map((d) => `<option value="${d}">${d}</option>`).join("");
}

/** 전화번호는 숫자만, 최대 11자리 — "-" 등 다른 문자는 입력 자체가 안 되게 한다. */
memberPhoneInput.addEventListener("input", () => {
  memberPhoneInput.value = memberPhoneInput.value.replace(/\D/g, "").slice(0, 11);
});

function renderMemberTable(members) {
  memberTableBody.innerHTML = "";
  memberEmptyEl.style.display = members.length ? "none" : "block";
  for (const m of members) {
    const tr = document.createElement("tr");
    const cells = [m.회원ID, m.이름, m.학년반 || "", m.전화 || ""];
    for (const c of cells) {
      const td = document.createElement("td");
      td.textContent = c;
      tr.appendChild(td);
    }
    const actionTd = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "member-table__edit-btn";
    editBtn.textContent = "수정";
    editBtn.addEventListener("click", () => openMemberModal(m));
    actionTd.appendChild(editBtn);
    tr.appendChild(actionTd);
    memberTableBody.appendChild(tr);
  }
}

async function openMemberModal(member) {
  memberModalError.style.display = "none";
  memberIdInput.disabled = true; // 교번은 신규/수정 어느 쪽도 직접 입력하지 않는다
  if (member) {
    editingMemberId = member.회원ID;
    memberModalTitle.textContent = "회원 정보 수정";
    memberIdInput.value = member.회원ID;
    memberNameInput.value = member.이름;
    memberDivisionInput.value = member.학년반 || "";
    memberPhoneInput.value = member.전화 || "";
    memberModal.style.display = "flex";
    memberNameInput.focus();
  } else {
    editingMemberId = null;
    memberModalTitle.textContent = "새 회원 등록";
    memberIdInput.value = "발급 중...";
    memberNameInput.value = "";
    memberDivisionInput.value = "";
    memberPhoneInput.value = "";
    memberModal.style.display = "flex";
    memberIdInput.value = await getNextGeneratedId();
    memberNameInput.focus();
  }
}

function closeMemberModal() {
  memberModal.style.display = "none";
}

memberAddBtn.addEventListener("click", () => openMemberModal(null));
memberModalCancelBtn.addEventListener("click", closeMemberModal);

memberModalSaveBtn.addEventListener("click", async () => {
  const id = memberIdInput.value.trim();
  const name = memberNameInput.value.trim();
  const division = memberDivisionInput.value.trim();
  const phone = memberPhoneInput.value.trim();

  if (!name) {
    memberModalError.textContent = "이름을 입력해주세요.";
    memberModalError.style.display = "block";
    return;
  }
  if (!division) {
    memberModalError.textContent = "학년반을 선택해주세요.";
    memberModalError.style.display = "block";
    return;
  }
  if (phone && !/^\d{11}$/.test(phone)) {
    memberModalError.textContent = "전화번호는 숫자 11자리로 입력해주세요.";
    memberModalError.style.display = "block";
    return;
  }
  memberModalError.style.display = "none";

  const toast = showToast(editingMemberId ? "수정 처리 중입니다..." : "등록 처리 중입니다...");
  memberModalSaveBtn.disabled = true;
  try {
    const res = editingMemberId
      ? await updateMember({ 회원ID: id, 이름: name, 학년반: division, 전화: phone })
      : await createMember({ 회원ID: id, 이름: name, 학년반: division, 전화: phone });

    if (res.success) {
      toast.complete(editingMemberId ? "수정했습니다" : "등록했습니다");
      closeMemberModal();
      const idx = allMembers.findIndex((m) => m.회원ID === id);
      const updated = { 회원ID: id, 이름: name, 학년반: division, 전화: phone };
      if (idx >= 0) allMembers[idx] = updated;
      else allMembers.push(updated);
      populateDivisionOptions();
      memberSearchInput.dispatchEvent(new Event("input"));
    } else {
      toast.fail(res.error || "처리에 실패했습니다.");
    }
  } finally {
    memberModalSaveBtn.disabled = false;
  }
});

/* ===================== Control Panel 탭 ===================== */
const timeControlListEl = document.getElementById("timeControlList");
const timeControlUnavailableEl = document.getElementById("timeControlUnavailable");

async function initControlTab() {
  const { controls, available } = await getTimeControls();
  timeControlUnavailableEl.style.display = available ? "none" : "block";
  timeControlListEl.innerHTML = "";

  for (const time of TIMES) {
    const active = controls[time] !== undefined ? controls[time] : true;

    const row = document.createElement("div");
    row.className = "time-control-row";

    const label = document.createElement("span");
    label.className = "time-control-row__label text-body on-light";
    label.textContent = time;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "time-control-toggle";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-checked", String(active));
    toggle.disabled = !available;
    toggle.addEventListener("click", async () => {
      const next = toggle.getAttribute("aria-checked") !== "true";
      toggle.setAttribute("aria-checked", String(next));
      const toast = showToast(next ? `${time} 활성화 중입니다...` : `${time} 비활성화 중입니다...`);
      const res = await setTimeControl(time, next);
      if (res.success) {
        toast.complete(next ? `${time} 활성화됐습니다` : `${time} 비활성화됐습니다`);
      } else {
        toggle.setAttribute("aria-checked", String(!next));
        toast.fail(res.error || "변경에 실패했습니다.");
      }
    });

    row.append(label, toggle);
    timeControlListEl.appendChild(row);
  }
}
