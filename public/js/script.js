// ============================================================
// 보라박쥐단 (Borabakjwidan) - ADVENTURE ARCHIVE
// 모든 페이지에서 공통으로 로드되는 스크립트
//
// 이 파일은 "점진적 개선(progressive enhancement)" 방식으로 동작합니다.
// - js/api.js를 통해 백엔드(server.js)가 켜져 있으면 실시간 데이터를 불러와
//   화면을 새로 그립니다 (공지/아카이브/굿즈/방명록/게시판).
// - 백엔드가 꺼져있거나 파일을 그냥 더블클릭해서 열었을 때는 API 호출이
//   조용히 실패하고, 원래 HTML에 적혀있던 정적 예시 데이터가 그대로 보입니다.
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  initScrollSpy();
  initToastButtons();
  initGuestbookForm();
  initImageFallback();
  initFilterTabs();
  initBoardTabs();
  initGameButtons();
  initCartButtons();
  initPartyButtons();
  initLoadMoreButtons();
  initCommunityWriteButton();
  hydrateFromServer();
});

/* ---------- Toast helper ---------- */
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

/* ---------- Mobile nav toggle ---------- */
function initMobileNav() {
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("mainNav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    nav.classList.toggle("open");
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
    });
  });
}

/* ---------- Highlight nav link matching in-page scroll position (index.html only) ---------- */
function initScrollSpy() {
  const navLinks = Array.from(document.querySelectorAll(".main-nav a"));
  if (navLinks.length === 0) return;

  const sections = navLinks
    .map((link) => {
      const href = link.getAttribute("href");
      if (!href || !href.startsWith("#")) return null;
      const el = document.querySelector(href);
      return el ? { link, el } : null;
    })
    .filter(Boolean);

  if (sections.length === 0) return;

  const setActive = (link) => {
    navLinks.forEach((l) => l.classList.remove("active"));
    link.classList.add("active");
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const match = sections.find((s) => s.el === entry.target);
          if (match) setActive(match.link);
        }
      });
    },
    { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
  );

  sections.forEach((s) => observer.observe(s.el));
}

/* ---------- Buttons that just give feedback (placeholder actions) ---------- */
function initToastButtons() {
  const map = {
    searchBtn: "검색 기능은 준비 중이에요 🔍",
    cartBtn: "장바구니를 확인합니다 🛒",
  };

  Object.entries(map).forEach(([id, message]) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        showToast(message);
      });
    }
  });
}

/* ---------- Party page: '방 입장' / '지원하기' buttons (event delegation) ---------- */
function initPartyButtons() {
  // '방 입장' 버튼은 이제 character.html?id=... 로 실제 이동하는 링크입니다.
  // (캐릭터 방 게시판 기능 추가 이전에는 안내 토스트만 띄웠지만, 지금은 진짜 페이지로 이동합니다)
  document.body.addEventListener("click", (e) => {
    if (e.target.closest("#joinPartyBtn")) {
      showToast("지원서 양식을 준비하고 있어요! 곧 만나요 🦇");
    }
  });
}

/* ---------- Minigame page: '게임 시작' buttons (event delegation) ---------- */
function initGameButtons() {
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest(".play-game-btn");
    if (!btn) return;
    const name = btn.dataset.game || "게임";
    showToast(`${name}을(를) 불러오는 중입니다... 🎮`);
  });
}

/* ---------- Goods page: '장바구니 담기' buttons (event delegation, supports server-hydrated cards) ---------- */
function initCartButtons() {
  const state = { count: 0 };
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest(".add-cart-btn");
    if (!btn) return;
    const name = btn.dataset.name || "상품";
    state.count += 1;
    showToast(`${name}이(가) 장바구니에 담겼습니다 (${state.count}개)`);
  });
}

/* ---------- Load more buttons (archive page) ---------- */
function initLoadMoreButtons() {
  const btn = document.getElementById("archiveLoadMore");
  if (!btn) return;
  btn.addEventListener("click", () => {
    showToast("최신 기록을 모두 불러왔어요 📜");
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.textContent = "마지막 기록입니다";
  });
}

/* ---------- Generic filter tabs (archive / minigame / goods pages) ----------
   grid 내용이 서버 데이터로 나중에 교체되어도 동작하도록,
   클릭 시점에 매번 최신 아이템 목록을 다시 조회합니다. */
function initFilterTabs() {
  document.querySelectorAll(".filter-tabs").forEach((tabGroup) => {
    const grid = tabGroup.nextElementSibling;
    if (!grid) return;

    tabGroup.addEventListener("click", (e) => {
      const tab = e.target.closest(".filter-tab");
      if (!tab) return;

      tabGroup.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const filter = tab.dataset.filter;
      grid.querySelectorAll("[data-category]").forEach((item) => {
        if (filter === "all" || item.dataset.category === filter) {
          item.classList.remove("hidden-item");
        } else {
          item.classList.add("hidden-item");
        }
      });
    });
  });
}

