// ============================================================
// 콕슨의 벽돌깨기 - 캔버스 미니게임
// 벽돌을 깰 때마다 뒤에 숨어있는 콕슨의 이미지가 조금씩 드러납니다.
// (외부 라이브러리 없이 순수 Canvas 2D로 만들었습니다)
// ============================================================

(function () {
  "use strict";

  var canvas = document.getElementById("bbCanvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");

  var WIDTH = canvas.width; // 420
  var HEIGHT = canvas.height; // 620

  /* ---------- 벽돌 그리드 설정 ---------- */
  var COLS = 8;
  var ROWS = 8;
  var PADDING = 10;
  var GAP = 4;
  var TOP_OFFSET = 46;
  var BRICK_W = (WIDTH - PADDING * 2 - (COLS - 1) * GAP) / COLS;
  var BRICK_H = 34;
  var ROW_COLORS = ["#e5484d", "#f2994a", "#f2c94c", "#6fcf97", "#56ccf2", "#5c2d91", "#bb6bd9", "#eb5757"];

  /* ---------- 배경(공개) 이미지 ---------- */
  var revealImage = new Image();
  var revealImageLoaded = false;
  revealImage.onload = function () {
    revealImageLoaded = true;
  };
  revealImage.src = "assets/minigame-brick-coxon.png";

  /* ---------- 게임 상태 ---------- */
  var PADDLE_W = 86;
  var PADDLE_H = 14;
  var BALL_R = 7;

  var state = "start"; // start | ready | playing | win | gameover
  var score = 0;
  var stage = 1;
  var lives = 3;
  var baseSpeed = 4.2;
  var bricks = [];
  var particles = [];
  var paddleX = (WIDTH - PADDLE_W) / 2;
  var ball = { x: 0, y: 0, vx: 0, vy: 0 };

  var elScore = document.getElementById("bbScore");
  var elLives = document.getElementById("bbLives");
  var elStage = document.getElementById("bbStage");
  var elProgressFill = document.getElementById("bbProgressFill");
  var elProgressText = document.getElementById("bbProgressText");
  var overlayStart = document.getElementById("bbOverlayStart");
  var overlayWin = document.getElementById("bbOverlayWin");
  var overlayOver = document.getElementById("bbOverlayOver");
  var winThumb = document.getElementById("bbWinThumb");
  var winScoreEl = document.getElementById("bbWinScore");
  var overScoreEl = document.getElementById("bbOverScore");

  /* ---------- 사운드 (외부 파일 없이 짧은 비프음만) ---------- */
  var audioCtx = null;
  function beep(freq, dur, type) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = type || "square";
      osc.frequency.value = freq;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      osc.stop(audioCtx.currentTime + dur);
    } catch (e) {
      /* 오디오를 지원하지 않아도 게임은 계속 진행됩니다 */
    }
  }

  /* ---------- 벽돌 생성 ---------- */
  function buildBricks() {
    bricks = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        bricks.push({
          x: PADDING + c * (BRICK_W + GAP),
          y: TOP_OFFSET + r * (BRICK_H + GAP),
          w: BRICK_W,
          h: BRICK_H,
          color: ROW_COLORS[r % ROW_COLORS.length],
          alive: true,
        });
      }
    }
  }

  function aliveBrickCount() {
    var n = 0;
    for (var i = 0; i < bricks.length; i++) if (bricks[i].alive) n++;
    return n;
  }

  function updateProgressUI() {
    var total = bricks.length;
    var destroyed = total - aliveBrickCount();
    var pct = total ? Math.round((destroyed / total) * 100) : 0;
    if (elProgressFill) elProgressFill.style.width = pct + "%";
    if (elProgressText) elProgressText.textContent = pct + "%";
  }

  /* ---------- 공/패들 초기화 ---------- */
  function resetBallOnPaddle() {
    ball.x = paddleX + PADDLE_W / 2;
    ball.y = HEIGHT - 30 - PADDLE_H - BALL_R - 1;
    ball.vx = 0;
    ball.vy = 0;
  }

  function launchBall() {
    if (state !== "ready") return;
    var speed = baseSpeed + (stage - 1) * 0.5;
    var angle = -Math.PI / 2 + (Math.random() * 0.6 - 0.3);
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    state = "playing";
  }

  /* ---------- 파티클 (벽돌이 깨질 때 흩어지는 조각 효과) ---------- */
  function spawnParticles(x, y, color) {
    for (var i = 0; i < 8; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 1,
        life: 1,
        color: color,
        size: 3 + Math.random() * 3,
      });
    }
  }

  function updateParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= 0.035;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 배경 이미지를 캔버스 전체에 cover 방식으로 그리기 ---------- */
  function drawBackground() {
    ctx.fillStyle = "#1c1224";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (!revealImageLoaded) return;
    var iw = revealImage.naturalWidth;
    var ih = revealImage.naturalHeight;
    var scale = Math.max(WIDTH / iw, HEIGHT / ih);
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = (WIDTH - dw) / 2;
    var dy = (HEIGHT - dh) / 2;
    ctx.drawImage(revealImage, dx, dy, dw, dh);
  }

  function drawBricks() {
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(b.x, b.y, b.w, 4);
    }
  }

  function drawPaddle() {
    var y = HEIGHT - 30;
    var grad = ctx.createLinearGradient(paddleX, y, paddleX, y + PADDLE_H);
    grad.addColorStop(0, "#b28cf0");
    grad.addColorStop(1, "#5c2d91");
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(paddleX, y, PADDLE_W, PADDLE_H, 7);
    } else {
      ctx.rect(paddleX, y, PADDLE_W, PADDLE_H);
    }
    ctx.fill();
  }

  function drawBall() {
    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 4;
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /* ---------- 충돌 처리 ---------- */
  function handleBrickCollisions() {
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (!b.alive) continue;
      if (
        ball.x + BALL_R > b.x &&
        ball.x - BALL_R < b.x + b.w &&
        ball.y + BALL_R > b.y &&
        ball.y - BALL_R < b.y + b.h
      ) {
        b.alive = false;
        score += 10;
        spawnParticles(ball.x, ball.y, b.color);
        beep(520, 0.08, "square");

        var overlapLeft = ball.x + BALL_R - b.x;
        var overlapRight = b.x + b.w - (ball.x - BALL_R);
        var overlapTop = ball.y + BALL_R - b.y;
        var overlapBottom = b.y + b.h - (ball.y - BALL_R);
        var minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        if (minOverlap === overlapTop || minOverlap === overlapBottom) {
          ball.vy *= -1;
        } else {
          ball.vx *= -1;
        }
        updateProgressUI();
        updateHud();
        break;
      }
    }

    if (aliveBrickCount() === 0) {
      winStage();
    }
  }

  function handlePaddleCollision() {
    var y = HEIGHT - 30;
    if (
      ball.vy > 0 &&
      ball.y + BALL_R >= y &&
      ball.y + BALL_R <= y + PADDLE_H + 8 &&
      ball.x >= paddleX - BALL_R &&
      ball.x <= paddleX + PADDLE_W + BALL_R
    ) {
      var hitPos = (ball.x - (paddleX + PADDLE_W / 2)) / (PADDLE_W / 2); // -1 ~ 1
      var speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.02, 9.5);
      var angle = hitPos * (Math.PI / 3); // 최대 60도
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.cos(angle) * speed;
      ball.y = y - BALL_R - 0.5;
      beep(300, 0.06, "triangle");
    }
  }

  function updateBall() {
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x - BALL_R < 0) {
      ball.x = BALL_R;
      ball.vx *= -1;
    } else if (ball.x + BALL_R > WIDTH) {
      ball.x = WIDTH - BALL_R;
      ball.vx *= -1;
    }
    if (ball.y - BALL_R < 0) {
      ball.y = BALL_R;
      ball.vy *= -1;
    }

    handlePaddleCollision();
    handleBrickCollisions();

    if (ball.y - BALL_R > HEIGHT) {
      loseLife();
    }
  }

  function loseLife() {
    lives -= 1;
    updateHud();
    beep(140, 0.3, "sawtooth");
    if (lives <= 0) {
      gameOver();
    } else {
      state = "ready";
      resetBallOnPaddle();
    }
  }

  function winStage() {
    state = "win";
    beep(660, 0.12, "sine");
    setTimeout(function () {
      beep(880, 0.18, "sine");
    }, 120);
    if (winScoreEl) winScoreEl.textContent = score + "점";
    if (winThumb && revealImageLoaded) winThumb.src = revealImage.src;
    showOverlay(overlayWin);
  }

  function gameOver() {
    state = "gameover";
    beep(110, 0.4, "sawtooth");
    if (overScoreEl) overScoreEl.textContent = score + "점";
    showOverlay(overlayOver);
  }

  function updateHud() {
    if (elScore) elScore.textContent = score;
    if (elLives) elLives.textContent = "❤️".repeat(Math.max(lives, 0)) || "-";
    if (elStage) elStage.textContent = stage;
  }

  function showOverlay(el) {
    [overlayStart, overlayWin, overlayOver].forEach(function (o) {
      if (o) o.classList.add("hidden");
    });
    if (el) el.classList.remove("hidden");
  }

  function hideOverlays() {
    [overlayStart, overlayWin, overlayOver].forEach(function (o) {
      if (o) o.classList.add("hidden");
    });
  }

  /* ---------- 스테이지 시작 / 재시작 ---------- */
  function startStage(newStage, keepScore) {
    stage = newStage;
    if (!keepScore) score = 0;
    lives = 3;
    particles = [];
    buildBricks();
    paddleX = (WIDTH - PADDLE_W) / 2;
    resetBallOnPaddle();
    updateHud();
    updateProgressUI();
    state = "ready";
    hideOverlays();
  }

  function restartGame() {
    startStage(1, false);
  }

  function nextStage() {
    startStage(stage + 1, true);
  }

  /* ---------- 입력 처리 ---------- */
  function getCanvasX(clientX) {
    var rect = canvas.getBoundingClientRect();
    var scale = WIDTH / rect.width;
    return (clientX - rect.left) * scale;
  }

  function movePaddleTo(x) {
    paddleX = Math.max(0, Math.min(WIDTH - PADDLE_W, x - PADDLE_W / 2));
  }

  canvas.addEventListener("mousemove", function (e) {
    movePaddleTo(getCanvasX(e.clientX));
  });

  canvas.addEventListener(
    "touchmove",
    function (e) {
      if (e.touches && e.touches[0]) {
        movePaddleTo(getCanvasX(e.touches[0].clientX));
      }
      e.preventDefault();
    },
    { passive: false }
  );

  function handleTapLaunch(clientX) {
    if (clientX != null) movePaddleTo(getCanvasX(clientX));
    if (state === "ready") launchBall();
  }

  canvas.addEventListener("click", function (e) {
    handleTapLaunch(e.clientX);
  });
  canvas.addEventListener(
    "touchstart",
    function (e) {
      if (e.touches && e.touches[0]) handleTapLaunch(e.touches[0].clientX);
      e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener("keydown", function (e) {
    if (e.code === "Space") {
      e.preventDefault();
      if (state === "ready") launchBall();
    } else if (e.code === "ArrowLeft") {
      paddleX = Math.max(0, paddleX - 24);
    } else if (e.code === "ArrowRight") {
      paddleX = Math.min(WIDTH - PADDLE_W, paddleX + 24);
    }
  });

  var startBtn = document.getElementById("bbStartBtn");
  var retryBtn = document.getElementById("bbRetryBtn");
  var nextBtn = document.getElementById("bbNextBtn");
  var winRestartBtn = document.getElementById("bbWinRestartBtn");

  if (startBtn) startBtn.addEventListener("click", function () {
    startStage(1, false);
  });
  if (retryBtn) retryBtn.addEventListener("click", restartGame);
  if (nextBtn) nextBtn.addEventListener("click", nextStage);
  if (winRestartBtn) winRestartBtn.addEventListener("click", restartGame);

  /* ---------- 메인 루프 ---------- */
  function loop() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawBackground();

    if (state === "playing") {
      updateBall();
    } else if (state === "ready") {
      resetBallOnPaddle();
    }

    updateParticles();
    drawBricks();
    drawParticles();
    drawPaddle();
    drawBall();

    requestAnimationFrame(loop);
  }

  /* ---------- 초기화 ---------- */
  buildBricks();
  resetBallOnPaddle();
  updateHud();
  updateProgressUI();
  showOverlay(overlayStart);
  requestAnimationFrame(loop);
})();
