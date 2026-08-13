// ============================================================
// 블로그 글쓰기 에디터에서 저장되는 HTML을 가볍게 청소합니다.
// (관리자만 글을 쓸 수 있는 구조라 완벽한 보안 파서까지는 아니지만,
//  스크립트 실행/이벤트 핸들러 삽입 같은 위험 요소는 걸러냅니다.
//  <iframe>은 우리 에디터가 만드는 유튜브/비메오 임베드만 허용합니다.)
// 게시판(board) 글, 캐릭터 방(characterPosts) 글 양쪽에서 공통으로 사용합니다.
// ============================================================

const MAX_CONTENT_LENGTH = 3000000; // 약 3MB. 이미지를 base64로 본문에 직접 넣기 때문에 넉넉하게 잡았습니다.

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

// 텍스트도 사진/영상도 전혀 없는 빈 본문인지 확인합니다. (아카이브/미니게임 등에서 공통 사용)
function isContentEmpty(html) {
  const text = String(html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  if (text) return false;
  if (/<img[\s>]/i.test(html || "") || /<iframe[\s>]/i.test(html || "")) return false;
  return true;
}

module.exports = { sanitizeContent, makeExcerpt, isContentEmpty, MAX_CONTENT_LENGTH };
