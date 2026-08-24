/* ============================================================
 * 别踩白块 · Piano Tiles
 * 一个 vibe coding（AI 辅助编程）作品 —— 原生 JS 实现，零依赖
 * ============================================================ */
'use strict';

/* ---------- DOM ---------- */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('gameover-screen');
const aboutModal = document.getElementById('about-modal');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const comboEl = document.getElementById('combo');
const startBestEl = document.getElementById('start-best');
const finalScoreEl = document.getElementById('final-score');
const finalBestEl = document.getElementById('final-best');

/* ---------- 常量 ---------- */
const COLS = 4;
const BASE_SPEED = 260;      // 初始下落速度 px/s
const SPEED_PER_SCORE = 6;   // 每得 1 分增加的加速度
const MAX_SPEED = 950;
const BASE_SPAWN = 560;      // 初始生成间隔 ms
const SPAWN_PER_SCORE = 5;   // 每得 1 分缩短的间隔
const MIN_SPAWN = 200;
const BEST_KEY = 'pianoTilesBest';

/* ---------- 状态 ---------- */
let state = 'start';         // start | playing | over
let tiles = [];              // { col, y, hit }
let particles = [];
let score = 0;
let combo = 0;
let speed = BASE_SPEED;
let spawnGap = BASE_SPAWN;
let spawnTimer = 0;
let best = Number(localStorage.getItem(BEST_KEY) || 0);
let lastTime = 0;
let tileW = 0;
let tileH = 0;
let spawnHistory = [];

const W = () => canvas.clientWidth;
const H = () => canvas.clientHeight;

/* ---------- 音频（Web Audio 实时合成） ---------- */
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

// C 大调琶音，一列一个音
const NOTES = [523.25, 659.25, 783.99, 1046.5];

function playNote(col, vol = 0.16) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = NOTES[col];
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.2);
}

function playGameOver() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  [440, 349.23, 261.63].forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.1, t + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.4);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t + i * 0.18);
    osc.stop(t + i * 0.18 + 0.5);
  });
}

/* ---------- 画布尺寸（适配 DPR 与手机） ---------- */
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W() * dpr;
  canvas.height = H() * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tileW = W() / COLS;
  tileH = Math.max(tileW * 0.62, 84);
}
window.addEventListener('resize', resize);

/* ---------- 粒子特效 ---------- */
function burst(x, y, color = '#f59e0b') {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 120 + Math.random() * 240;
    particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 60,
      life: 1,
      size: 3 + Math.random() * 5,
      color,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 500 * dt;
    p.life -= dt * 2.2;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

/* ---------- 方块生成 ---------- */
function randomCol() {
  let c = Math.floor(Math.random() * COLS);
  // 避免方块刚生成就和上一个叠在同一列
  if (spawnHistory.length) {
    const last = spawnHistory[spawnHistory.length - 1];
    if (c === last && Math.random() < 0.6) {
      c = (c + 1 + Math.floor(Math.random() * (COLS - 1))) % COLS;
    }
  }
  spawnHistory.push(c);
  if (spawnHistory.length > 4) spawnHistory.shift();
  return c;
}

function spawnTile() {
  tiles.push({ col: randomCol(), y: -tileH, hit: false });
}

/* ---------- 主逻辑 ---------- */
function update(dt) {
  // 难度递增
  speed = Math.min(BASE_SPEED + score * SPEED_PER_SCORE, MAX_SPEED);
  spawnGap = Math.max(BASE_SPAWN - score * SPAWN_PER_SCORE, MIN_SPAWN);

  spawnTimer += dt * 1000;
  if (spawnTimer >= spawnGap) {
    spawnTimer = 0;
    spawnTile();
  }

  for (const t of tiles) t.y += speed * dt;

  // 漏掉（滑出底部）= 游戏结束
  for (const t of tiles) {
    if (!t.hit && t.y > H()) return gameOver();
  }

  tiles = tiles.filter(t => t.hit || t.y < H() + tileH);
}

/* ---------- 点击/触控/键盘 ---------- */
function tapAt(x, y) {
  if (state !== 'playing') return;
  ensureAudio();

  const col = Math.floor(x / tileW);
  if (col < 0 || col >= COLS) return;

  // 找该列最靠下、未命中的方块
  let target = null;
  for (const t of tiles) {
    if (!t.hit && t.col === col && t.y <= H()) {
      if (!target || t.y > target.y) target = t;
    }
  }

  // 点到白块 = 游戏结束
  if (!target) return gameOver();

  target.hit = true;
  score++;
  combo++;
  playNote(col);
  burst(target.col * tileW + tileW / 2, target.y + tileH / 2);

  scoreEl.textContent = score;
  if (combo > 0) {
    comboEl.textContent = `🔥 连击 x${combo}`;
    comboEl.style.display = 'block';
  }
  if (combo % 5 === 0) flashCombo();
}

function flashCombo() {
  comboEl.classList.remove('pop');
  void comboEl.offsetWidth; // 触发重排以重启动画
  comboEl.classList.add('pop');
}

canvas.addEventListener('pointerdown', e => {
  const rect = canvas.getBoundingClientRect();
  tapAt(e.clientX - rect.left, e.clientY - rect.top);
});

window.addEventListener('keydown', e => {
  if (state !== 'playing') return;
  const map = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, s: 1, d: 2, f: 3 };
  const col = map[e.key.toLowerCase()];
  if (col !== undefined) tapAt(col * tileW + tileW / 2, H() - 60);
});

