// ============================================================
// 관리자 로그인/회원가입(admin-login.html) + 대시보드(admin.html) 공용 스크립트
// 이 파일은 반드시 서버(server.js)가 실행 중이어야 동작합니다.
// (관리자 기능은 정적 파일만 열어서는 사용할 수 없습니다 - 인증/저장이 서버 몫이기 때문)
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("authTabs")) initAuthPage();
  if (document.getElementById("adminPanelTabs")) initDashboardPage();
});

function showToastAdmin(message, isError) {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToastAdmin._t);
    showToastAdmin._t = setTimeout(() => toast.classList.remove("show"), 2400);
    return;
  }
  // admin-login.html에는 toast가 없으므로 alert 박스를 사용
  const alertBox = document.getElementById("authAlert");
  if (!alertBox) return;
  alertBox.textContent = message;
  alertBox.className = "admin-alert show " + (isError ? "error" : "success");
}

/* ============================================================
   admin-login.html
   ============================================================ */
async function initAuthPage() {
  const loginTabBtn = document.querySelector('[data-tab="login"]');
  const signupTabBtn = document.getElementById("signupTabBtn");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const signupHint = document.getElementById("signupHint");

  function switchTab(name) {
    document.querySelectorAll(".admin-tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    loginForm.classList.toggle("active", name === "login");
    signupForm.classList.toggle("active", name === "signup");
  }

  document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      switchTab(btn.dataset.tab);
    });
  });

  // 이미 로그인 되어 있거나, 관리자 계정이 아직 없는지 확인
  try {
    const status = await API.get("/api/auth/status");
    if (status.loggedIn) {
      window.location.href = "admin.html";
      return;
    }
    if (status.adminExists) {
      signupTabBtn.disabled = true;
      signupTabBtn.style.opacity = "0.4";
      signupTabBtn.style.cursor = "not-allowed";
      signupHint.style.display = "block";
      switchTab("login");
    } else {
      signupHint.style.display = "none";
      switchTab("signup");
    }
  } catch (e) {
    showToastAdmin("서버에 연결할 수 없습니다. server.js를 먼저 실행해주세요 (start.bat / start.sh).", true);
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    try {
      await API.post("/api/auth/login", { username, password });
      showToastAdmin("로그인 성공! 이동합니다...", false);
      window.location.href = "admin.html";
    } catch (err) {
      showToastAdmin(err.message || "로그인에 실패했습니다.", true);
    }
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("signupUsername").value.trim();
    const password = document.getElementById("signupPassword").value;
    const confirm = document.getElementById("signupPasswordConfirm").value;

    if (password !== confirm) {
      showToastAdmin("비밀번호가 일치하지 않습니다.", true);
      return;
    }

    try {
      await API.post("/api/auth/signup", { username, password });
      showToastAdmin("관리자 계정이 생성되었습니다! 이동합니다...", false);
      window.location.href = "admin.html";
    } catch (err) {
      showToastAdmin(err.message || "회원가입에 실패했습니다.", true);
    }
  });
}

/* ============================================================
   admin.html
   ============================================================ */
async function initDashboardPage() {
  try {
    const status = await API.get("/api/auth/status");
    if (!status.loggedIn) {
      window.location.href = "admin-login.html";
      return;
    }
    document.getElementById("adminUsername").textContent = status.username || "관리자";
  } catch (e) {
    window.location.href = "admin-login.html";
    return;
  }

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    try {
      await API.post("/api/auth/logout", {});
    } catch (e) {
      /* noop */
    }
    window.location.href = "admin-login.html";
  });

  document.querySelectorAll(".admin-panel-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-panel-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".admin-section").forEach((s) => s.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`panel-${tab.dataset.panel}`).classList.add("active");
    });
  });

  bindAdminForm("form-notices", "/api/admin/notices", loadAll);
  bindAdminForm("form-archive", "/api/admin/archive", loadAll);
  bindAdminForm("form-goods", "/api/admin/goods", loadAll);
  bindAdminForm("form-board", "/api/admin/board", loadAll);
  bindMinigameForm();

  await loadAll();
}

function bindAdminForm(formId, endpoint, onSuccess) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await API.post(endpoint, data);
      form.reset();
      showToastAdmin("추가되었습니다.", false);
      await onSuccess();
    } catch (err) {
      showToastAdmin(err.message || "추가에 실패했습니다.", true);
    }
  });
}

async function loadAll() {
  await Promise.allSettled([
    loadStats(),
    loadNotices(),
    loadArchive(),
    loadGoods(),
    loadGuestbook(),
    loadBoard(),
    loadMinigame(),
  ]);
}

