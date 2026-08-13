// ============================================================
// minigame.html 전용 스크립트
// 미니게임 카드 클릭 시 상세 모달을 열고, 관리자로 로그인되어 있으면
// 블로그 글쓰기 도구(js/rich-editor.js 공용 모듈)로 새 게임을
// 등록/수정/삭제할 수 있게 합니다.
// (이 페이지는 백엔드 서버가 켜져 있어야 정상 동작합니다)
// ============================================================

let isMinigameAdmin = false;
let minigamePostEditor = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.API) return;

  const editorRoot = document.getElementById("minigamePostEditorRoot");
  if (editorRoot && window.initRichEditor) minigamePostEditor = initRichEditor(editorRoot);

  await checkMinigameAdminStatus();
  bindMinigameModal();
  bindMinigameGridClicks();
  bindMinigameAdminForm();
});

async function checkMinigameAdminStatus() {
  try {
    const status = await API.get("/api/auth/status");
    isMinigameAdmin = !!status.loggedIn;
    const panel = document.getElementById("minigameAdminTools");
    if (panel) panel.style.display = isMinigameAdmin ? "block" : "none";
  } catch (e) {
    isMinigameAdmin = false;
  }
}

/* ---------- 카드 클릭 → 상세 모달 (단, "게임 시작" 버튼 클릭은 그대로 둡니다) ---------- */
function bindMinigameGridClicks() {
  const grid = document.getElementById("gameGrid");
  if (!grid) return;
  grid.addEventListener("click", (e) => {
    if (e.target.closest(".play-game-btn")) return;
    const card = e.target.closest(".minigame-card[data-id]");
    if (!card) return;
    openMinigamePost(card.dataset.id);
  });
}

const MINIGAME_DIFFICULTY_LABEL = { easy: "쉬움", normal: "보통", hard: "어려움" };

async function openMinigamePost(id) {
  try {
    const item = await API.get(`/api/minigame/${encodeURIComponent(id)}`);
    document.getElementById("minigameModalTitle").textContent = `${item.icon || "🎮"} ${item.title}`;
    document.getElementById("minigameModalAuthor").textContent = item.author || "운영팀";
    document.getElementById("minigameModalDate").textContent = item.updatedAt
      ? `${item.date} (수정됨 ${item.updatedAt})`
      : item.date;
    document.getElementById("minigameModalViews").textContent = `조회 ${item.views ?? 0}`;
    const diff = MINIGAME_DIFFICULTY_LABEL[item.category] || item.category;
    const badges =
      `<p style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;">` +
      `<span class="tag" style="background:var(--purple-soft);color:var(--purple);">난이도: ${escapeHtmlMinigame(diff)}</span>` +
      (item.highlight ? `<span class="tag" style="background:var(--purple-soft);color:var(--purple);">${escapeHtmlMinigame(item.highlight)}</span>` : "") +
      `</p>`;
    document.getElementById("minigameModalContent").innerHTML =
      badges + (item.content && item.content.trim() ? item.content : "<p>내용이 없습니다.</p>");

    const deleteBtn = document.getElementById("minigameModalDeleteBtn");
    const editBtn = document.getElementById("minigameModalEditBtn");
    if (isMinigameAdmin) {
      deleteBtn.style.display = "inline-flex";
      deleteBtn.onclick = async () => {
        if (!confirm("이 게임을 삭제할까요?")) return;
        try {
          await API.del(`/api/admin/minigame/${encodeURIComponent(id)}`);
          closeMinigameModal();
          await renderMinigames();
        } catch (err) {
          alert(err.message || "삭제에 실패했습니다.");
        }
      };

      editBtn.style.display = "inline-flex";
      editBtn.onclick = () => {
        closeMinigameModal();
        startEditMinigamePost(item);
      };
    } else {
      deleteBtn.style.display = "none";
      editBtn.style.display = "none";
    }

    document.getElementById("minigamePostModal").classList.add("show");
  } catch (e) {
    alert(e.message || "게임 정보를 불러오지 못했습니다.");
  }
}