/* ---------- 游戏生命周期 ---------- */
function startGame() {
  ensureAudio();
  state = 'playing';
  tiles = [];
  particles = [];
  spawnHistory = [];
  score = 0;
  combo = 0;
  speed = BASE_SPEED;
  spawnGap = BASE_SPAWN;
  spawnTimer = 900; // 给玩家一点反应时间
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  scoreEl.textContent = '0';
  comboEl.textContent = '';
  comboEl.style.display = 'none';
  bestEl.textContent = best;
  lastTime = performance.now();
}

function gameOver() {
  state = 'over';
  playGameOver();

  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
  }

  finalScoreEl.textContent = score;
  finalBestEl.textContent = best;
  bestEl.textContent = best;
  gameOverScreen.classList.remove('hidden');
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

/* ---------- 关于弹窗 ---------- */
const repoLink = document.getElementById('repo-link');
const host = location.hostname;
if (host && host !== 'localhost' && host !== '127.0.0.1') {
  repoLink.href = `https://github.com/${host.split('.')[0]}/vibe-coded-piano-tiles`;
} else {
  repoLink.textContent = 'vibe-coded-piano-tiles（发布后自动带上链接）';
}

document.getElementById('about-btn').addEventListener('click', () => {
  ensureAudio();
  aboutModal.classList.remove('hidden');
});
document.getElementById('modal-close').addEventListener('click', () => {
  aboutModal.classList.add('hidden');
});
aboutModal.addEventListener('click', e => {
  if (e.target === aboutModal) aboutModal.classList.add('hidden');
});

/* ---------- 渲染 ---------- */
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function render() {
  const w = W();
  const h = H();

  // 背景（象牙白渐变）
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#faf6ec');
  grad.addColorStop(1, '#efe5d3');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 列分隔线
  ctx.strokeStyle = 'rgba(31,36,48,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < COLS; i++) {
    ctx.beginPath();
    ctx.moveTo(i * tileW, 0);
    ctx.lineTo(i * tileW, h);
    ctx.stroke();
  }

  // 底部危险线
  ctx.strokeStyle = 'rgba(225,29,72,0.35)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, h - 6);
  ctx.lineTo(w, h - 6);
  ctx.stroke();
  ctx.setLineDash([]);

  // 方块
  for (const t of tiles) {
    if (t.hit) continue;
    ctx.fillStyle = '#1f2430';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    roundRect(t.col * tileW + 4, t.y, tileW - 8, tileH - 6, 10);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  // 粒子
  for (const p of particles) {
    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ---------- 主循环 ---------- */
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  if (state === 'playing') {
    update(dt);
    updateParticles(dt);
  }
  render();
  requestAnimationFrame(loop);
}

/* ---------- 启动 ---------- */
resize();
startBestEl.textContent = best;
bestEl.textContent = best;
lastTime = performance.now();
requestAnimationFrame(loop);
