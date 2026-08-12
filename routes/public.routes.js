// ============================================================
// 공개 API - 누구나 접근 가능
// 조회(GET)는 전부 열려있고, 작성(POST)은 방명록/게시판만 허용합니다.
// 수정·삭제는 관리자 전용 라우트(admin.routes.js)에서만 가능합니다.
// ============================================================

const express = require("express");
const store = require("../lib/jsonStore");

const router = express.Router();

function today() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

router.get("/notices", async (req, res) => {
  try {
    res.json(await store.read("notices"));
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.get("/archive", async (req, res) => {
  try {
    const { category } = req.query;
    const list = await store.read("archive");
    res.json(category && category !== "all" ? list.filter((i) => i.category === category) : list);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.get("/goods", async (req, res) => {
  try {
    const { category } = req.query;
    const list = await store.read("goods");
    res.json(category && category !== "all" ? list.filter((i) => i.category === category) : list);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.get("/guestbook", async (req, res) => {
  try {
    res.json(await store.read("guestbook"));
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.post("/guestbook", async (req, res) => {
  try {
    const { name, role, message } = req.body || {};
    if (!name || !name.trim() || !message || !message.trim()) {
      return res.status(400).json({ error: "닉네임과 메시지를 입력해주세요." });
    }
    const list = await store.read("guestbook");
    const entry = {
      id: store.makeId(),
      name: name.trim().slice(0, 30),
      role: (role || "모험가").trim().slice(0, 20) || "모험가",
      message: message.trim().slice(0, 500),
      date: today(),
      emoji: ["🛡️", "🗡️", "🏹", "🔥", "❄️", "🌙", "⭐", "🍀"][Math.floor(Math.random() * 8)],
    };
    list.unshift(entry);
    await store.write("guestbook", list);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.get("/minigame", async (req, res) => {
  try {
    const { category } = req.query;
    const list = await store.read("minigame");
    res.json(category && category !== "all" ? list.filter((g) => g.category === category) : list);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

router.get("/board", async (req, res) => {
  try {
    const { category } = req.query;
    const list = await store.read("board");
    res.json(category && category !== "all" ? list.filter((p) => p.category === category) : list);
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

module.exports = router;
