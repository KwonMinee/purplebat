// ============================================================
// 관리자 전용 API - requireAdmin 미들웨어로 보호됩니다.
// 이 라우터의 모든 엔드포인트는 로그인(세션 isAdmin=true) 상태에서만 호출 가능합니다.
// ============================================================

const express = require("express");
const store = require("../lib/jsonStore");
const requireAdmin = require("../middleware/requireAdmin");
const { sanitizeContent, makeExcerpt, isContentEmpty, MAX_CONTENT_LENGTH } = require("../lib/contentSanitizer");

const router = express.Router();
router.use(requireAdmin);

function today() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
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

// ---- 아카이브 (블로그형 글쓰기) ----
const ARCHIVE_CATEGORIES = ["photo", "video", "illustration", "review"];
const ARCHIVE_DEFAULT_IMAGE = {
  photo: "assets/archive-1.png",
  video: "assets/archive-2.png",
  illustration: "assets/archive-3.png",
  review: "assets/archive-4.png",
};

// 본문 HTML 안에 삽입된 첫 번째 사진을 대표 이미지로 자동 사용합니다.
function extractFirstImage(html) {
  const match = /<img[^>]+src=["']([^"']+)["']/i.exec(html || "");
  return match ? match[1] : "";
}

// 수정 화면에서 불러올 때 쓰는 상세 조회 (공개 GET /api/archive/:id와 달리 조회수를 올리지 않습니다)
router.get("/archive/:id", async (req, res) => {
  try {
    const item = (await store.read("archive")).find((a) => a.id === req.params.id);
    if (!item) return res.status(404).json({ error: "기록을 찾을 수 없습니다." });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.post("/archive", async (req, res) => {
  try {
    const { title, category, image, author, content } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: "제목을 입력해주세요." });
    if (!ARCHIVE_CATEGORIES.includes(category)) return res.status(400).json({ error: "카테고리가 올바르지 않습니다." });
    if (content && String(content).length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({ error: "내용이 너무 깁니다. 이미지 용량을 줄이거나 나눠서 작성해주세요." });
    }
    if (isContentEmpty(content || "")) return res.status(400).json({ error: "내용을 입력해주세요." });

    const cleanContent = sanitizeContent(content || "");
    const thumbnail = (image || "").trim() || extractFirstImage(cleanContent) || ARCHIVE_DEFAULT_IMAGE[category];

    const list = await store.read("archive");
    const entry = {
      id: store.makeId(),
      title: title.trim().slice(0, 120),
      category,
      author: (author || "운영팀").trim().slice(0, 30) || "운영팀",
      image: thumbnail,
      content: cleanContent,
      excerpt: makeExcerpt(cleanContent),
      date: today(),
      updatedAt: null,
      views: 0,
    };
    list.unshift(entry);
    await store.write("archive", list);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.put("/archive/:id", async (req, res) => {
  try {
    const list = await store.read("archive");
    const idx = list.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "기록을 찾을 수 없습니다." });

    const { title, category, image, author, content } = req.body || {};
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ error: "제목을 입력해주세요." });
      list[idx].title = title.trim().slice(0, 120);
    }
    if (category !== undefined) {
      if (!ARCHIVE_CATEGORIES.includes(category)) return res.status(400).json({ error: "카테고리가 올바르지 않습니다." });
      list[idx].category = category;
    }
    if (author !== undefined) list[idx].author = (author || "운영팀").trim().slice(0, 30) || "운영팀";
    if (content !== undefined) {
      if (String(content).length > MAX_CONTENT_LENGTH) {
        return res.status(400).json({ error: "내용이 너무 깁니다. 이미지 용량을 줄이거나 나눠서 작성해주세요." });
      }
      if (isContentEmpty(content)) return res.status(400).json({ error: "내용을 입력해주세요." });
      const cleanContent = sanitizeContent(content);
      list[idx].content = cleanContent;
      list[idx].excerpt = makeExcerpt(cleanContent);
      const explicitImage = (image || "").trim();
      list[idx].image = explicitImage || extractFirstImage(cleanContent) || ARCHIVE_DEFAULT_IMAGE[list[idx].category];
    } else if (image !== undefined && image.trim()) {
      list[idx].image = image.trim();
    }
    list[idx].updatedAt = today();

    await store.write("archive", list);
    res.json(list[idx]);
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

// ---- 굿즈샵 (블로그형 글쓰기) ----
const GOODS_CATEGORIES = ["badge", "figure", "stationery", "living"];
const GOODS_DEFAULT_IMAGE = {
  badge: "assets/goods-pin.png",
  figure: "assets/goods-stand.png",
  stationery: "assets/goods-notebook.png",
  living: "assets/goods-mug.png",
};

// 수정 화면에서 불러올 때 쓰는 상세 조회 (공개 GET /api/goods/:id와 달리 조회수를 올리지 않습니다)
router.get("/goods/:id", async (req, res) => {
  try {
    const item = (await store.read("goods")).find((g) => g.id === req.params.id);
    if (!item) return res.status(404).json({ error: "상품을 찾을 수 없습니다." });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.post("/goods", async (req, res) => {
  try {
    const { name, price, category, image, author, content } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "상품명을 입력해주세요." });
    if (!price || isNaN(Number(price)) || Number(price) <= 0) {
      return res.status(400).json({ error: "올바른 가격을 입력해주세요." });
    }
    if (!GOODS_CATEGORIES.includes(category)) return res.status(400).json({ error: "카테고리가 올바르지 않습니다." });
    if (content && String(content).length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({ error: "내용이 너무 깁니다. 이미지 용량을 줄이거나 나눠서 작성해주세요." });
    }
    if (isContentEmpty(content || "")) return res.status(400).json({ error: "상품 설명을 입력해주세요." });

    const cleanContent = sanitizeContent(content || "");
    const thumbnail = (image || "").trim() || extractFirstImage(cleanContent) || GOODS_DEFAULT_IMAGE[category];

    const list = await store.read("goods");
    const entry = {
      id: store.makeId(),
      name: name.trim().slice(0, 80),
      price: Number(price),
      category,
      author: (author || "운영팀").trim().slice(0, 30) || "운영팀",
      image: thumbnail,
      content: cleanContent,
      excerpt: makeExcerpt(cleanContent),
      date: today(),
      updatedAt: null,
      views: 0,
    };
    list.unshift(entry);
    await store.write("goods", list);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.put("/goods/:id", async (req, res) => {
  try {
    const list = await store.read("goods");
    const idx = list.findIndex((g) => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "상품을 찾을 수 없습니다." });

    const { name, price, category, image, author, content } = req.body || {};
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: "상품명을 입력해주세요." });
      list[idx].name = name.trim().slice(0, 80);
    }
    if (price !== undefined) {
      if (!price || isNaN(Number(price)) || Number(price) <= 0) {
        return res.status(400).json({ error: "올바른 가격을 입력해주세요." });
      }
      list[idx].price = Number(price);
    }
    if (category !== undefined) {
      if (!GOODS_CATEGORIES.includes(category)) return res.status(400).json({ error: "카테고리가 올바르지 않습니다." });
      list[idx].category = category;
    }
    if (author !== undefined) list[idx].author = (author || "운영팀").trim().slice(0, 30) || "운영팀";
    if (content !== undefined) {
      if (String(content).length > MAX_CONTENT_LENGTH) {
        return res.status(400).json({ error: "내용이 너무 깁니다. 이미지 용량을 줄이거나 나눠서 작성해주세요." });
      }
      if (isContentEmpty(content)) return res.status(400).json({ error: "상품 설명을 입력해주세요." });
      const cleanContent = sanitizeContent(content);
      list[idx].content = cleanContent;
      list[idx].excerpt = makeExcerpt(cleanContent);
      const explicitImage = (image || "").trim();
      list[idx].image = explicitImage || extractFirstImage(cleanContent) || GOODS_DEFAULT_IMAGE[list[idx].category];
    } else if (image !== undefined && image.trim()) {
      list[idx].image = image.trim();
    }
    list[idx].updatedAt = today();

    await store.write("goods", list);
    res.json(list[idx]);
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

// ---- 미니게임 (블로그형 글쓰기) ----
const MINIGAME_CATEGORIES = ["easy", "normal", "hard"];

// 수정 화면에서 불러올 때 쓰는 상세 조회 (공개 GET /api/minigame/:id와 달리 조회수를 올리지 않습니다)
router.get("/minigame/:id", async (req, res) => {
  try {
    const item = (await store.read("minigame")).find((g) => g.id === req.params.id);
    if (!item) return res.status(404).json({ error: "게임을 찾을 수 없습니다." });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.post("/minigame", async (req, res) => {
  try {
    const { title, category, author, highlight, icon, colorFrom, colorTo, content } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: "게임 이름을 입력해주세요." });
    if (!MINIGAME_CATEGORIES.includes(category)) return res.status(400).json({ error: "난이도를 선택해주세요." });
    if (content && String(content).length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({ error: "내용이 너무 깁니다. 이미지 용량을 줄이거나 나눠서 작성해주세요." });
    }
    if (isContentEmpty(content || "")) return res.status(400).json({ error: "내용을 입력해주세요." });

    const cleanContent = sanitizeContent(content || "");
    const list = await store.read("minigame");
    const entry = {
      id: store.makeId(),
      title: title.trim().slice(0, 60),
      category,
      author: (author || "운영팀").trim().slice(0, 30) || "운영팀",
      highlight: (highlight || "").trim().slice(0, 40),
      icon: (icon || "🎮").trim().slice(0, 4) || "🎮",
      colorFrom: (colorFrom || "#5c2d91").trim(),
      colorTo: (colorTo || "#2f1750").trim(),
      content: cleanContent,
      description: makeExcerpt(cleanContent),
      date: today(),
      updatedAt: null,
      views: 0,
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

    const { title, category, author, highlight, icon, colorFrom, colorTo, content } = req.body || {};
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ error: "게임 이름을 입력해주세요." });
      list[idx].title = title.trim().slice(0, 60);
    }
    if (category !== undefined) {
      if (!MINIGAME_CATEGORIES.includes(category)) return res.status(400).json({ error: "난이도가 올바르지 않습니다." });
      list[idx].category = category;
    }
    if (author !== undefined) list[idx].author = (author || "운영팀").trim().slice(0, 30) || "운영팀";
    if (highlight !== undefined) list[idx].highlight = highlight.trim().slice(0, 40);
    if (icon !== undefined && icon.trim()) list[idx].icon = icon.trim().slice(0, 4);
    if (colorFrom !== undefined && colorFrom.trim()) list[idx].colorFrom = colorFrom.trim();
    if (colorTo !== undefined && colorTo.trim()) list[idx].colorTo = colorTo.trim();
    if (content !== undefined) {
      if (String(content).length > MAX_CONTENT_LENGTH) {
        return res.status(400).json({ error: "내용이 너무 깁니다. 이미지 용량을 줄이거나 나눠서 작성해주세요." });
      }
      if (isContentEmpty(content)) return res.status(400).json({ error: "내용을 입력해주세요." });
      const cleanContent = sanitizeContent(content);
      list[idx].content = cleanContent;
      list[idx].description = makeExcerpt(cleanContent);
    }
    list[idx].updatedAt = today();

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
