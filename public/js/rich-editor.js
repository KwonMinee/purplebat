// ============================================================
// 재사용 가능한 리치 텍스트 에디터 (관리자 글쓰기 전용, 공용 모듈)
// - admin-write.html(게시판 글쓰기)과 character.html(캐릭터 방 새 글 작성)에서
//   똑같이 사용합니다. document.execCommand 기반의 가벼운 자체 에디터입니다.
// - 사진은 파일 선택 시 브라우저에서 자동으로 리사이즈한 뒤 base64로
//   본문 HTML에 직접 삽입합니다(별도 이미지 업로드 서버가 필요 없음).
// - 영상은 유튜브/비메오 링크를 붙여넣으면 자동으로 삽입(embed)됩니다.
//
// 사용법: 아래 구조를 가진 컨테이너를 initRichEditor(root)에 넘기면 됩니다.
//   <div class="rt-root">
//     <div class="rt-toolbar"> ...버튼/셀렉트... </div>
//     <input type="file" class="rt-image-input" accept="image/*" hidden />
//     <div class="rt-body" contenteditable="true"></div>
//   </div>
// 반환값: { getHTML, setHTML, isEmpty, focus }
// ============================================================

function initRichEditor(root) {
  if (!root) return null;

  const editor = root.querySelector(".rt-body");
  const fileInput = root.querySelector(".rt-image-input");
  if (!editor) return null;

  let savedRange = null;

  function notify(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(notify._t);
    notify._t = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreSelection() {
    editor.focus();
    if (savedRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
  }
  editor.addEventListener("mouseup", saveSelection);
  editor.addEventListener("keyup", saveSelection);
  editor.addEventListener("input", saveSelection);

  // ---- 서식 버튼 ----
  root.querySelectorAll(".rt-toolbar button[data-cmd]").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => {
      editor.focus();
      const cmd = btn.dataset.cmd;
      if (cmd === "formatBlockQuote") {
        document.execCommand("formatBlock", false, "blockquote");
      } else {
        document.execCommand(cmd, false, null);
      }
    });
  });

  // ---- 글꼴 ----
  const fontFamilySelect = root.querySelector(".rt-font-family");
  if (fontFamilySelect) {
    fontFamilySelect.addEventListener("mousedown", () => restoreSelection());
    fontFamilySelect.addEventListener("change", () => {
      if (!fontFamilySelect.value) return;
      restoreSelection();
      document.execCommand("fontName", false, fontFamilySelect.value);
      fontFamilySelect.value = "";
    });
  }

  // ---- 글자 크기 ----
  const fontSizeSelect = root.querySelector(".rt-font-size");
  if (fontSizeSelect) {
    fontSizeSelect.addEventListener("mousedown", () => restoreSelection());
    fontSizeSelect.addEventListener("change", () => {
      if (!fontSizeSelect.value) return;
      restoreSelection();
      document.execCommand("fontSize", false, "7");
      editor.querySelectorAll('font[size="7"]').forEach((el) => {
        el.removeAttribute("size");
        el.style.fontSize = fontSizeSelect.value;
      });
      fontSizeSelect.value = "";
    });
  }

  // ---- 글자 색 ----
  const colorInput = root.querySelector(".rt-color");
  if (colorInput) {
    colorInput.addEventListener("mousedown", () => restoreSelection());
    colorInput.addEventListener("input", () => {
      restoreSelection();
      document.execCommand("foreColor", false, colorInput.value);
    });
  }

  // ---- 사진 삽입 ----
  const imageBtn = root.querySelector(".rt-insert-image");
  if (imageBtn && fileInput) {
    imageBtn.addEventListener("mousedown", (e) => e.preventDefault());
    imageBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        notify("이미지 파일만 올릴 수 있어요.");
        return;
      }
      try {
        const dataUrl = await resizeImageFileRT(file, 1100, 0.82);
        restoreSelection();
        editor.focus();
        document.execCommand("insertImage", false, dataUrl);
        notify("사진이 삽입되었습니다.");
      } catch (err) {
        notify("이미지를 처리하는 중 문제가 생겼어요.");
      }
    });
  }

  // ---- 링크 삽입 ----
  const linkBtn = root.querySelector(".rt-insert-link");
  if (linkBtn) {
    linkBtn.addEventListener("mousedown", (e) => e.preventDefault());
    linkBtn.addEventListener("click", () => {
      const url = prompt("연결할 링크 주소를 입력하세요 (https://...)");
      if (!url || !url.trim()) return;
      restoreSelection();
      editor.focus();
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        const text = prompt("링크에 표시할 글자를 입력하세요", url) || url;
        document.execCommand(
          "insertHTML",
          false,
          `<a href="${escapeAttrRT(url.trim())}" target="_blank" rel="noopener">${escapeHtmlRT(text)}</a>&nbsp;`
        );
      } else {
        document.execCommand("createLink", false, url.trim());
        editor.querySelectorAll("a:not([target])").forEach((a) => {
          a.target = "_blank";
          a.rel = "noopener";
        });
      }
      notify("링크가 삽입되었습니다.");
    });
  }

  // ---- 영상 삽입 (유튜브 / 비메오) ----
  const videoBtn = root.querySelector(".rt-insert-video");
  if (videoBtn) {
    videoBtn.addEventListener("mousedown", (e) => e.preventDefault());
    videoBtn.addEventListener("click", () => {
      const url = prompt("유튜브 또는 비메오 영상 주소를 붙여넣어 주세요");
      if (!url || !url.trim()) return;
      const embedHtml = buildVideoEmbedRT(url.trim());
      if (!embedHtml) {
        notify("유튜브 또는 비메오 링크만 넣을 수 있어요.");
        return;
      }
      restoreSelection();
      editor.focus();
      document.execCommand("insertHTML", false, embedHtml);
      notify("영상이 삽입되었습니다.");
    });
  }

  return {
    getHTML: () => editor.innerHTML,
    setHTML: (html) => {
      editor.innerHTML = html || "";
    },
    isEmpty: () => !editor.textContent.trim() && !editor.querySelector("img, iframe"),
    focus: () => editor.focus(),
  };
}

function escapeHtmlRT(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function escapeAttrRT(str) {
  return String(str).replace(/"/g, "&quot;");
}

function resizeImageFileRT(file, maxWidth, quality) {
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

function buildVideoEmbedRT(url) {
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
