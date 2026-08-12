// ============================================================
// 관리자 전용 API - requireAdmin 미들웨어로 보호됩니다.
// 이 라우터의 모든 엔드포인트는 로그인(세션 isAdmin=true) 상태에서만 호출 가능합니다.
// ============================================================

const express = require("express");
const store = require("../lib/jsonStore");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();
router.use(requireAdmin);

function today() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// ============================================================
// 블로그 글쓰기 에디터에서 저장되는 HTML을 가볍게 청소합니다.
// (관리자 1인만 글을 쓸 수 있는 구조라 완벽한 보안 파서까지는 아니지만,
//  스크립트 실행/이벤트 핸들러 삽입 같은 위험 요소는 걸러냅니다.
//  <iframe>은 우리 에디터가 만드는 유튜브/비메오 임베드만 허용합니다.)
// ============================================================
function sanitizeContent(html) {
  if (typeof html !== "string") return "";
  let out = html;
  out = out.replace(/<script[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/<(object|embed|link|meta|base|form)\b[^>]*>/gi, "");
  out = out.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, (tag) => {
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    const src = srcMatch ? srcMatch[1] : "";
    const allowed = /^https:\/\/(www\.youtube\.com\/embed\/|player\.vimeo\.com\/video\/)/i;
    return allowed.test(src) ? tag : "";
  });
  out = out.replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "$1=$2#$2");
  return out;
}

function makeExcerpt(html) {
  const text = String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 140);
}

