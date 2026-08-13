// ============================================================
// goods.html 전용 스크립트
// 굿즈 카드 클릭 시 상세 모달을 열고, 관리자로 로그인되어 있으면
// 블로그 글쓰기 도구(js/rich-editor.js 공용 모듈)로 새 상품을
// 등록/수정/삭제할 수 있게 합니다.
// (장바구니 담기 버튼은 그대로 js/script.js의 initCartButtons()가 처리합니다)
// (이 페이지는 백엔드 서버가 켜져 있어야 정상 동작합니다)
// ============================================================

let isGoodsAdmin = false;
let goodsPostEditor = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.API) return;

  const editorRoot = document.getElementById("goodsPostEditorRoot");
  if (editorRoot && window.initRichEditor) goodsPostEditor = initRichEditor(editorRoot);

  await checkGoodsAdminStatus();
  bindGoodsModal();
  bindGoodsGridClicks();
  bindGoodsAdminForm();
});

async function checkGoodsAdminStatus() {
  try {
    const status = await API.get("/api/auth/status");
    isGoodsAdmin = !!status.loggedIn;
    const panel = document.getElementById("goodsAdminTools");
    if (panel) panel.style.display = isGoodsAdmin ? "block" : "none";
  } catch (e) {
    isGoodsAdmin = false;
  }
}

/* ---------- 카드 클릭 → 상세 모달 (단, "장바구니 담기" 버튼 클릭은 그대로 둡니다) ---------- */
function bindGoodsGridClicks() {
  const grid = document.getElementById("goodsGrid");
  if (!grid) return;
  grid.addEventListener("click", (e) => {
    if (e.target.closest(".add-cart-btn")) return;
    const card = e.target.closest(".goods-card[data-id]");
    if (!card) return;
    openGoodsPost(card.dataset.id);
  });
}

const GOODS_CATEGORY_LABEL = { badge: "뱃지/키링", figure: "스탠드/피규어", stationery: "문구", living: "리빙" };

async function openGoodsPost(id) {
  try {
    const item = await API.get(`/api/goods/${encodeURIComponent(id)}`);
    document.getElementById("goodsModalTitle").textContent = item.name;
    document.getElementById("goodsModalAuthor").textContent = item.author || "운영팀";
    document.getElementById("goodsModalDate").textContent = item.updatedAt
      ? `${item.date || ""} (수정됨 ${item.updatedAt})`
      : item.date || "";
    document.getElementById("goodsModalViews").textContent = `조회 ${item.views ?? 0}`;
    const cat = GOODS_CATEGORY_LABEL[item.category] || item.category;
    const badges =
      `<p style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">` +
      `<span class="tag" style="background:var(--purple-soft);color:var(--purple);">${escapeHtmlGoods(cat)}</span>` +
      `<span class="goods-card-price">₩ ${Number(item.price || 0).toLocaleString("ko-KR")}</span>` +
      `</p>`;
    document.getElementById("goodsModalContent").innerHTML =
      badges + (item.content && item.content.trim() ? item.content : "<p>상품 설명이 없습니다.</p>");

    const addCartBtn = document.getElementById("goodsModalAddCartBtn");
    addCartBtn.textContent = "🛒 장바구니 담기";
    addCartBtn.dataset.name = item.name;

    const deleteBtn = document.getElementById("goodsModalDeleteBtn");
    const editBtn = document.getElementById("goodsModalEditBtn");
    if (isGoodsAdmin) {
      deleteBtn.style.display = "inline-flex";
      deleteBtn.onclick = async () => {
        if (!confirm("이 상품을 삭제할까요?")) return;
        try {
          await API.del(`/api/admin/goods/${encodeURIComponent(id)}`);
          closeGoodsModal();
          await renderGoods();
        } catch (err) {
          alert(err.message || "삭제에 실패했습니다.");
        }
      };

      editBtn.style.display = "inline-flex";
      editBtn.onclick = () => {
        closeGoodsModal();
        startEditGoodsPost(item);
      };
    } else {
      deleteBtn.style.display = "none";
      editBtn.style.display = "none";
    }

    document.getElementById("goodsPostModal").classList.add("show");
  } catch (e) {
    alert(e.message || "상품 정보를 불러오지 못했습니다.");
  }
}

function escapeHtmlGoods(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function closeGoodsModal() {
  document.getElementById("goodsPostModal").classList.remove("show");
}

function bindGoodsModal() {
  document.getElementById("goodsModalCloseBtn").addEventListener("click", closeGoodsModal);
  document.getElementById("goodsPostModal").addEventListener("click", (e) => {
    if (e.target.id === "goodsPostModal") closeGoodsModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeGoodsModal();
  });
}

/* ---------- 관리자 글쓰기 폼 (등록 / 수정) ---------- */
function startEditGoodsPost(item) {
  const details = document.getElementById("newGoodsDetails");
  const form = document.getElementById("newGoodsForm");
  if (!details || !form) return;

  details.open = true;
  document.getElementById("editingGoodsId").value = item.id;
  document.getElementById("goodsNameInput").value = item.name || "";
  document.getElementById("goodsCategoryInput").value = item.category || "badge";
  document.getElementById("goodsPriceInput").value = item.price || "";
  document.getElementById("goodsAuthorInput").value = item.author || "";
  document.getElementById("goodsImageInput").value = item.image || "";
  if (goodsPostEditor) goodsPostEditor.setHTML(item.content || "");

  document.getElementById("goodsSubmitBtn").textContent = "수정 완료";
  document.getElementById("cancelGoodsEditBtn").style.display = "";

  details.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetGoodsForm() {
  const form = document.getElementById("newGoodsForm");
  if (!form) return;
  form.reset();
  document.getElementById("editingGoodsId").value = "";
  if (goodsPostEditor) goodsPostEditor.setHTML("");
  document.getElementById("goodsSubmitBtn").textContent = "게시하기";
  document.getElementById("cancelGoodsEditBtn").style.display = "none";
}

function bindGoodsAdminForm() {
  const form = document.getElementById("newGoodsForm");
  if (!form) return;

  const cancelBtn = document.getElementById("cancelGoodsEditBtn");
  if (cancelBtn) cancelBtn.addEventListener("click", resetGoodsForm);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const editingId = document.getElementById("editingGoodsId").value;
    const payload = {
      name: fd.get("name"),
      category: fd.get("category"),
      price: fd.get("price"),
      author: fd.get("author") || "운영팀",
      image: fd.get("image") || "",
      content: goodsPostEditor ? goodsPostEditor.getHTML() : "",
    };

    if (!payload.name || !payload.name.trim()) {
      showGoodsToast("상품명을 입력해주세요.");
      return;
    }
    if (!payload.price || isNaN(Number(payload.price)) || Number(payload.price) <= 0) {
      showGoodsToast("올바른 가격을 입력해주세요.");
      return;
    }
    if (goodsPostEditor && goodsPostEditor.isEmpty()) {
      showGoodsToast("상품 설명을 입력해주세요.");
      return;
    }

    try {
      if (editingId) {
        await API.put(`/api/admin/goods/${encodeURIComponent(editingId)}`, payload);
        showGoodsToast("상품 정보가 수정되었습니다!");
      } else {
        await API.post("/api/admin/goods", payload);
        showGoodsToast("새 상품이 등록되었습니다!");
      }
      resetGoodsForm();
      await renderGoods();
    } catch (err) {
      showGoodsToast(err.message || "저장에 실패했습니다.");
    }
  });
}

function showGoodsToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showGoodsToast._t);
  showGoodsToast._t = setTimeout(() => toast.classList.remove("show"), 2400);
}
