// 세션에 isAdmin 플래그가 있는 요청만 통과시키는 미들웨어.
// 관리자 API(공지/아카이브/굿즈 추가·삭제, 방명록/게시판 삭제 등)는
// 반드시 로그인(또는 최초 1회 회원가입)을 거쳐야만 접근할 수 있습니다.
module.exports = function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: "관리자 로그인이 필요합니다." });
};
