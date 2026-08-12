// ============================================================
// 관리자 전용 블로그 글쓰기 에디터 (admin-write.html)
// - document.execCommand 기반의 가벼운 자체 리치 텍스트 에디터입니다.
// - 사진은 파일 선택 시 브라우저에서 자동으로 리사이즈한 뒤 base64로
//   본문 HTML에 직접 삽입합니다(별도 이미지 업로드 서버가 필요 없음).
// - 영상은 유튜브/비메오 링크를 붙여넣으면 자동으로 삽입(embed)됩니다.
// - 이 페이지는 서버(server.js)가 /admin-write.html 요청 자체를
//   관리자 세션이 있을 때만 허용하지만, 클라이언트에서도 한 번 더 확인합니다.
// ============================================================

let savedRange = null;

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("writeForm");
  if (!form) return;
  if (!window.API) {
    showWriteToast("서버 연결이 필요한 페이지입니다. server.js를 먼저 실행해주세요.", true);
    return;
  }

  const isAdmin = await guardAdmin();
  if (!isAdmin) return;

  bindSelectionTracking();
  bindToolbarButtons();
  bindFontFamily();
  bindFontSize();
  bindTextColor();
  bindImageInsert();
  bindLinkInsert();
  bindVideoInsert();
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

function getEditor() {
  return document.getElementById("editorBody");
}

function showWriteToast(message, isError) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showWriteToast._t);
  showWriteToast._t = setTimeout(() => toast.classList.remove("show"), 2600);
}

function escapeHtmlWrite(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

/* ---------- 선택 영역(커서 위치) 유지하기 ----------
   툴바의 select/color input을 조작하면 contenteditable의 선택 영역이
   풀려버릴 수 있어서, 에디터 안에서 마우스를 떼거나 키를 뗄 때마다
   현재 선택 범위를 저장해두고 필요할 때 복원합니다. */
function bindSelectionTracking() {
  const editor = getEditor();
  const save = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  };
  editor.addEventListener("mouseup", save);
  editor.addEventListener("keyup", save);
  editor.addEventListener("input", save);
}

function restoreSelection() {
  const editor = getEditor();
  editor.focus();
  if (savedRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }
}

/* ---------- 서식 버튼 (굵게/기울임/목록/정렬 등) ---------- */
function bindToolbarButtons() {
  document.querySelectorAll("#editorToolbar button[data-cmd]").forEach((btn) => {
    // mousedown에서 기본 동작을 막아야 버튼 클릭 시 에디터의 선택 영역이 풀리지 않습니다.
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => {
      getEditor().focus();
      const cmd = btn.dataset.cmd;
      if (cmd === "formatBlockQuote") {
        document.execCommand("formatBlock", false, "blockquote");
      } else {
        document.execCommand(cmd, false, null);
      }
    });
  });
}

/* ---------- 글꼴 ---------- */
function bindFontFamily() {
  const select = document.getElementById("fontFamilySelect");
  select.addEventListener("mousedown", () => restoreSelection());
  select.addEventListener("change", () => {
    if (!select.value) return;
    restoreSelection();
    document.execCommand("fontName", false, select.value);
    select.value = "";
  });
}

/* ---------- 글자 크기 (execCommand fontSize의 7단계 <font size> 결과를
   실제 px 단위 span으로 바꿔치기하는 방식 - 더 정밀한 크기 조절이 가능합니다) ---------- */
function bindFontSize() {
  const select = document.getElementById("fontSizeSelect");
  select.addEventListener("mousedown", () => restoreSelection());
  select.addEventListener("change", () => {
    if (!select.value) return;
    restoreSelection();
    document.execCommand("fontSize", false, "7");
    getEditor().querySelectorAll('font[size="7"]').forEach((el) => {
      el.removeAttribute("size");
      el.style.fontSize = select.value;
    });
    select.value = "";
  });
}

/* ---------- 글자 색 ---------- */
function bindTextColor() {
  const input = document.getElementById("textColorInput");
  input.addEventListener("mousedown", () => restoreSelection());
  input.addEventListener("input", () => {
    restoreSelection();
    document.execCommand("foreColor", false, input.value);
  });
}

