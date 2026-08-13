// ============================================================
// 1회성 정리 스크립트: 실제 MongoDB에 이미 들어가있는 캐릭터 이름을 바꿉니다.
//
// data/characters.json / data/characterPosts.json 파일을 고쳐도,
// 이미 MongoDB에 저장되어 있던 캐릭터 데이터(characters, characterPosts)는
// 그대로 남아있기 때문에 이 스크립트로 한 번 정리해줘야 합니다.
//
// 바뀌는 이름:
//   아르곤 -> 로완
//   제드릭 -> 루스
//   엘리아 -> 콕슨
//   리온   -> 굴리아나
//
// characters 컬렉션은 id로 정확히 찾아서 name 필드만 바꾸고,
// characterPosts 컬렉션은 title/content 안에 옛 이름이 들어있으면
// 문자열 치환으로 바꿉니다(캐릭터의 id, 이미지 경로 등은 건드리지 않습니다).
//
// 실행 방법:
//   1. .env 파일에 MONGODB_URI가 설정되어 있는지 확인
//   2. 터미널에서: npm run rename-characters
//      (또는: node scripts/rename-characters.js)
// ============================================================

require("dotenv").config();
const { MongoClient } = require("mongodb");

// id로 정확히 찾아서 바꾸는 매핑 (가장 안전한 방식)
const NAME_BY_ID = {
  argon: "로완",
  jedrik: "루스",
  elia: "콕슨",
  leon: "굴리아나",
};

// title/content 안의 옛 이름을 새 이름으로 바꾸는 매핑
const TEXT_REPLACEMENTS = [
  ["아르곤", "로완"],
  ["제드릭", "루스"],
  ["엘리아", "콕슨"],
  ["리온", "굴리아나"],
];

function replaceAll(text, replacements) {
  let out = String(text || "");
  for (const [from, to] of replacements) {
    out = out.split(from).join(to);
  }
  return out;
}

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
  console.log("✏️  캐릭터 이름 변경을 시작합니다 (아르곤→로완, 제드릭→루스, 엘리아→콕슨, 리온→굴리아나)");
  console.log("");

  // 1) characters 컬렉션: id 기준으로 name 필드만 정확히 교체
  const characters = db.collection("characters");
  for (const [id, newName] of Object.entries(NAME_BY_ID)) {
    const result = await characters.updateOne({ id }, { $set: { name: newName } });
    if (result.matchedCount > 0) {
      console.log(`  - characters: ${id} → "${newName}" (수정됨)`);
    } else {
      console.log(`  - characters: ${id} 없음 (건너뜀)`);
    }
  }

  // 2) characterPosts 컬렉션: title/content 안의 옛 이름을 문자열로 치환
  const characterPosts = db.collection("characterPosts");
  const posts = await characterPosts.find({}).toArray();
  let postsChanged = 0;
  for (const post of posts) {
    const newTitle = replaceAll(post.title, TEXT_REPLACEMENTS);
    const newContent = replaceAll(post.content, TEXT_REPLACEMENTS);
    if (newTitle !== post.title || newContent !== post.content) {
      await characterPosts.updateOne({ _id: post._id }, { $set: { title: newTitle, content: newContent } });
      postsChanged += 1;
    }
  }
  console.log(`  - characterPosts: ${postsChanged}개 글 내용 수정됨`);

  console.log("");
  console.log("✅ 완료되었습니다. 홈페이지를 새로고침하면 바뀐 이름이 보여요.");
  console.log("");

  await client.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ 이름 변경 중 오류가 발생했습니다:", err.message);
  process.exit(1);
});