async function loadStats() {
  try {
    const s = await API.get("/api/admin/stats");
    document.getElementById("statNotices").textContent = s.notices;
    document.getElementById("statArchive").textContent = s.archive;
    document.getElementById("statGoods").textContent = s.goods;
    document.getElementById("statGuestbook").textContent = s.guestbook;
    document.getElementById("statBoard").textContent = s.board;
    const minigameEl = document.getElementById("statMinigame");
    if (minigameEl) minigameEl.textContent = s.minigame;
  } catch (e) {
    /* noop */
  }
}

function escapeHtmlAdmin(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

async function deleteItem(endpoint, id, reload) {
  if (!confirm("정말 삭제할까요?")) return;
  try {
    await API.del(`${endpoint}/${id}`);
    showToastAdmin("삭제되었습니다.", false);
    reload();
  } catch (err) {
    showToastAdmin(err.message || "삭제에 실패했습니다.", true);
  }
}

async function loadNotices() {
  const tbody = document.getElementById("table-notices");
  if (!tbody) return;
  try {
    const list = await API.get("/api/notices");
    tbody.innerHTML =
      list
        .map(
          (n) => `
      <tr>
        <td>${escapeHtmlAdmin(n.title)}</td>
        <td>${escapeHtmlAdmin(n.date)}</td>
        <td><button class="btn-danger" data-id="${escapeHtmlAdmin(n.id)}">삭제</button></td>
      </tr>`
        )
        .join("") || `<tr><td colspan="3" class="admin-empty">등록된 공지사항이 없습니다.</td></tr>`;
    tbody.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => deleteItem("/api/admin/notices", btn.dataset.id, loadAll));
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="3" class="admin-empty">불러오기 실패</td></tr>`;
  }
}

const ARCHIVE_LABEL = { photo: "사진", video: "영상", illustration: "일러스트", review: "리뷰" };

async function loadArchive() {
  const tbody = document.getElementById("table-archive");
  if (!tbody) return;
  try {
    const list = await API.get("/api/archive");
    tbody.innerHTML =
      list
        .map(
          (a) => `
      <tr>
        <td><img src="${escapeHtmlAdmin(a.image)}" alt="" onerror="this.style.opacity=0.2" /></td>
        <td>${escapeHtmlAdmin(a.title)}</td>
        <td>${escapeHtmlAdmin(ARCHIVE_LABEL[a.category] || a.category)}</td>
        <td>${escapeHtmlAdmin(a.date)}</td>
        <td><button class="btn-danger" data-id="${escapeHtmlAdmin(a.id)}">삭제</button></td>
      </tr>`
        )
        .join("") || `<tr><td colspan="5" class="admin-empty">등록된 아카이브가 없습니다.</td></tr>`;
    tbody.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => deleteItem("/api/admin/archive", btn.dataset.id, loadAll));
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-empty">불러오기 실패</td></tr>`;
  }
}

const GOODS_LABEL = { badge: "뱃지/키링", figure: "스탠드/피규어", stationery: "문구", living: "리빙" };

async function loadGoods() {
  const tbody = document.getElementById("table-goods");
  if (!tbody) return;
  try {
    const list = await API.get("/api/goods");
    tbody.innerHTML =
      list
        .map(
          (g) => `
      <tr>
        <td><img src="${escapeHtmlAdmin(g.image)}" alt="" onerror="this.style.opacity=0.2" /></td>
        <td>${escapeHtmlAdmin(g.name)}</td>
        <td>₩ ${Number(g.price).toLocaleString("ko-KR")}</td>
        <td>${escapeHtmlAdmin(GOODS_LABEL[g.category] || g.category)}</td>
        <td><button class="btn-danger" data-id="${escapeHtmlAdmin(g.id)}">삭제</button></td>
      </tr>`
        )
        .join("") || `<tr><td colspan="5" class="admin-empty">등록된 상품이 없습니다.</td></tr>`;
    tbody.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => deleteItem("/api/admin/goods", btn.dataset.id, loadAll));
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-empty">불러오기 실패</td></tr>`;
  }
}

async function loadGuestbook() {
  const tbody = document.getElementById("table-guestbook");
  if (!tbody) return;
  try {
    const list = await API.get("/api/guestbook");
    tbody.innerHTML =
      list
        .map(
          (g) => `
      <tr>
        <td>${escapeHtmlAdmin(g.name)}</td>
        <td>${escapeHtmlAdmin(g.role)}</td>
        <td style="max-width:320px;">${escapeHtmlAdmin(g.message)}</td>
        <td>${escapeHtmlAdmin(g.date)}</td>
        <td><button class="btn-danger" data-id="${escapeHtmlAdmin(g.id)}">삭제</button></td>
      </tr>`
        )
        .join("") || `<tr><td colspan="5" class="admin-empty">등록된 방명록이 없습니다.</td></tr>`;
    tbody.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => deleteItem("/api/admin/guestbook", btn.dataset.id, loadAll));
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-empty">불러오기 실패</td></tr>`;
  }
}

