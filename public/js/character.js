// ============================================================
// character.html 전용 스크립트
// URL: character.html?id=argon 형태로 접속합니다.
// 캐릭터 프로필 + 전용 게시판을 보여주고,
// 관리자로 로그인되어 있으면 프로필 수정 / 새 글 작성 도구를 노출합니다.
// (이 페이지는 백엔드 서버가 켜져 있어야 정상 동작합니다)
// ============================================================

function getCharacterId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function escapeHtmlChar(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

let currentCharacterId = null;
let isAdminUser = false;
let charPostEditor = null;

document.addEventListener("DOMContentLoaded", async () => {
  currentCharacterId = getCharacterId();
  const postList = document.getElementById("postList");

  if (!window.API) {
    if (postList) postList.innerHTML = `<p class="admin-empty">이 기능은 백엔드 서버가 켜져 있어야 사용할 수 있어요. start.bat / start.sh로 서버를 먼저 실행해주세요.</p>`;
    return;
  }

  if (!currentCharacterId) {
    document.getElementById("charName").textContent = "캐릭터를 찾을 수 없어요";
    document.getElementById("charDescription").textContent = "party.html에서 캐릭터의 '방 입장' 버튼을 눌러 들어와주세요.";
    if (postList) postList.innerHTML = "";
    return;
  }

  const editorRoot = document.getElementById("charPostEditorRoot");
  if (editorRoot && window.initRichEditor) charPostEditor = initRichEditor(editorRoot);

  await checkAdminStatus();
  await loadCharacter();
  await loadPosts();
  bindModal();
  bindAdminForms();
});

async function checkAdminStatus() {
  try {
    const status = await API.get("/api/auth/status");
    isAdminUser = !!status.loggedIn;
    document.getElementById("adminTools").style.display = isAdminUser ? "flex" : "none";
  } catch (e) {
    isAdminUser = false;
  }
}

async function loadCharacter() {
  try {
    const c = await API.get(`/api/characters/${encodeURIComponent(currentCharacterId)}`);
    document.title = `${c.name} | 보라박쥐단`;
    document.getElementById("crumbName").textContent = c.name;
    document.getElementById("charImage").src = c.image;
    document.getElementById("charImage").alt = c.name;
    document.getElementById("charName").textContent = `🏠 ${c.name}의 방`;
    document.getElementById("charRoleLevel").textContent = `${c.role} · Lv. ${c.level}`;
    document.getElementById("charDescription").textContent = c.description || "";
    document.getElementById("boardTitle").textContent = `🗨️ ${c.name}의 이야기`;

    const statsEl = document.getElementById("charStats");
    statsEl.innerHTML = (c.stats || [])
      .map(
        (s) => `
        <div class="stat-bar-row">
          <span class="label">${escapeHtmlChar(s.label)}</span>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${Math.max(0, Math.min(100, Number(s.value) || 0))}%;"></div></div>
        </div>`
      )
      .join("");

    if (isAdminUser) fillEditForm(c);
  } catch (e) {
    document.getElementById("charName").textContent = "캐릭터를 찾을 수 없어요";
    document.getElementById("charDescription").textContent = e.message || "서버에서 캐릭터 정보를 불러오지 못했습니다.";
  }
}

function fillEditForm(c) {
  const form = document.getElementById("editProfileForm");
  if (!form) return;
  form.name.value = c.name || "";
  form.role.value = c.role || "";
  form.level.value = c.level || "";
  form.image.value = c.image || "";
  form.description.value = c.description || "";
  const stats = c.stats || [];
  [0, 1, 2].forEach((i) => {
    form[`stat${i + 1}Label`].value = stats[i] ? stats[i].label : "";
    form[`stat${i + 1}Value`].value = stats[i] ? stats[i].value : "";
  });
}

async function loadPosts() {
  const listEl = document.getElementById("postList");
  const countEl = document.getElementById("postCount");
  try {
    const posts = await API.get(`/api/characters/${encodeURIComponent(currentCharacterId)}/posts`);
    countEl.textContent = `${posts.length}개의 글`;
    listEl.innerHTML =
      posts
        .map(
          (p) => `
        <div class="board-row clickable" data-id="${escapeHtmlChar(p.id)}">
          <span class="board-title">${escapeHtmlChar(p.title)}</span>
          <span class="board-meta"><span>${escapeHtmlChar(p.author)}</span><span>조회 ${p.views ?? 0}</span><span>${escapeHtmlChar(p.date)}</span></span>
        </div>`
        )
        .join("") || `<p class="admin-empty">아직 등록된 글이 없어요.</p>`;

    listEl.querySelectorAll(".board-row.clickable").forEach((row) => {
      row.addEventListener("click", () => openPost(row.dataset.id));
    });
  } catch (e) {
    listEl.innerHTML = `<p class="admin-empty">게시글을 불러오지 못했습니다.</p>`;
    countEl.textContent = "";
  }
}

async function openPost(postId) {
  try {
    const post = await API.get(`/api/characters/${encodeURIComponent(currentCharacterId)}/posts/${encodeURIComponent(postId)}`);
    document.getElementById("modalTitle").textContent = post.title;
    document.getElementById("modalAuthor").textContent = post.author;
    document.getElementById("modalDate").textContent = post.updatedAt ? `${post.date} (수정됨 ${post.updatedAt})` : post.date;
    document.getElementById("modalViews").textContent = `조회 ${post.views ?? 0}`;
    document.getElementById("modalContent").innerHTML = post.content && post.content.trim() ? post.content : "<p>내용이 없습니다.</p>";

    const deleteBtn = document.getElementById("modalDeleteBtn");
    const editBtn = document.getElementById("modalEditBtn");
    if (isAdminUser) {
      deleteBtn.style.display = "inline-flex";
      deleteBtn.onclick = async () => {
        if (!confirm("이 글을 삭제할까요?")) return;
        try {
          await API.del(`/api/characters/${encodeURIComponent(currentCharacterId)}/posts/${encodeURIComponent(postId)}`);
          closeModal();
          await loadPosts();
        } catch (err) {
          alert(err.message || "삭제에 실패했습니다.");
        }
      };

      editBtn.style.display = "inline-flex";
      editBtn.onclick = () => {
        closeModal();
        startEditPost(post);
      };
    } else {
      deleteBtn.style.display = "none";
      editBtn.style.display = "none";
    }

    document.getElementById("postModal").classList.add("show");
  } catch (e) {
    alert(e.message || "게시글을 불러오지 못했습니다.");
  }
}

function startEditPost(post) {
  const details = document.getElementById("newPostDetails");
  const form = document.getElementById("newPostForm");
  if (!details || !form) return;

  details.open = true;
  document.getElementById("editingPostId").value = post.id;
  document.getElementById("postTitleInput").value = post.title || "";
  document.getElementById("postAuthorInput").value = post.author || "";
  if (charPostEditor) charPostEditor.setHTML(post.content || "");

  document.getElementById("postSubmitBtn").textContent = "수정 완료";
  document.getElementById("cancelPostEditBtn").style.display = "";

  details.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetPostForm() {
  const form = document.getElementById("newPostForm");
  if (!form) return;
  form.reset();
  document.getElementById("editingPostId").value = "";
  if (charPostEditor) charPostEditor.setHTML("");
  document.getElementById("postSubmitBtn").textContent = "게시하기";
  document.getElementById("cancelPostEditBtn").style.display = "none";
}

function closeModal() {
  document.getElementById("postModal").classList.remove("show");
}

function bindModal() {
  document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
  document.getElementById("postModal").addEventListener("click", (e) => {
    if (e.target.id === "postModal") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function bindAdminForms() {
  const editForm = document.getElementById("editProfileForm");
  const postForm = document.getElementById("newPostForm");

  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(editForm);
      const payload = {
        name: fd.get("name"),
        role: fd.get("role"),
        level: fd.get("level"),
        image: fd.get("image"),
        description: fd.get("description"),
        stats: [1, 2, 3].map((i) => ({
          label: fd.get(`stat${i}Label`),
          value: fd.get(`stat${i}Value`),
        })),
      };
      try {
        const res = await fetch(`/api/characters/${encodeURIComponent(currentCharacterId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error((data && data.error) || "수정에 실패했습니다.");
        showCharToast("프로필이 수정되었습니다!");
        await loadCharacter();
      } catch (err) {
        showCharToast(err.message || "수정에 실패했습니다.");
      }
    });
  }

  if (postForm) {
    const cancelBtn = document.getElementById("cancelPostEditBtn");
    if (cancelBtn) cancelBtn.addEventListener("click", resetPostForm);

    postForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(postForm);
      const editingId = document.getElementById("editingPostId").value;
      const payload = {
        title: fd.get("title"),
        content: charPostEditor ? charPostEditor.getHTML() : "",
        author: fd.get("author") || "운영팀",
      };

      if (!payload.title || !payload.title.trim()) {
        showCharToast("제목을 입력해주세요.");
        return;
      }
      if (charPostEditor && charPostEditor.isEmpty()) {
        showCharToast("내용을 입력해주세요.");
        return;
      }

      try {
        if (editingId) {
          await API.put(`/api/characters/${encodeURIComponent(currentCharacterId)}/posts/${encodeURIComponent(editingId)}`, payload);
          showCharToast("글이 수정되었습니다!");
        } else {
          await API.post(`/api/characters/${encodeURIComponent(currentCharacterId)}/posts`, payload);
          showCharToast("새 글이 등록되었습니다!");
        }
        resetPostForm();
        await loadPosts();
      } catch (err) {
        showCharToast(err.message || "글 등록에 실패했습니다.");
      }
    });
  }
}

function showCharToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showCharToast._t);
  showCharToast._t = setTimeout(() => toast.classList.remove("show"), 2400);
}
