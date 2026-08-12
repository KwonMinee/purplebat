// ============================================================
// 관리자 인증 라우트
// - 관리자 계정이 하나도 없을 때만 회원가입이 가능합니다.
//   (누구나 마음대로 관리자 계정을 만들 수 없도록 하는 안전장치)
// - 그 이후에는 로그인으로만 관리자 모드에 들어갈 수 있습니다.
// ============================================================

const express = require("express");
const bcrypt = require("bcryptjs");
const store = require("../lib/jsonStore");

const router = express.Router();

// 현재 관리자 계정 존재 여부 + 로그인 상태 확인
router.get("/status", async (req, res) => {
  try {
    const users = await store.read("users");
    res.json({
      adminExists: users.length > 0,
      loggedIn: !!(req.session && req.session.isAdmin),
      username: (req.session && req.session.username) || null,
    });
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// 관리자 회원가입 (최초 1회만 허용)
router.post("/signup", async (req, res) => {
  try {
    const users = await store.read("users");
    if (users.length > 0) {
      return res
        .status(403)
        .json({ error: "이미 관리자 계정이 존재합니다. 로그인해주세요." });
    }

    const { username, password } = req.body || {};
    if (!username || typeof username !== "string" || username.trim().length < 3) {
      return res.status(400).json({ error: "아이디는 3자 이상 입력해주세요." });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "비밀번호는 6자 이상 입력해주세요." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: store.makeId(),
      username: username.trim(),
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    await store.write("users", [user]);

    req.session.isAdmin = true;
    req.session.username = user.username;
    res.json({ success: true, username: user.username });
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// 관리자 로그인
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const users = await store.read("users");
    const user = users.find((u) => u.username === (username || "").trim());

    if (!user) {
      return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    }

    const match = await bcrypt.compare(password || "", user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    }

    req.session.isAdmin = true;
    req.session.username = user.username;
    res.json({ success: true, username: user.username });
  } catch (err) {
    res.status(500).json({ error: "데이터베이스 연결에 실패했습니다.", detail: err.message });
  }
});

// 로그아웃
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

module.exports = router;