// 대시보드 요약 통계
router.get("/stats", async (req, res) => {
  try {
    const [notices, archive, goods, guestbook, board, characters, characterPosts, minigame] = await Promise.all([
      store.read("notices"),
      store.read("archive"),
      store.read("goods"),
      store.read("guestbook"),
      store.read("board"),
      store.read("characters"),
      store.read("characterPosts"),
      store.read("minigame"),
    ]);
    res.json({
      notices: notices.length,
      archive: archive.length,
      goods: goods.length,
      guestbook: guestbook.length,
      board: board.length,
      characters: characters.length,
      characterPosts: characterPosts.length,
      minigame: minigame.length,
    });
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// ---- 공지사항 ----
router.post("/notices", async (req, res) => {
  try {
    const { title } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: "제목을 입력해주세요." });
    const list = await store.read("notices");
    const entry = { id: store.makeId(), title: title.trim().slice(0, 100), date: today() };
    list.unshift(entry);
    await store.write("notices", list);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.delete("/notices/:id", async (req, res) => {
  try {
    const list = (await store.read("notices")).filter((n) => n.id !== req.params.id);
    await store.write("notices", list);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// ---- 아카이브 ----
router.post("/archive", async (req, res) => {
  try {
    const { title, category, image } = req.body || {};
    const allowed = ["photo", "video", "illustration", "review"];
    if (!title || !title.trim()) return res.status(400).json({ error: "제목을 입력해주세요." });
    if (!allowed.includes(category)) return res.status(400).json({ error: "카테고리가 올바르지 않습니다." });

    const list = await store.read("archive");
    const entry = {
      id: store.makeId(),
      title: title.trim().slice(0, 120),
      category,
      image: (image || "").trim() || "assets/archive-1.png",
      date: today(),
    };
    list.unshift(entry);
    await store.write("archive", list);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.delete("/archive/:id", async (req, res) => {
  try {
    const list = (await store.read("archive")).filter((a) => a.id !== req.params.id);
    await store.write("archive", list);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// ---- 굿즈샵 ----
router.post("/goods", async (req, res) => {
  try {
    const { name, price, category, image } = req.body || {};
    const allowed = ["badge", "figure", "stationery", "living"];
    if (!name || !name.trim()) return res.status(400).json({ error: "상품명을 입력해주세요." });
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      return res.status(400).json({ error: "올바른 가격을 입력해주세요." });
    }
    if (!allowed.includes(category)) return res.status(400).json({ error: "카테고리가 올바르지 않습니다." });

    const list = await store.read("goods");
    const entry = {
      id: store.makeId(),
      name: name.trim().slice(0, 80),
      price: Number(price),
      category,
      image: (image || "").trim() || "assets/goods-pin.png",
    };
    list.unshift(entry);
    await store.write("goods", list);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.delete("/goods/:id", async (req, res) => {
  try {
    const list = (await store.read("goods")).filter((g) => g.id !== req.params.id);
    await store.write("goods", list);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// ---- 미니게임 ----
router.post("/minigame", async (req, res) => {
  try {
    const { title, description, category, highlight, icon, colorFrom, colorTo } = req.body || {};
    const allowed = ["easy", "normal", "hard"];
    if (!title || !title.trim()) return res.status(400).json({ error: "게임 이름을 입력해주세요." });
    if (!allowed.includes(category)) return res.status(400).json({ error: "난이도를 선택해주세요." });

    const list = await store.read("minigame");
    const entry = {
      id: store.makeId(),
      title: title.trim().slice(0, 60),
      description: (description || "").trim().slice(0, 300),
      category,
      highlight: (highlight || "").trim().slice(0, 40),
      icon: (icon || "🎮").trim().slice(0, 4) || "🎮",
      colorFrom: (colorFrom || "#5c2d91").trim(),
      colorTo: (colorTo || "#2f1750").trim(),
    };
    list.unshift(entry);
    await store.write("minigame", list);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.put("/minigame/:id", async (req, res) => {
  try {
    const list = await store.read("minigame");
    const idx = list.findIndex((g) => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "게임을 찾을 수 없습니다." });

    const { title, description, category, highlight, icon, colorFrom, colorTo } = req.body || {};
    const allowed = ["easy", "normal", "hard"];
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ error: "게임 이름을 입력해주세요." });
      list[idx].title = title.trim().slice(0, 60);
    }
    if (description !== undefined) list[idx].description = description.trim().slice(0, 300);
    if (category !== undefined) {
      if (!allowed.includes(category)) return res.status(400).json({ error: "난이도가 올바르지 않습니다." });
      list[idx].category = category;
    }
    if (highlight !== undefined) list[idx].highlight = highlight.trim().slice(0, 40);
    if (icon !== undefined && icon.trim()) list[idx].icon = icon.trim().slice(0, 4);
    if (colorFrom !== undefined && colorFrom.trim()) list[idx].colorFrom = colorFrom.trim();
    if (colorTo !== undefined && colorTo.trim()) list[idx].colorTo = colorTo.trim();

    await store.write("minigame", list);
    res.json(list[idx]);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.delete("/minigame/:id", async (req, res) => {
  try {
    const list = (await store.read("minigame")).filter((g) => g.id !== req.params.id);
    await store.write("minigame", list);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// ---- 방명록 모더레이션 (삭제만) ----
router.delete("/guestbook/:id", async (req, res) => {
  try {
    const list = (await store.read("guestbook")).filter((g) => g.id !== req.params.id);
    await store.write("guestbook", list);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// ---- 게시판 (블로그형 글쓰기) ----
const BOARD_CATEGORIES = ["notice", "free", "qna", "cert"];
const MAX_CONTENT_LENGTH = 3000000; // 약 3MB. 이미지를 base64로 본문에 직접 넣기 때문에 넉넉하게 잡았습니다.

// 수정 화면에서 불러올 때 쓰는 상세 조회 (공개 GET /api/board/:id와 달리 조회수를 올리지 않습니다)
router.get("/board/:id", async (req, res) => {
  try {
    const post = (await store.read("board")).find((p) => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.post("/board", async (req, res) => {
  try {
    const { title, category, author, content } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: "제목을 입력해주세요." });
    if (!BOARD_CATEGORIES.includes(category)) return res.status(400).json({ error: "게시판을 선택해주세요." });
    if (content && String(content).length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({ error: "내용이 너무 깁니다. 이미지 용량을 줄이거나 나눠서 작성해주세요." });
    }

    const cleanContent = sanitizeContent(content || "");
    const list = await store.read("board");
    const entry = {
      id: store.makeId(),
      title: title.trim().slice(0, 120),
      category,
      author: (author || "운영팀").trim().slice(0, 30) || "운영팀",
      content: cleanContent,
      excerpt: makeExcerpt(cleanContent),
      date: today(),
      updatedAt: null,
      views: 0,
    };
    list.unshift(entry);
    await store.write("board", list);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.put("/board/:id", async (req, res) => {
  try {
    const list = await store.read("board");
    const idx = list.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });

    const { title, category, author, content } = req.body || {};
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ error: "제목을 입력해주세요." });
      list[idx].title = title.trim().slice(0, 120);
    }
    if (category !== undefined) {
      if (!BOARD_CATEGORIES.includes(category)) return res.status(400).json({ error: "게시판이 올바르지 않습니다." });
      list[idx].category = category;
    }
    if (author !== undefined) list[idx].author = (author || "운영팀").trim().slice(0, 30) || "운영팀";
    if (content !== undefined) {
      if (String(content).length > MAX_CONTENT_LENGTH) {
        return res.status(400).json({ error: "내용이 너무 깁니다. 이미지 용량을 줄이거나 나눠서 작성해주세요." });
      }
      const cleanContent = sanitizeContent(content);
      list[idx].content = cleanContent;
      list[idx].excerpt = makeExcerpt(cleanContent);
    }
    list[idx].updatedAt = today();

    await store.write("board", list);
    res.json(list[idx]);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.delete("/board/:id", async (req, res) => {
  try {
    const list = (await store.read("board")).filter((p) => p.id !== req.params.id);
    await store.write("board", list);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

module.exports = router;
