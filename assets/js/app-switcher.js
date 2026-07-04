// 좌측 상단의 앱 이름을 눌러 세 페이지(좌석 배치/출석 통계/관리자) 사이를 오가는 드롭다운.
// 서로 다른 GitHub Pages 배포라 SPA 라우팅이 아니라 실제 페이지 이동이다.
export function initAppSwitcher() {
  const btn = document.getElementById("appSwitcherBtn");
  const menu = document.getElementById("appSwitcherMenu");
  if (!btn || !menu) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === "none" ? "flex" : "none";
  });
  document.addEventListener("click", (e) => {
    if (menu.style.display !== "none" && !menu.contains(e.target) && e.target !== btn) {
      menu.style.display = "none";
    }
  });
}
