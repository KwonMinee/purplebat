// ============================================================
// 아주 얇은 fetch 래퍼. 백엔드(server.js)가 켜져 있을 때만 동작하며,
// 서버가 꺼져있어도(=정적 파일만 열었을 때) 에러를 던지므로
// 호출하는 쪽에서 catch 하여 기존 정적 화면을 그대로 보여주면 됩니다.
// ============================================================

window.API = {
  async get(path) {
    const res = await fetch(path, { credentials: "same-origin" });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      /* 응답이 JSON이 아님 (서버 미실행 등) */
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || "요청에 실패했습니다.");
      err.status = res.status;
      throw err;
    }
    return data;
  },

  async post(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body || {}),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      /* noop */
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || "요청에 실패했습니다.");
      err.status = res.status;
      throw err;
    }
    return data;
  },

  async put(path, body) {
    const res = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body || {}),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      /* noop */
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || "요청에 실패했습니다.");
      err.status = res.status;
      throw err;
    }
    return data;
  },

  async del(path) {
    const res = await fetch(path, { method: "DELETE", credentials: "same-origin" });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      /* noop */
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || "요청에 실패했습니다.");
      err.status = res.status;
      throw err;
    }
    return data;
  },
};
