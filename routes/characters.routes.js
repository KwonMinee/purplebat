// ============================================================
// 캐릭터 방(프로필 + 전용 게시판) 라우트
// - 조회(GET)는 누구나 가능
// - 프로필 수정(PUT), 게시글 작성(POST)/삭제(DELETE)는 관리자만 가능
// ============================================================

const express = require("express");
const store = require("../lib/jsonStore");
const requireAdmin = require("../middleware/requireAdmin");
const { sanitizeContent, makeExcerpt, MAX_CONTENT_LENGTH } = require("../lib/contentSanitizer");

const router = express.Router();

function today() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

async function findCharacter(id) {
  const list = await store.read("characters");
  return list.find((c) => c.id === id);
}

// ---- 캐릭터 목록 ----
router.get("/", async (req, res) => {
  try {
    res.json(await store.read("characters"));
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// ---- 캐릭터 상세 ----
router.get("/:id", async (req, res) => {
  try {
    const character = await findCharacter(req.params.id);
    if (!character) return res.status(404).json({ error: "캐릭터를 찾을 수 없습니다." });
    res.json(character);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// ---- 캐릭터 프로필 수정 (관리자 전용) ----
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const list = await store.read("characters");
    const idx = list.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "캐릭터를 찾을 수 없습니다." });

    const { name, role, level, description, image, stats } = req.body || {};

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: "이름을 입력해주세요." });
      list[idx].name = name.trim().slice(0, 30);
    }
    if (role !== undefined) list[idx].role = role.trim().slice(0, 60);
    if (level !== undefined && !isNaN(Number(level))) list[idx].level = Number(level);
    if (description !== undefined) list[idx].description = description.trim().slice(0, 500);
    if (image !== undefined && image.trim()) list[idx].image = image.trim();
    if (Array.isArray(stats)) {
      list[idx].stats = stats.slice(0, 3).map((s) => ({
        label: String((s && s.label) || "").trim().slice(0, 10) || "능력치",
        value: Math.max(0, Math.min(100, Number(s && s.value) || 0)),
      }));
    }

    await store.write("characters", list);
    res.json(list[idx]);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// ---- 캐릭터 게시판 목록 ----
router.get("/:id/posts", async (req, res) => {
  try {
    if (!(await findCharacter(req.params.id))) {
      return res.status(404).json({ error: "캐릭터를 찾을 수 없습니다." });
    }
    const posts = (await store.read("characterPosts")).filter((p) => p.characterId === req.params.id);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// ---- 캐릭터 게시글 상세 (조회수 +1) ----
router.get("/:id/posts/:postId", async (req, res) => {
  try {
    const posts = await store.read("characterPosts");
    const idx = posts.findIndex((p) => p.id === req.params.postId && p.characterId === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });

    posts[idx].views = (posts[idx].views || 0) + 1;
    await store.write("characterPosts", posts);
    res.json(posts[idx]);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// ---- 캐릭터 게시글 작성 (관리자 전용) ----
router.post("/:id/posts", requireAdmin, async (req, res) => {
  try {
    if (!(await findCharacter(req.params.id))) {
      return res.status(404).json({ error: "캐릭터를 찾을 수 없습니다." });
    }
    const { title, content, author } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: "제목을 입력해주세요." });
    if (!content || !content.trim()) return res.status(400).json({ error: "내용을 입력해주세요." });
    if (String(content).length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({ error: "내용이 너무 깁니다. 이미지 용량을 줄이거나 나눠서 작성해주세요." });
    }

    const cleanContent = sanitizeContent(content);
    const posts = await store.read("characterPosts");
    const entry = {
      id: store.makeId(),
      characterId: req.params.id,
      title: title.trim().slice(0, 120),
      content: cleanContent,
      excerpt: makeExcerpt(cleanContent),
      author: (author || "운영팀").trim().slice(0, 30) || "운영팀",
      date: today(),
      updatedAt: null,
      views: 0,
    };
    posts.unshift(entry);
    await store.write("characterPosts", posts);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// ---- 캐릭터 게시글 수정 (관리자 전용) ----
router.put("/:id/posts/:postId", requireAdmin, async (req, res) => {
  try {
    const posts = await store.read("characterPosts");
    const idx = posts.findIndex((p) => p.id === req.params.postId && p.characterId === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });

    const { title, content, author } = req.body || {};
    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ error: "제목을 입력해주세요." });
      posts[idx].title = title.trim().slice(0, 120);
    }
    if (author !== undefined) posts[idx].author = (author || "운영팀").trim().slice(0, 30) || "운영팀";
    if (content !== undefined) {
      if (!content.trim()) return res.status(400).json({ error: "내용을 입력해주세요." });
      if (String(content).length > MAX_CONTENT_LENGTH) {
        return res.status(400).json({ error: "내용이 너무 깁니다. 이미지 용량을 줄이거나 나눠서 작성해주세요." });
      }
      const cleanContent = sanitizeContent(content);
      posts[idx].content = cleanContent;
      posts[idx].excerpt = makeExcerpt(cleanContent);
    }
    posts[idx].updatedAt = today();

    await store.write("characterPosts", posts);
    res.json(posts[idx]);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// ---- 캐릭터 게시글 삭제 (관리자 전용) ----
router.delete("/:id/posts/:postId", requireAdmin, async (req, res) => {
  try {
    const posts = (await store.read("characterPosts")).filter(
      (p) => !(p.id === req.params.postId && p.characterId === req.params.id)
    );
    await store.write("characterPosts", posts);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

module.exports = router;