function escapeHtmlMinigame(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function closeMinigameModal() {
  document.getElementById("minigamePostModal").classList.remove("show");
}

function bindMinigameModal() {
  document.getElementById("minigameModalCloseBtn").addEventListener("click", closeMinigameModal);
  document.getElementById("minigamePostModal").addEventListener("click", (e) => {
    if (e.target.id === "minigamePostModal") closeMinigameModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMinigameModal();
  });
}

/* ---------- 관리자 글쓰기 폼 (등록 / 수정) ---------- */
function startEditMinigamePost(item) {
  const details = document.getElementById("newMinigameDetails");
  const form = document.getElementById("newMinigameForm");
  if (!details || !form) return;

  details.open = true;
  document.getElementById("editingMinigameId").value = item.id;
  document.getElementById("minigameTitleInput").value = item.title || "";
  document.getElementById("minigameCategoryInput").value = item.category || "easy";
  document.getElementById("minigameIconInput").value = item.icon || "";
  document.getElementById("minigameHighlightInput").value = item.highlight || "";
  document.getElementById("minigameAuthorInput").value = item.author || "";
  document.getElementById("minigameColorFromInput").value = item.colorFrom || "#5c2d91";
  document.getElementById("minigameColorToInput").value = item.colorTo || "#2f1750";
  if (minigamePostEditor) minigamePostEditor.setHTML(item.content || "");

  document.getElementById("minigameSubmitBtn").textContent = "수정 완료";
  document.getElementById("cancelMinigameEditBtn").style.display = "";

  details.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetMinigameForm() {
  const form = document.getElementById("newMinigameForm");
  if (!form) return;
  form.reset();
  document.getElementById("editingMinigameId").value = "";
  document.getElementById("minigameColorFromInput").value = "#5c2d91";
  document.getElementById("minigameColorToInput").value = "#2f1750";
  if (minigamePostEditor) minigamePostEditor.setHTML("");
  document.getElementById("minigameSubmitBtn").textContent = "게시하기";
  document.getElementById("cancelMinigameEditBtn").style.display = "none";
}

function bindMinigameAdminForm() {
  const form = document.getElementById("newMinigameForm");
  if (!form) return;

  const cancelBtn = document.getElementById("cancelMinigameEditBtn");
  if (cancelBtn) cancelBtn.addEventListener("click", resetMinigameForm);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const editingId = document.getElementById("editingMinigameId").value;
    const payload = {
      title: fd.get("title"),
      category: fd.get("category"),
      icon: fd.get("icon") || "",
      highlight: fd.get("highlight") || "",
      author: fd.get("author") || "운영팀",
      colorFrom: fd.get("colorFrom") || "#5c2d91",
      colorTo: fd.get("colorTo") || "#2f1750",
      content: minigamePostEditor ? minigamePostEditor.getHTML() : "",
    };

    if (!payload.title || !payload.title.trim()) {
      showMinigameToast("게임 이름을 입력해주세요.");
      return;
    }
    if (minigamePostEditor && minigamePostEditor.isEmpty()) {
      showMinigameToast("내용을 입력해주세요.");
      return;
    }

    try {
      if (editingId) {
        await API.put(`/api/admin/minigame/${encodeURIComponent(editingId)}`, payload);
        showMinigameToast("게임 정보가 수정되었습니다!");
      } else {
        await API.post("/api/admin/minigame", payload);
        showMinigameToast("새 게임이 등록되었습니다!");
      }
      resetMinigameForm();
      await renderMinigames();
    } catch (err) {
      showMinigameToast(err.message || "저장에 실패했습니다.");
    }
  });
}

function showMinigameToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showMinigameToast._t);
  showMinigameToast._t = setTimeout(() => toast.classList.remove("show"), 2400);
}