const BOARD_LABEL = { notice: "공지", free: "자유", qna: "질문", cert: "인증" };

async function loadBoard() {
  const tbody = document.getElementById("table-board");
  if (!tbody) return;
  try {
    const list = await API.get("/api/board");
    tbody.innerHTML =
      list
        .map(
          (b) => `
      <tr>
        <td>${escapeHtmlAdmin(BOARD_LABEL[b.category] || b.category)}</td>
        <td>${escapeHtmlAdmin(b.title)}</td>
        <td>${escapeHtmlAdmin(b.author)}</td>
        <td>${escapeHtmlAdmin(b.date)}</td>
        <td><button class="btn-danger" data-id="${escapeHtmlAdmin(b.id)}">삭제</button></td>
      </tr>`
        )
        .join("") || `<tr><td colspan="5" class="admin-empty">등록된 게시글이 없습니다.</td></tr>`;
    tbody.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => deleteItem("/api/admin/board", btn.dataset.id, loadAll));
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-empty">불러오기 실패</td></tr>`;
  }
}

/* ============================================================
   미니게임 관리 - 추가 / 수정 / 삭제
   (다른 섹션과 달리 "수정"이 있어서 폼을 add/edit 겸용으로 사용합니다)
   ============================================================ */
const MINIGAME_DIFFICULTY_LABEL = { easy: "쉬움", normal: "보통", hard: "어려움" };
let minigameCache = [];

async function loadMinigame() {
  const tbody = document.getElementById("table-minigame");
  if (!tbody) return;
  try {
    const list = await API.get("/api/minigame");
    minigameCache = list;
    tbody.innerHTML =
      list
        .map(
          (g) => `
      <tr>
        <td style="font-size:20px;">${escapeHtmlAdmin(g.icon || "🎮")}</td>
        <td>${escapeHtmlAdmin(g.title)}</td>
        <td>${escapeHtmlAdmin(MINIGAME_DIFFICULTY_LABEL[g.category] || g.category)}</td>
        <td>${escapeHtmlAdmin(g.highlight || "")}</td>
        <td>
          <button class="btn-outline" data-edit-id="${escapeHtmlAdmin(g.id)}">수정</button>
          <button class="btn-danger" data-id="${escapeHtmlAdmin(g.id)}">삭제</button>
        </td>
      </tr>`
        )
        .join("") || `<tr><td colspan="5" class="admin-empty">등록된 미니게임이 없습니다.</td></tr>`;
    tbody.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => deleteItem("/api/admin/minigame", btn.dataset.id, loadAll));
    });
    tbody.querySelectorAll("button[data-edit-id]").forEach((btn) => {
      btn.addEventListener("click", () => startEditMinigame(btn.dataset.editId));
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="admin-empty">불러오기 실패</td></tr>`;
  }
}

function startEditMinigame(id) {
  const item = minigameCache.find((g) => g.id === id);
  if (!item) return;
  const form = document.getElementById("form-minigame");
  if (!form) return;
  form.elements.editId.value = item.id;
  form.elements.title.value = item.title || "";
  form.elements.category.value = item.category || "easy";
  form.elements.icon.value = item.icon || "";
  form.elements.highlight.value = item.highlight || "";
  form.elements.colorFrom.value = item.colorFrom || "#5c2d91";
  form.elements.colorTo.value = item.colorTo || "#2f1750";
  form.elements.description.value = item.description || "";

  document.getElementById("minigameSubmitBtn").textContent = "수정 완료";
  document.getElementById("minigameCancelBtn").style.display = "";
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetMinigameForm() {
  const form = document.getElementById("form-minigame");
  if (!form) return;
  form.reset();
  form.elements.editId.value = "";
  document.getElementById("minigameSubmitBtn").textContent = "추가";
  document.getElementById("minigameCancelBtn").style.display = "none";
}

function bindMinigameForm() {
  const form = document.getElementById("form-minigame");
  if (!form) return;

  document.getElementById("minigameCancelBtn").addEventListener("click", resetMinigameForm);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const editId = data.editId;
    delete data.editId;

    try {
      if (editId) {
        await API.put(`/api/admin/minigame/${editId}`, data);
        showToastAdmin("수정되었습니다.", false);
      } else {
        await API.post("/api/admin/minigame", data);
        showToastAdmin("추가되었습니다.", false);
      }
      resetMinigameForm();
      await loadAll();
    } catch (err) {
      showToastAdmin(err.message || "저장에 실패했습니다.", true);
    }
  });
}
