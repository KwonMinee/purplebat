// ============================================================
// 보라박쥐단 (Borabakjwidan) ADVENTURE ARCHIVE - 백엔드 서버
// Node.js + Express, 데이터는 MongoDB Atlas(무료 클라우드 DB)에 저장합니다.
// (관리자 모드에서 수정한 내용이 재배포/재시작 후에도 사라지지 않도록
//  기존 data/*.json 파일 기반 저장소에서 MongoDB로 전환했습니다.)
//
// 실행 전 준비: .env 파일에 MONGODB_URI를 설정해야 합니다. (.env.example 참고)
// 실행: npm install && npm start   (또는 start.bat / start.sh 더블클릭)
// 접속: http://localhost:3000
// ============================================================

require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const publicRoutes = require("./routes/public.routes");
const adminRoutes = require("./routes/admin.routes");
const charactersRoutes = require("./routes/characters.routes");
const store = require("./lib/jsonStore");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

if (!process.env.MONGODB_URI) {
  console.warn("");
  console.warn("⚠️  MONGODB_URI 환경변수가 설정되어 있지 않습니다.");
  console.warn("   .env 파일(로컬) 또는 Render 환경변수(배포)에 MongoDB Atlas 연결 문자열을 추가해주세요.");
  console.warn("   설정 방법은 실행법_및_배포가이드.md 문서를 참고해주세요.");
  console.warn("");
}

app.disable("x-powered-by");
app.use(express.json());

app.use(
  session({
    name: "borabakjwidan.sid",
    secret: process.env.SESSION_SECRET || "borabakjwidan-adventure-archive-secret-키를-바꿔주세요",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8, // 8시간
    },
  })
);

// ---- admin.html은 로그인한 관리자만 접근 가능 (정적 서빙보다 먼저 가로챔) ----
app.get("/admin.html", (req, res, next) => {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect("/admin-login.html");
});

// ---- 정적 파일 (프론트엔드 전체) ----
app.use(express.static(PUBLIC_DIR));

// ---- API 라우트 ----
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/characters", charactersRoutes);
app.use("/api", publicRoutes);

// 정의되지 않은 API 요청
app.use("/api", (req, res) => {
  res.status(404).json({ error: "존재하지 않는 API입니다." });
});

// 그 외 알 수 없는 경로는 홈으로
app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, async () => {
  console.log("");
  console.log("🦇 보라박쥐단 서버가 실행되었습니다!");
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → 관리자 로그인: http://localhost:${PORT}/admin-login.html`);
  console.log("");

  if (process.env.MONGODB_URI) {
    try {
      await store.connect();
      console.log("✅ MongoDB에 연결되었습니다.");
    } catch (err) {
      console.error("❌ MongoDB 연결에 실패했습니다:", err.message);
    }
  }
});
