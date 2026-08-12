// ============================================================
// 관리자 전용 블로그 글쓰기 화면 (admin-write.html)
// 실제 서식/사진/링크/영상 삽입 로직은 js/rich-editor.js의
// initRichEditor()가 공통으로 처리합니다. (character.html의
// "새 글 작성"도 동일한 모듈을 사용합니다)
// - 이 페이지는 서버(server.js)가 /admin-write.html 요청 자체를
//   관리자 세션이 있을 때만 허용하지만, 클라이언트에서도 한 번 더 확인합니다.
// ============================================================

let postEditor = null;

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("writeForm");
  if (!form) return;
  if (!window.API) {
    showWriteToast("서버 연결이 필요한 페이지입니다. server.js를 먼저 실행해주세요.", true);
    return;
  }

  const isAdmin = await guardAdmin();
  if (!isAdmin) return;

  postEditor = initRichEditor(document.getElementById("postEditorRoot"));
  await loadIfEditing();
  bindSubmit();
});

async function guardAdmin() {
  try {
    const status = await API.get("/api/auth/status");
    if (!status.loggedIn) {
      window.location.href = "admin-login.html";
      return false;
    }
    return true;
  } catch (e) {
    window.location.href = "admin-login.html";
    return false;
  }
}

function showWriteToast(message, isError) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showWriteToast._t);
  showWriteToast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}

/* ---------- 수정 모드: URL에 ?id=가 있으면 기존 글을 불러와 채웁니다 ---------- */
async function loadIfEditing() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) return;

  document.getElementById("postId").value = id;
  document.getElementById("writeSubmitBtn").textContent = "수정 완료";
  document.getElementById("writeHint").textContent = "게시글을 불러오는 중...";

  try {
    const post = await API.get(`/api/admin/board/${id}`);
    document.getElementById("writeTitle").value = post.title || "";
    document.getElementById("writeCategory").value = post.category || "notice";
    document.getElementById("writeAuthor").value = post.author || "";
    postEditor.setHTML(post.content || "");
    document.getElementById("writeHint").textContent = "";
  } catch (err) {
    document.getElementById("writeHint").textContent = "";
    showWriteToast("게시글을 불러오지 못했습니다.", true);
  }
}

/* ---------- 저장 (신규 작성 / 수정) ---------- */
function bindSubmit() {
  const form = document.getElementById("writeForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("postId").value;
    const title = document.getElementById("writeTitle").value.trim();
    const category = document.getElementById("writeCategory").value;
    const author = document.getElementById("writeAuthor").value.trim();
    const content = postEditor.getHTML();

    if (!title) {
      showWriteToast("제목을 입력해주세요.", true);
      return;
    }
    if (postEditor.isEmpty()) {
      showWriteToast("내용을 입력해주세요.", true);
      return;
    }

    const payload = { title, category, author, content };
    const submitBtn = document.getElementById("writeSubmitBtn");
    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = "저장 중...";

    try {
      let saved;
      if (id) {
        saved = await API.put(`/api/admin/board/${id}`, payload);
        showWriteToast("수정되었습니다. 이동합니다...", false);
      } else {
        saved = await API.post("/api/admin/board", payload);
        showWriteToast("발행되었습니다! 이동합니다...", false);
      }
      setTimeout(() => {
        window.location.href = `post.html?id=${saved.id}`;
      }, 500);
    } catch (err) {
      showWriteToast(err.message || "저장에 실패했습니다.", true);
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}
