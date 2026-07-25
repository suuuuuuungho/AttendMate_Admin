import { ADMIN_PASSWORD, TIMES } from "./config.js?v=12";
import {
  getAllMembers,
  getNextGeneratedId,
  createMember,
  updateMember,
  getTimeControls,
  setTimeControl,
  getAttendanceLog,
} from "./api.js?v=12";
import { initAppSwitcher } from "./app-switcher.js?v=12";
import { GRADE_GROUPS, getGradeGroup, abbreviateClass } from "./grades.js?v=12";

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

/* ===================== 초기화(비밀번호 통과 후) ===================== */
let initialized = false;
function initAdmin() {
  if (initialized) return;
  initialized = true;
  initTabs();
  initMemberTab();
  initNameCardTab();
  initControlTab();
  initReportTab();
}

/* ===================== 탭 전환 ===================== */
function initTabs() {
  const tabs = [...document.querySelectorAll(".admin-tab")];
  const panels = {
    member: document.getElementById("tab-member"),
    namecard: document.getElementById("tab-namecard"),
    control: document.getElementById("tab-control"),
    report: document.getElementById("tab-report"),
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
const memberPageSizeSelect = document.getElementById("memberPageSizeSelect");
const memberPagination = document.getElementById("memberPagination");
const memberPrevPageBtn = document.getElementById("memberPrevPageBtn");
const memberNextPageBtn = document.getElementById("memberNextPageBtn");
const memberPageInfo = document.getElementById("memberPageInfo");

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

/* ===== 페이지네이션 — 1487명을 한 번에 다 그리면 스크롤이 너무 길어서 나눠 보여준다 ===== */
let currentFiltered = [];
let currentPage = 1;

function getPageSize() {
  const v = memberPageSizeSelect.value;
  return v === "all" ? Infinity : parseInt(v, 10);
}

function renderMemberPage() {
  const pageSize = getPageSize();
  const totalPages = Number.isFinite(pageSize) ? Math.max(1, Math.ceil(currentFiltered.length / pageSize)) : 1;
  if (currentPage > totalPages) currentPage = totalPages;
  const start = Number.isFinite(pageSize) ? (currentPage - 1) * pageSize : 0;
  const end = Number.isFinite(pageSize) ? start + pageSize : currentFiltered.length;
  renderMemberTable(currentFiltered.slice(start, end));

  memberPagination.style.display = Number.isFinite(pageSize) && currentFiltered.length ? "flex" : "none";
  memberPageInfo.textContent = `${currentPage} / ${totalPages} 페이지`;
  memberPrevPageBtn.disabled = currentPage <= 1;
  memberNextPageBtn.disabled = currentPage >= totalPages;
}

function setFilteredMembers(list, countLabel) {
  currentFiltered = list;
  currentPage = 1;
  memberCountEl.textContent = countLabel;
  renderMemberPage();
}

async function initMemberTab() {
  memberCountEl.textContent = "명단을 불러오는 중...";
  const res = await getAllMembers();
  allMembers = res.members || [];
  membersLoaded = true;
  populateDivisionOptions();
  setFilteredMembers(allMembers, `전체 ${allMembers.length}명`); // 기본 상태는 전체 명단 — 검색은 이 목록을 좁힐 뿐

  memberSearchInput.addEventListener("input", () => {
    const q = memberSearchInput.value.trim().toLowerCase();
    if (!q) {
      setFilteredMembers(allMembers, `전체 ${allMembers.length}명`);
      return;
    }
    const matches = allMembers.filter(
      (m) =>
        m.이름.toLowerCase().includes(q) ||
        m.회원ID.toLowerCase().includes(q) ||
        (m.학년반 || "").toLowerCase().includes(q) ||
        (m.전화 || "").includes(q)
    );
    setFilteredMembers(matches, `${matches.length}명 검색됨`);
  });

  memberPageSizeSelect.addEventListener("change", () => {
    currentPage = 1;
    renderMemberPage();
  });
  memberPrevPageBtn.addEventListener("click", () => {
    currentPage--;
    renderMemberPage();
  });
  memberNextPageBtn.addEventListener("click", () => {
    currentPage++;
    renderMemberPage();
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

/* ===================== NameCard 탭 =====================
 * 성회 명찰 메일머지 Template.hwp(A4, 2x4=8칸)를 그대로 웹에서 재현한다. 슬롯을 누르면
 * 검색창이 뜨고, 학생을 고르면 그 자리에 실제 명찰(제목/이름/학년반)이 채워진다.
 * "인쇄" 버튼은 브라우저 인쇄 대화상자를 열어 @media print 레이아웃(A4, 2x4)으로 출력한다. */
const NAMECARD_TITLE_LINE1 = "2026 중고등부 하계성회 [중등부]";
const NAMECARD_TITLE_LINE2 = "오직 성령 안에서 무너지지 않는 믿음을 세워가라";
const NAMECARD_SLOT_COUNT = 8;

const namecardSheetEl = document.getElementById("namecardSheet");
const namecardPrintBtn = document.getElementById("namecardPrintBtn");

let namecardSlots = new Array(NAMECARD_SLOT_COUNT).fill(null); // index -> 회원 객체 | null
let namecardSearchingIndex = null; // 검색창이 열려 있는 슬롯 — 한 번에 하나만 연다

function renderNamecardSlot(index) {
  const slotEl = namecardSheetEl.querySelector(`.namecard-slot[data-index="${index}"]`);
  const member = namecardSlots[index];

  if (namecardSearchingIndex === index) {
    slotEl.className = "namecard-slot namecard-slot--searching";
    slotEl.innerHTML = "";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "search-input namecard-slot__search-input";
    input.placeholder = "이름, 회원ID, 학년반 검색";

    const results = document.createElement("div");
    results.className = "namecard-slot__results";

    input.addEventListener("input", async () => {
      if (!membersLoaded) await initMemberTab();
      const q = input.value.trim().toLowerCase();
      results.innerHTML = "";
      if (!q) return;
      const matches = allMembers
        .filter(
          (m) =>
            m.이름.toLowerCase().includes(q) ||
            m.회원ID.toLowerCase().includes(q) ||
            (m.학년반 || "").toLowerCase().includes(q)
        )
        .slice(0, 8);
      for (const m of matches) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "namecard-slot__result";
        const nameSpan = document.createElement("span");
        nameSpan.textContent = m.이름;
        const metaSpan = document.createElement("span");
        metaSpan.className = "namecard-slot__result-meta";
        metaSpan.textContent = abbreviateClass(m.학년반) || m.학년반 || "";
        row.append(nameSpan, metaSpan);
        row.addEventListener("click", () => {
          namecardSlots[index] = m;
          namecardSearchingIndex = null;
          renderNamecardSlot(index);
        });
        results.appendChild(row);
      }
    });

    slotEl.append(input, results);
    input.focus();
    return;
  }

  if (!member) {
    slotEl.className = "namecard-slot";
    slotEl.innerHTML = "";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "namecard-slot__add";
    addBtn.textContent = "+";
    addBtn.addEventListener("click", () => {
      namecardSearchingIndex = index;
      renderNamecardSlot(index);
    });
    slotEl.appendChild(addBtn);
    return;
  }

  slotEl.className = "namecard-slot";
  slotEl.innerHTML = "";
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "namecard-slot__clear";
  clearBtn.setAttribute("aria-label", "비우기");
  clearBtn.textContent = "×";
  clearBtn.addEventListener("click", () => {
    namecardSlots[index] = null;
    renderNamecardSlot(index);
  });

  const card = document.createElement("div");
  card.className = "namecard-card";
  card.innerHTML = `
    <div class="namecard-card__title">
      <div>${NAMECARD_TITLE_LINE1}</div>
      <div>${NAMECARD_TITLE_LINE2}</div>
    </div>
    <div class="namecard-card__name">${member.이름}</div>
    <div class="namecard-card__division">${(abbreviateClass(member.학년반) || member.학년반 || "")} 연세중앙</div>
  `;

  slotEl.append(clearBtn, card);
}

function initNameCardTab() {
  for (let i = 0; i < NAMECARD_SLOT_COUNT; i++) renderNamecardSlot(i);
  namecardPrintBtn.addEventListener("click", () => window.print());
}

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

/* ===================== 보고서 탭 =====================
 * 학년 > 반 단위로 타임별 출석 인원과 "전체 인원(1회 이상 참석)"을 집계해서 반별
 * 소계, 학년별 소계, 전체 합계까지 보여준다. 교사는 GRADE_GROUPS에서 제외하고 집계한다. */
const reportTableWrap = document.getElementById("reportTableWrap");
const reportTableHead = document.getElementById("reportTableHead");
const reportTableBody = document.getElementById("reportTableBody");
const reportEmptyEl = document.getElementById("reportEmpty");
const reportRefreshBtn = document.getElementById("reportRefreshBtn");

let reportLoaded = false;
let currentReportRows = [];

function emptyTimeCounts() {
  return TIMES.map(() => 0);
}

/**
 * members(교사 제외 대상 학년 그룹만 이미 걸러진 상태 아님 — 여기서 그룹별로 직접 필터링)를
 * 학년 > 반으로 묶어 각 반의 타임별/전체 인원을 계산하고, 반별 소계·학년별 소계 행,
 * 마지막에 전체 합계 행까지 이어붙인 평평한 행 목록을 만든다.
 */
function buildReportRows(members, attendanceByTime, attendedAny) {
  const groups = [...GRADE_GROUPS.filter((g) => g.key !== "teacher"), { key: "other", label: "기타" }];
  const rows = [];
  const grand = { byTime: emptyTimeCounts(), any: 0, total: 0 };

  for (const group of groups) {
    const gradeMembers = members.filter((m) => (getGradeGroup(m.학년반)?.key || "other") === group.key);
    if (!gradeMembers.length) continue;

    const byClass = new Map();
    for (const m of gradeMembers) {
      const classKey = abbreviateClass(m.학년반) || "미분류";
      if (!byClass.has(classKey)) byClass.set(classKey, []);
      byClass.get(classKey).push(m);
    }
    const classKeys = [...byClass.keys()].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));

    const gradeSubtotal = { byTime: emptyTimeCounts(), any: 0, total: 0 };
    for (const classKey of classKeys) {
      const classMembers = byClass.get(classKey);
      const byTime = TIMES.map((t) => classMembers.filter((m) => attendanceByTime.get(t)?.has(m.회원ID)).length);
      const any = classMembers.filter((m) => attendedAny.has(m.회원ID)).length;
      rows.push({ type: "class", label: classKey, byTime, any, total: classMembers.length, cssVar: group.cssVar });

      byTime.forEach((c, i) => (gradeSubtotal.byTime[i] += c));
      gradeSubtotal.any += any;
      gradeSubtotal.total += classMembers.length;
    }

    rows.push({ type: "subtotal", label: `${group.label} 소계`, ...gradeSubtotal, cssVar: group.cssVar });
    gradeSubtotal.byTime.forEach((c, i) => (grand.byTime[i] += c));
    grand.any += gradeSubtotal.any;
    grand.total += gradeSubtotal.total;
  }

  rows.push({ type: "grand", label: "전체 합계", ...grand });
  return rows;
}

function renderReportTable(rows) {
  reportTableHead.innerHTML =
    `<th>학년 반</th><th>전체 인원<br>(1회 이상)</th>` + TIMES.map((t) => `<th>${t}</th>`).join("");

  reportTableBody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    const classes = [];
    if (row.type === "grand") classes.push("report-row--grand");
    else if (row.type === "subtotal") classes.push("report-row--subtotal");
    if (row.cssVar) {
      classes.push("report-row--graded");
      tr.style.setProperty("--grade-color", `var(${row.cssVar})`);
    }
    tr.className = classes.join(" ");

    const labelTd = document.createElement("td");
    labelTd.textContent = row.label;
    tr.appendChild(labelTd);

    const anyTd = document.createElement("td");
    anyTd.textContent = `${row.any}명`;
    tr.appendChild(anyTd);

    for (const c of row.byTime) {
      const td = document.createElement("td");
      td.textContent = `${c}명`;
      tr.appendChild(td);
    }

    reportTableBody.appendChild(tr);
  }
}

async function loadReport() {
  reportTableWrap.style.display = "none";
  reportEmptyEl.style.display = "block";
  reportEmptyEl.textContent = "집계하는 중입니다...";

  const [membersRes, logRes] = await Promise.all([getAllMembers(), getAttendanceLog()]);
  const members = membersRes.members || [];

  const attendanceByTime = new Map();
  const attendedAny = new Set();
  for (const rec of logRes.records) {
    if (!attendanceByTime.has(rec.타임)) attendanceByTime.set(rec.타임, new Set());
    attendanceByTime.get(rec.타임).add(rec.회원ID);
    attendedAny.add(rec.회원ID);
  }

  const rows = buildReportRows(members, attendanceByTime, attendedAny);
  currentReportRows = rows;
  if (!rows.length) {
    reportEmptyEl.textContent = "집계할 데이터가 없습니다.";
    return;
  }
  reportEmptyEl.style.display = "none";
  reportTableWrap.style.display = "block";
  renderReportTable(rows);
}

/** :root에 정의된 CSS 커스텀 프로퍼티 값을 읽는다 — 캔버스는 var()를 못 쓰니 직접 값을 읽어야 한다. */
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** 헥스 색을 흰색과 ratio 비율로 섞는다 (0=흰색, 1=원색) — 화면의 옅은 배경 톤과 맞추기 위함. */
function mixWithWhite(hex, ratio) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const mix = (c) => Math.round(c * ratio + 255 * (1 - ratio));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

/** 현재 보고서 행들을 화면 표와 같은 배색으로 <canvas>에 직접 그려서 카카오톡 등에 바로 붙여넣을 수 있는 이미지를 만든다. */
function buildReportCanvas(rows) {
  const dpr = window.devicePixelRatio || 1;
  const rowH = 32,
    headerH = 38,
    titleH = 44,
    padX = 10;
  const labelColW = 96;
  const anyColW = 90;
  const timeColW = 92;
  const cols = ["학년 반", "전체 인원(1회 이상)", ...TIMES];
  const colWidths = [labelColW, anyColW, ...TIMES.map(() => timeColW)];
  const tableW = colWidths.reduce((a, b) => a + b, 0);
  const tableH = titleH + headerH + rows.length * rowH;

  const canvas = document.createElement("canvas");
  canvas.width = tableW * dpr;
  canvas.height = tableH * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, tableW, tableH);

  // 타이틀
  ctx.fillStyle = cssVar("--color-primary", "#5856d6");
  ctx.fillRect(0, 0, tableW, titleH);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.font = "700 15px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("출석 Report", padX, titleH / 2);
  ctx.font = "400 11px sans-serif";
  ctx.textAlign = "right";
  const now = new Date();
  ctx.fillText(`${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()} 기준`, tableW - padX, titleH / 2);

  // 헤더
  let y = titleH;
  ctx.fillStyle = "#f5f5f7";
  ctx.fillRect(0, y, tableW, headerH);
  ctx.fillStyle = "#7a7a7a";
  ctx.font = "600 11px sans-serif";
  let x = 0;
  cols.forEach((c, i) => {
    ctx.textAlign = i === 0 ? "left" : "right";
    const tx = i === 0 ? x + padX : x + colWidths[i] - padX;
    ctx.fillText(c, tx, y + headerH / 2);
    x += colWidths[i];
  });
  y += headerH;

  // 행
  for (const row of rows) {
    let bg = "#ffffff";
    let fg = "#1d1d1f";
    let weight = "400";
    if (row.type === "class" && row.cssVar) {
      bg = mixWithWhite(cssVar(row.cssVar, "#ffffff"), 0.22);
    } else if (row.type === "subtotal") {
      bg = row.cssVar ? mixWithWhite(cssVar(row.cssVar, "#ffffff"), 0.4) : "#f5f5f7";
      weight = "700";
    } else if (row.type === "grand") {
      bg = cssVar("--color-primary-soft", "#eeeeff");
      fg = cssVar("--color-primary", "#5856d6");
      weight = "700";
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, y, tableW, rowH);

    ctx.fillStyle = fg;
    ctx.font = `${weight} 12px sans-serif`;
    x = 0;
    const values = [row.label, `${row.any}명`, ...row.byTime.map((c) => `${c}명`)];
    values.forEach((v, i) => {
      ctx.textAlign = i === 0 ? "left" : "right";
      const tx = i === 0 ? x + padX : x + colWidths[i] - padX;
      ctx.fillText(v, tx, y + rowH / 2);
      x += colWidths[i];
    });

    ctx.strokeStyle = "#e8e8ec";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + rowH);
    ctx.lineTo(tableW, y + rowH);
    ctx.stroke();

    y += rowH;
  }

  ctx.strokeStyle = "#e0e0e0";
  ctx.beginPath();
  ctx.moveTo(labelColW + anyColW, titleH);
  ctx.lineTo(labelColW + anyColW, tableH);
  ctx.stroke();

  return canvas;
}

