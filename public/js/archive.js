// ============================================================
// archive.html 전용 스크립트
// 아카이브 카드 클릭 시 상세 모달을 열고, 관리자로 로그인되어 있으면
// 블로그 글쓰기 도구(js/rich-editor.js 공용 모듈)로 새 기록을
// 작성/수정/삭제할 수 있게 합니다.
// (이 페이지는 백엔드 서버가 켜져 있어야 정상 동작합니다)
// ============================================================

let isArchiveAdmin = false;
let archivePostEditor = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.API) return;

  const editorRoot = document.getElementById("archivePostEditorRoot");
  if (editorRoot && window.initRichEditor) archivePostEditor = initRichEditor(editorRoot);

  await checkArchiveAdminStatus();
  bindArchiveModal();
  bindArchiveGridClicks();
  bindArchiveAdminForm();
});

async function checkArchiveAdminStatus() {
  try {
    const status = await API.get("/api/auth/status");
    isArchiveAdmin = !!status.loggedIn;
    const panel = document.getElementById("archiveAdminTools");
    if (panel) panel.style.display = isArchiveAdmin ? "block" : "none";
  } catch (e) {
    isArchiveAdmin = false;
  }
}

/* ---------- 카드 클릭 → 상세 모달 ---------- */
function bindArchiveGridClicks() {
  const grid = document.getElementById("archiveGrid");
  if (!grid) return;
  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".archive-card[data-id]");
    if (!card) return;
    openArchivePost(card.dataset.id);
  });
}

const ARCHIVE_CATEGORY_LABEL = { photo: "사진", video: "영상", illustration: "일러스트", review: "리뷰" };

async function openArchivePost(id) {
  try {
    const item = await API.get(`/api/archive/${encodeURIComponent(id)}`);
    document.getElementById("archiveModalTitle").textContent = item.title;
    document.getElementById("archiveModalAuthor").textContent = item.author || "운영팀";
    document.getElementById("archiveModalDate").textContent = item.updatedAt
      ? `${item.date} (수정됨 ${item.updatedAt})`
      : item.date;
    document.getElementById("archiveModalViews").textContent = `조회 ${item.views ?? 0}`;
    const tag = ARCHIVE_CATEGORY_LABEL[item.category] || item.category;
    document.getElementById("archiveModalContent").innerHTML =
      `<p style="margin-bottom:10px;"><span class="tag" style="background:var(--purple-soft);color:var(--purple);">${escapeHtmlArchive(tag)}</span></p>` +
      (item.content && item.content.trim() ? item.content : "<p>내용이 없습니다.</p>");

    const deleteBtn = document.getElementById("archiveModalDeleteBtn");
    const editBtn = document.getElementById("archiveModalEditBtn");
    if (isArchiveAdmin) {
      deleteBtn.style.display = "inline-flex";
      deleteBtn.onclick = async () => {
        if (!confirm("이 기록을 삭제할까요?")) return;
        try {
          await API.del(`/api/admin/archive/${encodeURIComponent(id)}`);
          closeArchiveModal();
          await renderArchive();
        } catch (err) {
          alert(err.message || "삭제에 실패했습니다.");
        }
      };

      editBtn.style.display = "inline-flex";
      editBtn.onclick = () => {
        closeArchiveModal();
        startEditArchivePost(item);
      };
    } else {
      deleteBtn.style.display = "none";
      editBtn.style.display = "none";
    }

    document.getElementById("archivePostModal").classList.add("show");
  } catch (e) {
    alert(e.message || "기록을 불러오지 못했습니다.");
  }
}

function escapeHtmlArchive(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function closeArchiveModal() {
  document.getElementById("archivePostModal").classList.remove("show");
}

function bindArchiveModal() {
  document.getElementById("archiveModalCloseBtn").addEventListener("click", closeArchiveModal);
  document.getElementById("archivePostModal").addEventListener("click", (e) => {
    if (e.target.id === "archivePostModal") closeArchiveModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeArchiveModal();
  });
}

/* ---------- 관리자 글쓰기 폼 (작성 / 수정) ---------- */
function startEditArchivePost(item) {
  const details = document.getElementById("newArchiveDetails");
  const form = document.getElementById("newArchiveForm");
  if (!details || !form) return;

  details.open = true;
  document.getElementById("editingArchiveId").value = item.id;
  document.getElementById("archiveTitleInput").value = item.title || "";
  document.getElementById("archiveCategoryInput").value = item.category || "photo";
  document.getElementById("archiveAuthorInput").value = item.author || "";
  document.getElementById("archiveImageInput").value = item.image || "";
  if (archivePostEditor) archivePostEditor.setHTML(item.content || "");

  document.getElementById("archiveSubmitBtn").textContent = "수정 완료";
  document.getElementById("cancelArchiveEditBtn").style.display = "";

  details.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetArchiveForm() {
  const form = document.getElementById("newArchiveForm");
  if (!form) return;
  form.reset();
  document.getElementById("editingArchiveId").value = "";
  if (archivePostEditor) archivePostEditor.setHTML("");
  document.getElementById("archiveSubmitBtn").textContent = "게시하기";
  document.getElementById("cancelArchiveEditBtn").style.display = "none";
}

function bindArchiveAdminForm() {
  const form = document.getElementById("newArchiveForm");
  if (!form) return;

  const cancelBtn = document.getElementById("cancelArchiveEditBtn");
  if (cancelBtn) cancelBtn.addEventListener("click", resetArchiveForm);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const editingId = document.getElementById("editingArchiveId").value;
    const payload = {
      title: fd.get("title"),
      category: fd.get("category"),
      author: fd.get("author") || "운영팀",
      image: fd.get("image") || "",
      content: archivePostEditor ? archivePostEditor.getHTML() : "",
    };

    if (!payload.title || !payload.title.trim()) {
      showArchiveToast("제목을 입력해주세요.");
      return;
    }
    if (archivePostEditor && archivePostEditor.isEmpty()) {
      showArchiveToast("내용을 입력해주세요.");
      return;
    }

    try {
      if (editingId) {
        await API.put(`/api/admin/archive/${encodeURIComponent(editingId)}`, payload);
        showArchiveToast("기록이 수정되었습니다!");
      } else {
        await API.post("/api/admin/archive", payload);
        showArchiveToast("새 기록이 등록되었습니다!");
      }
      resetArchiveForm();
      await renderArchive();
    } catch (err) {
      showArchiveToast(err.message || "저장에 실패했습니다.");
    }
  });
}

function showArchiveToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showArchiveToast._t);
  showArchiveToast._t = setTimeout(() => toast.classList.remove("show"), 2400);
}
