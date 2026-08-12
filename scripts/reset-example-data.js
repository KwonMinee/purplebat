// ============================================================
// 1회성 정리 스크립트: 실제 MongoDB에 이미 들어가있는 "예시(더미) 게시글"을 지웁니다.
//
// data/*.json 파일을 빈 배열로 바꿔도, 이미 MongoDB에 저장되어 있던
// 예전 예시 데이터(공지사항/아카이브/굿즈/방명록/게시판/미니게임)는
// 그대로 남아있기 때문에 이 스크립트로 한 번 정리해줘야 합니다.
//
// 캐릭터(characters, characterPosts)와 관리자 계정(users)은 건드리지 않습니다.
//
// 실행 방법:
//   1. .env 파일에 MONGODB_URI가 설정되어 있는지 확인
//   2. 터미널에서: npm run reset-example-data
//      (또는: node scripts/reset-example-data.js)
// ============================================================

require("dotenv").config();
const { MongoClient } = require("mongodb");

const COLLECTIONS_TO_CLEAR = ["notices", "archive", "goods", "guestbook", "board", "minigame"];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI 환경변수가 없습니다. .env 파일을 확인해주세요.");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  console.log("");
  console.log("🧹 예시 게시글 정리를 시작합니다 (캐릭터/관리자 계정은 건드리지 않습니다)");
  console.log("");

  for (const name of COLLECTIONS_TO_CLEAR) {
    const result = await db.collection(name).deleteMany({});
    console.log(`  - ${name}: ${result.deletedCount}개 삭제됨`);
  }

  console.log("");
  console.log("✅ 완료되었습니다. 이제부터 관리자 대시보드에서 새로 작성한 글만 쌓입니다.");
  console.log("");

  await client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ 정리 중 오류가 발생했습니다:", err.message);
  process.exit(1);
});