/** 표를 클릭하면 이미지로 만들어 클립보드에 바로 복사 — 클립보드 이미지 쓰기가 안 되는 환경이면 파일로 대신 다운로드한다. */
function copyReportAsImage() {
  if (!currentReportRows.length) return;
  const toast = showToast("이미지를 만드는 중입니다...");
  const canvas = buildReportCanvas(currentReportRows);
  canvas.toBlob(async (blob) => {
    if (!blob) {
      toast.fail("이미지 생성에 실패했습니다.");
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.complete("이미지가 클립보드에 복사되었습니다");
    } catch (e) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "attendance-report.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.complete("클립보드 복사가 지원되지 않아 이미지를 다운로드했습니다");
    }
  }, "image/png");
}

function initReportTab() {
  reportRefreshBtn.addEventListener("click", loadReport);
  reportTableWrap.addEventListener("click", copyReportAsImage);
  const reportTabBtn = document.querySelector('.admin-tab[data-tab="report"]');
  reportTabBtn.addEventListener("click", () => {
    if (reportLoaded) return;
    reportLoaded = true;
    loadReport();
  });
}

/* ===================== 세션 유지 확인 =====================
 * 파일 맨 아래에서 해야 한다 — unlock()이 이 시점 이전에 선언된 모든 const
 * (memberCountEl, timeControlListEl 등)를 곧바로 참조하는데, 이 체크가 파일
 * 위쪽에 있으면 아직 초기화되지 않은 const에 접근하다 "Cannot access before
 * initialization"으로 스크립트 전체가 죽는다 — 새로고침/재방문 시 세션이 남아있어
 * unlock()이 즉시 호출되면서 이 문제가 그대로 드러났었다.
 */
if (sessionStorage.getItem(AUTH_KEY) === "1") {
  unlock();
} else {
  passwordInput.focus();
}
