// ============================================================
// 게시글 상세 페이지 (post.html)
// - 로그인 없이 누구나 볼 수 있어야 링크 공유가 가능하므로,
//   공개 GET /api/board/:id 를 사용합니다.
// - 관리자로 로그인되어 있을 때만 수정/삭제 버튼이 보입니다.
// ============================================================

function getPostId() {
  return new URLSearchParams(window.location.search).get("id");
}

const BOARD_LABEL_POST = { notice: "공지", free: "자유", qna: "질문", cert: "인증" };

document.addEventListener("DOMContentLoaded", async () => {
  const id = getPostId();
  const contentEl = document.getElementById("postContent");

  if (!window.API) {
    if (contentEl) contentEl.innerHTML = "<p>이 페이지는 서버(server.js)가 실행 중이어야 볼 수 있어요.</p>";
    return;
  }
  if (!id) {
    if (contentEl) contentEl.innerHTML = "<p>게시글을 찾을 수 없어요. 주소를 다시 확인해주세요.</p>";
    return;
  }

  await checkAdminForPost(id);
  await loadPost(id);
  bindShare();
  bindDelete(id);
});

async function checkAdminForPost(id) {
  try {
    const status = await API.get("/api/auth/status");
    if (status.loggedIn) {
      const panel = document.getElementById("postAdminTools");
      if (panel) panel.style.display = "flex";
      const editBtn = document.getElementById("editPostBtn");
      if (editBtn) editBtn.href = `admin-write.html?id=${encodeURIComponent(id)}`;
    }
  } catch (e) {
    /* 비로그인 상태: 아무것도 하지 않음 */
  }
}

async function loadPost(id) {
  const contentEl = document.getElementById("postContent");
  try {
    const post = await API.get(`/api/board/${id}`);
    document.title = `${post.title} | 보라박쥐단`;

    const breadcrumbTitle = document.getElementById("breadcrumbTitle");
    if (breadcrumbTitle) breadcrumbTitle.textContent = post.title;

    document.getElementById("postTitle").textContent = post.title;
    document.getElementById("postCategoryTag").textContent = BOARD_LABEL_POST[post.category] || post.category;
    document.getElementById("postAuthor").textContent = `✍️ ${post.author}`;

    const dateText = post.updatedAt ? `${post.date} (수정됨 ${post.updatedAt})` : post.date;
    document.getElementById("postDate").textContent = dateText;
    document.getElementById("postViews").textContent = `👁️ 조회 ${post.views ?? 0}`;

    contentEl.innerHTML = post.content && post.content.trim() ? post.content : "<p>내용이 없습니다.</p>";
  } catch (err) {
    contentEl.innerHTML = `<p>게시글을 불러오지 못했습니다. (${escapeHtml((err && err.message) || "")})</p>`;
  }
}

function bindShare() {
  const btn = document.getElementById("shareBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        showToast("링크가 복사되었습니다! 📋");
        return;
      } catch (e) {
        /* 아래 fallback으로 진행 */
      }
    }
    window.prompt("아래 링크를 복사하세요", url);
  });
}

function bindDelete(id) {
  const btn = document.getElementById("deletePostBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    if (!window.confirm("정말 삭제할까요? 되돌릴 수 없습니다.")) return;
    try {
      await API.del(`/api/admin/board/${id}`);
      showToast("삭제되었습니다.");
      setTimeout(() => {
        window.location.href = "community.html";
      }, 400);
    } catch (err) {
      showToast(err.message || "삭제에 실패했습니다.");
    }
  });
}