/* ---------- 사진 삽입 (자동 리사이즈 후 base64로 본문에 삽입) ---------- */
function bindImageInsert() {
  const btn = document.getElementById("insertImageBtn");
  const fileInput = document.getElementById("imageFileInput");

  btn.addEventListener("mousedown", (e) => e.preventDefault());
  btn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showWriteToast("이미지 파일만 올릴 수 있어요.", true);
      return;
    }
    try {
      const dataUrl = await resizeImageFile(file, 1100, 0.82);
      restoreSelection();
      getEditor().focus();
      document.execCommand("insertImage", false, dataUrl);
      showWriteToast("사진이 삽입되었습니다.", false);
    } catch (err) {
      showWriteToast("이미지를 처리하는 중 문제가 생겼어요.", true);
    }
  });
}

function resizeImageFile(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

/* ---------- 링크 삽입 ---------- */
function bindLinkInsert() {
  const btn = document.getElementById("insertLinkBtn");
  btn.addEventListener("mousedown", (e) => e.preventDefault());
  btn.addEventListener("click", () => {
    const url = prompt("연결할 링크 주소를 입력하세요 (https://...)");
    if (!url || !url.trim()) return;
    restoreSelection();
    getEditor().focus();

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      const text = prompt("링크에 표시할 글자를 입력하세요", url) || url;
      document.execCommand(
        "insertHTML",
        false,
        `<a href="${escapeHtmlWrite(url.trim())}" target="_blank" rel="noopener">${escapeHtmlWrite(text)}</a>&nbsp;`
      );
    } else {
      document.execCommand("createLink", false, url.trim());
      getEditor().querySelectorAll("a:not([target])").forEach((a) => {
        a.target = "_blank";
        a.rel = "noopener";
      });
    }
    showWriteToast("링크가 삽입되었습니다.", false);
  });
}

/* ---------- 영상 삽입 (유튜브 / 비메오) ---------- */
function bindVideoInsert() {
  const btn = document.getElementById("insertVideoBtn");
  btn.addEventListener("mousedown", (e) => e.preventDefault());
  btn.addEventListener("click", () => {
    const url = prompt("유튜브 또는 비메오 영상 주소를 붙여넣어 주세요");
    if (!url || !url.trim()) return;
    const embedHtml = buildVideoEmbed(url.trim());
    if (!embedHtml) {
      showWriteToast("유튜브 또는 비메오 링크만 넣을 수 있어요.", true);
      return;
    }
    restoreSelection();
    getEditor().focus();
    document.execCommand("insertHTML", false, embedHtml);
    showWriteToast("영상이 삽입되었습니다.", false);
  });
}

function buildVideoEmbed(url) {
  let u;
  try {
    u = new URL(url);
  } catch (e) {
    return null;
  }

  let videoId = "";
  if (u.hostname.includes("youtu.be")) {
    videoId = u.pathname.slice(1);
  } else if (u.hostname.includes("youtube.com")) {
    if (u.pathname.startsWith("/embed/")) {
      videoId = u.pathname.split("/embed/")[1];
    } else {
      videoId = u.searchParams.get("v") || "";
    }
  }
  if (videoId) {
    videoId = videoId.split("&")[0].split("?")[0];
    return `<div class="video-embed-wrap" contenteditable="false"><iframe src="https://www.youtube.com/embed/${videoId}" title="video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><p><br></p>`;
  }

  if (u.hostname.includes("vimeo.com")) {
    const vid = u.pathname.split("/").filter(Boolean)[0];
    if (vid) {
      return `<div class="video-embed-wrap" contenteditable="false"><iframe src="https://player.vimeo.com/video/${vid}" title="video" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div><p><br></p>`;
    }
  }
  return null;
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
    getEditor().innerHTML = post.content || "";
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
    const editor = getEditor();
    const content = editor.innerHTML;
    const hasMedia = !!editor.querySelector("img, iframe");

    if (!title) {
      showWriteToast("제목을 입력해주세요.", true);
      return;
    }
    if (!editor.textContent.trim() && !hasMedia) {
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