/* ---------- Community board tabs ---------- */
function initBoardTabs() {
  const tabGroup = document.getElementById("boardTabs");
  if (!tabGroup) return;

  tabGroup.addEventListener("click", (e) => {
    const tab = e.target.closest(".board-tab");
    if (!tab) return;

    tabGroup.querySelectorAll(".board-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    document.querySelectorAll(".board-panel").forEach((panel) => panel.classList.remove("active"));
    const target = document.getElementById(`board-${tab.dataset.board}`);
    if (target) target.classList.add("active");
  });
}

/* ---------- Show a placeholder pattern if assets/*.png aren't downloaded yet ---------- */
function initImageFallback() {
  document.querySelectorAll('img[src^="assets/"]').forEach((img) => {
    img.addEventListener(
      "error",
      () => {
        img.classList.add("img-fallback");
      },
      { once: true }
    );
  });
}

/* ============================================================
   방명록 작성 - 백엔드가 켜져 있으면 서버에 저장되고(새로고침해도 유지),
   꺼져있으면 예전처럼 화면에서만 즉시 반영됩니다.
   ============================================================ */
function initGuestbookForm() {
  const form = document.getElementById("guestbookForm");
  const grid = document.getElementById("guestbookGrid");
  const countEl = document.getElementById("guestbookCount");
  if (!form || !grid) return;

  const emojis = ["🛡️", "🗡️", "🏹", "🔥", "❄️", "🌙", "⭐", "🍀"];

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById("gbName");
    const roleInput = document.getElementById("gbRole");
    const messageInput = document.getElementById("gbMessage");

    const name = nameInput.value.trim();
    const role = roleInput.value.trim() || "모험가";
    const message = messageInput.value.trim();

    if (!name || !message) {
      showToast("닉네임과 메시지를 입력해주세요!");
      return;
    }

    if (window.API) {
      try {
        await API.post("/api/guestbook", { name, role, message });
        form.reset();
        showToast("방명록이 등록되었습니다! 📜 (서버에 저장됨)");
        await renderGuestbook();
        return;
      } catch (err) {
        // 서버가 꺼져있으면 아래 로컬 처리로 넘어감
      }
    }

    const card = document.createElement("div");
    card.className = "guestbook-card";
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(
      today.getDate()
    ).padStart(2, "0")}`;

    card.innerHTML = buildGuestbookCardHtml({ name, role, message, date: dateStr, emoji });
    grid.prepend(card);

    if (countEl) {
      const current = parseInt((countEl.textContent || "").replace(/[^0-9]/g, ""), 10) || 0;
      countEl.textContent = `총 ${current + 1}개의 메시지`;
    }

    form.reset();
    showToast("방명록이 등록되었습니다! 📜 (이 브라우저에만 임시 저장됨)");
  });
}

function buildGuestbookCardHtml(entry) {
  return `
    <div class="guestbook-card-header">
      <div class="guestbook-avatar">${escapeHtml(entry.emoji || "🦇")}</div>
      <div class="guestbook-card-meta">
        <span class="name">${escapeHtml(entry.name)}</span>
        <span class="sub">
          <span class="tag" style="background:var(--purple-soft);color:var(--purple);">${escapeHtml(entry.role)}</span>
          <span class="date">${escapeHtml(entry.date)}</span>
        </span>
      </div>
    </div>
    <hr />
    <p class="guestbook-card-message">${escapeHtml(entry.message)}</p>
  `;
}

/* ============================================================
   서버 데이터로 화면을 새로 그리는 함수들 (Progressive Enhancement)
   ============================================================ */

async function hydrateFromServer() {
  if (!window.API) return;
  await Promise.allSettled([
    renderNotices(),
    renderArchive(),
    renderGoods(),
    renderGuestbook(),
    renderBoards(),
    renderMinigames(),
  ]);
}

async function renderNotices() {
  const list = document.getElementById("noticeList");
  if (!list) return;
  try {
    const notices = await API.get("/api/notices");
    const limit = parseInt(list.dataset.limit || "0", 10) || notices.length;
    list.innerHTML = notices
      .slice(0, limit)
      .map(
        (n) => `
        <div class="notice-row">
          <div class="notice-row-title"><span class="notice-dot"></span><span>${escapeHtml(n.title)}</span></div>
          <span class="notice-date">${escapeHtml(n.date)}</span>
        </div>`
      )
      .join("");
  } catch (e) {
    /* 서버 미실행: 정적 내용 유지 */
  }
}

const ARCHIVE_TAG_LABEL = { photo: "사진", video: "영상", illustration: "일러스트", review: "리뷰" };
const ARCHIVE_TAG_CLASS = {
  photo: "tag-photo",
  video: "tag-video",
  illustration: "tag-illustration",
  review: "tag-review",
};

function archiveCardHtml(item) {
  const cls = ARCHIVE_TAG_CLASS[item.category] || "tag-photo";
  const label = ARCHIVE_TAG_LABEL[item.category] || item.category;
  return `
    <article class="archive-card clickable" data-category="${escapeHtml(item.category)}" data-id="${escapeHtml(item.id)}">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />
      <div>
        <div class="archive-meta">
          <span class="tag ${cls}">${escapeHtml(label)}</span>
          <span class="archive-date">${escapeHtml(item.date)}</span>
        </div>
        <p class="archive-card-title">${escapeHtml(item.title)}</p>
      </div>
    </article>
  `;
}

async function renderArchive() {
  const preview = document.getElementById("archiveGridPreview");
  const full = document.getElementById("archiveGrid");
  if (!preview && !full) return;
  try {
    const items = await API.get("/api/archive");
    if (preview) {
      const limit = parseInt(preview.dataset.limit || "0", 10) || items.length;
      preview.innerHTML = items.slice(0, limit).map(archiveCardHtml).join("");
    }
    if (full) {
      full.innerHTML = items.map(archiveCardHtml).join("");
      // 필터 탭이 "전체"가 아닌 상태로 남아있을 수 있으므로 다시 전체 보이기로 리셋하지 않고
      // 현재 활성 필터를 유지해 적용합니다.
      const tabGroup = full.previousElementSibling;
      const activeTab = tabGroup && tabGroup.querySelector(".filter-tab.active");
      const filter = activeTab ? activeTab.dataset.filter : "all";
      full.querySelectorAll("[data-category]").forEach((el) => {
        el.classList.toggle("hidden-item", !(filter === "all" || el.dataset.category === filter));
      });
    }
  } catch (e) {
    /* 서버 미실행: 정적 내용 유지 */
  }
}

const GOODS_CATEGORY_LABEL = { badge: "뱃지/키링", figure: "스탠드/피규어", stationery: "문구", living: "리빙" };

function goodsCardHtml(item) {
  return `
    <div class="goods-card clickable" data-category="${escapeHtml(item.category)}" data-id="${escapeHtml(item.id)}">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />
      <div class="goods-card-name">${escapeHtml(item.name)}</div>
      <div class="goods-card-price">₩ ${Number(item.price).toLocaleString("ko-KR")}</div>
      <button class="btn-outline add-cart-btn" data-name="${escapeHtml(item.name)}">장바구니 담기</button>
    </div>
  `;
}

function goodsPreviewCardHtml(item) {
  return `
    <div class="goods-card" data-category="${escapeHtml(item.category)}" data-id="${escapeHtml(item.id)}">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" />
      <div class="goods-card-name">${escapeHtml(item.name)}</div>
      <div class="goods-card-price">₩ ${Number(item.price).toLocaleString("ko-KR")}</div>
    </div>
  `;
}

async function renderGoods() {
  const preview = document.getElementById("goodsGridPreview");
  const full = document.getElementById("goodsGrid");
  if (!preview && !full) return;
  try {
    const items = await API.get("/api/goods");
    if (preview) {
      const limit = parseInt(preview.dataset.limit || "0", 10) || items.length;
      preview.innerHTML = items.slice(0, limit).map(goodsPreviewCardHtml).join("");
    }
    if (full) {
      full.innerHTML = items.map(goodsCardHtml).join("");
      const tabGroup = full.previousElementSibling;
      const activeTab = tabGroup && tabGroup.querySelector(".filter-tab.active");
      const filter = activeTab ? activeTab.dataset.filter : "all";
      full.querySelectorAll("[data-category]").forEach((el) => {
        el.classList.toggle("hidden-item", !(filter === "all" || el.dataset.category === filter));
      });
    }
  } catch (e) {
    /* 서버 미실행: 정적 내용 유지 */
  }
}

async function renderGuestbook() {
  const grid = document.getElementById("guestbookGrid");
  const countEl = document.getElementById("guestbookCount");
  if (!grid) return;
  try {
    const list = await API.get("/api/guestbook");
    const limit = parseInt(grid.dataset.limit || "0", 10) || list.length;
    grid.innerHTML = list
      .slice(0, limit)
      .map((entry) => `<div class="guestbook-card" data-id="${escapeHtml(entry.id)}">${buildGuestbookCardHtml(entry)}</div>`)
      .join("");
    if (countEl) countEl.textContent = `총 ${list.length}개의 메시지`;
  } catch (e) {
    /* 서버 미실행: 정적 내용 유지 */
  }
}

const DIFFICULTY_LABEL = { easy: "쉬움", normal: "보통", hard: "어려움" };
const DIFFICULTY_CLASS = { easy: "difficulty-easy", normal: "difficulty-normal", hard: "difficulty-hard" };

function minigameCardHtml(item) {
  const label = DIFFICULTY_LABEL[item.category] || item.category;
  const cls = DIFFICULTY_CLASS[item.category] || "difficulty-easy";
  const colorFrom = item.colorFrom || "#5c2d91";
  const colorTo = item.colorTo || "#2f1750";
  return `
    <div class="minigame-card clickable" data-category="${escapeHtml(item.category)}" data-id="${escapeHtml(item.id)}">
      <div class="minigame-icon" style="background:linear-gradient(135deg,${escapeHtml(colorFrom)},${escapeHtml(colorTo)});">${escapeHtml(item.icon || "🎮")}</div>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="desc">${escapeHtml(item.description)}</p>
      <div class="meta-row">
        <span class="tag ${cls}">난이도: ${escapeHtml(label)}</span>
        ${item.highlight ? `<span class="tag" style="background:var(--purple-soft);color:var(--purple);">${escapeHtml(item.highlight)}</span>` : ""}
      </div>
      <button class="btn btn-primary play-game-btn" data-game="${escapeHtml(item.title)}">게임 시작</button>
    </div>
  `;
}

async function renderMinigames() {
  const grid = document.getElementById("gameGrid");
  if (!grid) return;
  try {
    const items = await API.get("/api/minigame");
    grid.innerHTML = items.map(minigameCardHtml).join("");
    const tabGroup = grid.previousElementSibling;
    const activeTab = tabGroup && tabGroup.querySelector(".filter-tab.active");
    const filter = activeTab ? activeTab.dataset.filter : "all";
    grid.querySelectorAll("[data-category]").forEach((el) => {
      el.classList.toggle("hidden-item", !(filter === "all" || el.dataset.category === filter));
    });
  } catch (e) {
    /* 서버 미실행: 정적 내용 유지 */
  }
}

function boardRowHtml(post) {
  const tagStyleMap = {
    notice: 'style="background:var(--purple-soft);color:var(--purple);"',
    free: 'class="tag-photo"',
    qna: 'style="background:#fef3c7;color:#92400e;"',
    cert: 'style="background:#dcfce7;color:#166534;"',
  };
  const labelMap = { notice: "공지", free: "잡담", qna: "질문", cert: "인증" };
  const tagAttr = tagStyleMap[post.category] || "";
  return `
    <a class="board-row" href="post.html?id=${encodeURIComponent(post.id)}" data-id="${escapeHtml(post.id)}">
      <span class="tag" ${tagAttr}>${escapeHtml(labelMap[post.category] || post.category)}</span>
      <span class="board-title">${escapeHtml(post.title)}</span>
      <span class="board-meta"><span>${escapeHtml(post.author)}</span><span>조회 ${post.views ?? 0}</span><span>${escapeHtml(post.date)}</span></span>
    </a>
  `;
}

/* ---------- 커뮤니티 페이지: 관리자로 로그인되어 있으면 "새 글 쓰기" 버튼 표시 ---------- */
async function initCommunityWriteButton() {
  const btn = document.getElementById("writePostBtn");
  if (!btn || !window.API) return;
  try {
    const status = await API.get("/api/auth/status");
    if (status.loggedIn) btn.style.display = "";
  } catch (e) {
    /* 비로그인/서버 미실행: 버튼 숨김 유지 */
  }
}

async function renderBoards() {
  const containers = {
    notice: document.getElementById("boardListNotice"),
    free: document.getElementById("boardListFree"),
    qna: document.getElementById("boardListQna"),
    cert: document.getElementById("boardListCert"),
  };
  if (!containers.notice && !containers.free && !containers.qna && !containers.cert) return;

  try {
    const all = await API.get("/api/board");
    Object.entries(containers).forEach(([category, el]) => {
      if (!el) return;
      const items = all.filter((p) => p.category === category);
      el.innerHTML = items.map(boardRowHtml).join("") || `<p style="padding:16px 8px;color:var(--text-muted);font-size:14px;">아직 게시글이 없습니다.</p>`;
    });
  } catch (e) {
    /* 서버 미실행: 정적 내용 유지 */
  }
}
