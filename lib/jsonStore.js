// ============================================================
// 데이터 저장소 (MongoDB Atlas 연동)
// - 예전에는 data/*.json 파일에 직접 읽고 썼지만, Render 같은 호스팅은
//   재배포/재시작 때마다 디스크가 초기화되어 관리자 모드에서 수정한 내용이
//   사라지는 문제가 있었습니다.
// - 이제는 MongoDB(무료 Atlas 클러스터)에 저장해서 재배포/재시작해도
//   데이터가 영구적으로 남습니다.
// - 파일 이름(jsonStore.js)은 예전 그대로지만 내부 구현은 MongoDB입니다.
//   routes/*.js 쪽 코드(require 경로, 함수 사용법)는 그대로 두어도 되도록
//   read/write 함수의 사용 방식(배열 전체를 읽고 쓰는 방식)은 유지했습니다.
//   대신 이제 모두 비동기(Promise)이므로 호출부에서는 await를 붙여야 합니다.
// ============================================================

const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const MONGODB_URI = process.env.MONGODB_URI;

// 최초 실행 시 컬렉션이 비어있으면 이 파일들의 내용으로 자동 시딩합니다.
const SEED_COLLECTIONS = [
  "users",
  "notices",
  "archive",
  "goods",
  "guestbook",
  "board",
  "characters",
  "characterPosts",
  "minigame",
];

let clientPromise = null;
let dbInstance = null;
let seeded = false;

function readSeedFile(name) {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, `${name}.json`), "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function stripMongoId(doc) {
  const { _id, ...rest } = doc;
  return rest;
}

async function connect() {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI 환경변수가 설정되어 있지 않습니다. .env 파일 또는 Render 환경변수에 MongoDB Atlas 연결 문자열을 추가해주세요."
    );
  }
  if (!clientPromise) {
    const client = new MongoClient(MONGODB_URI);
    clientPromise = client.connect();
  }
  const client = await clientPromise;
  if (!dbInstance) {
    dbInstance = client.db(); // 연결 문자열에 DB 이름이 포함되어 있으면 그 DB를 사용합니다.
  }
  return dbInstance;
}

// 컬렉션이 비어있을 때만 data/*.json의 기존 시드 데이터를 한 번 넣어줍니다.
async function seedIfEmpty() {
  if (seeded) return;
  const db = await connect();
  for (const name of SEED_COLLECTIONS) {
    const col = db.collection(name);
    const count = await col.countDocuments();
    if (count === 0) {
      const seedData = readSeedFile(name);
      if (Array.isArray(seedData) && seedData.length > 0) {
        await col.insertMany(seedData.map(stripMongoId));
      }
    }
  }
  seeded = true;
}

async function read(name) {
  const db = await connect();
  await seedIfEmpty();
  const docs = await db.collection(name).find({}).toArray();
  return docs.map(stripMongoId);
}

async function write(name, data) {
  const db = await connect();
  await seedIfEmpty();
  const col = db.collection(name);
  await col.deleteMany({});
  if (Array.isArray(data) && data.length > 0) {
    await col.insertMany(data.map(stripMongoId));
  }
}

function makeId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = { read, write, makeId, connect };
