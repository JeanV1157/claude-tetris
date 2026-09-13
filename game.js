'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (nut)
  '#37474f', // Bomba
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - Tuerca
  [[9]],                                       // Bomba
];

const BOMB_TYPE = 9;
const BOMB_SCORE = 100;
const LINES_PER_BOMB = 5;

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const powerupEl = document.getElementById('powerup-counter');
const swapSectionEl = document.getElementById('swap-section');
const swapCounterEl = document.getElementById('swap-counter');
const swapProgressEl = document.getElementById('swap-progress');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const comboDisplayEl = document.getElementById('combo-display');
const volumeSlider = document.getElementById('volume-slider');

const CLEAR_ANIM_MS = 200;
const COMBO_BONUS = 50;

// ---- Audio (Web Audio API) ----
const VOLUME_KEY = 'tetris-volume';
let audioCtx = null;
let masterGain = null;
let volume = 0.4;

function getAudioCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, duration, type, delay, peak) {
  const ctxA = getAudioCtx();
  const osc = ctxA.createOscillator();
  const gain = ctxA.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  const start = ctxA.currentTime + (delay || 0);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak ?? 0.6, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playLineClearSound() {
  playTone(880, 0.12, 'square', 0, 0.5);
}

function playComboSound(combo) {
  if (combo === 2) {
    playTone(523.25, 0.1, 'triangle', 0, 0.5);
    playTone(659.25, 0.14, 'triangle', 0.09, 0.5);
  } else if (combo === 3) {
    playTone(659.25, 0.09, 'square', 0, 0.45);
    playTone(987.77, 0.14, 'square', 0.08, 0.5);
  } else {
    playTone(523.25, 0.09, 'sawtooth', 0, 0.4);
    playTone(659.25, 0.09, 'sawtooth', 0.09, 0.4);
    playTone(783.99, 0.09, 'sawtooth', 0.18, 0.45);
    playTone(1046.5, 0.22, 'sawtooth', 0.27, 0.55);
  }
}

function playDropTickSound() {
  playTone(150, 0.045, 'square', 0, 0.18);
}

function playPauseSound(isPausing) {
  if (isPausing) {
    playTone(440, 0.09, 'sine', 0, 0.35);
    playTone(330, 0.12, 'sine', 0.08, 0.3);
  } else {
    playTone(330, 0.09, 'sine', 0, 0.3);
    playTone(440, 0.12, 'sine', 0.08, 0.35);
  }
}

function playGameOverSound() {
  playTone(392.0, 0.15, 'sawtooth', 0, 0.45);
  playTone(329.63, 0.15, 'sawtooth', 0.15, 0.42);
  playTone(261.63, 0.15, 'sawtooth', 0.3, 0.4);
  playTone(196.0, 0.4, 'sawtooth', 0.45, 0.4);
}

function initVolume() {
  const saved = localStorage.getItem(VOLUME_KEY);
  volume = saved !== null ? Number(saved) / 100 : 0.4;
  volumeSlider.value = Math.round(volume * 100);
  if (masterGain) masterGain.gain.value = volume;
}

volumeSlider.addEventListener('input', () => {
  volume = Number(volumeSlider.value) / 100;
  if (masterGain) masterGain.gain.value = volume;
  localStorage.setItem(VOLUME_KEY, volumeSlider.value);
});

// ---- Combo visual ----
let comboAnimTimeout = null;

function showCombo(combo) {
  if (combo < 2) return;
  const tier = combo >= 4 ? 'combo-4' : combo === 3 ? 'combo-3' : 'combo-2';
  comboDisplayEl.textContent = `${combo}x COMBO!`;
  comboDisplayEl.className = 'combo-display';
  void comboDisplayEl.offsetWidth;
  comboDisplayEl.classList.add(tier, 'show');
  clearTimeout(comboAnimTimeout);
  comboAnimTimeout = setTimeout(() => comboDisplayEl.classList.remove('show'), 800);
}

const THEME_KEY = 'tetris-theme';
let gridColor = '#22222e';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.checked = theme === 'light';
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-color').trim();
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked ? 'light' : 'dark');
});

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let linesSinceBomb, bombQueued;
let pieceQueue, swapLocked, piecesUntilSwap;
let combo, clearing, clearRows, clearStart;

const SWAP_COOLDOWN_PIECES = 3;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

const PIECE_WEIGHTS = [3, 3, 3, 3, 3, 3, 3, 1]; // types 1-8; nut (8) is rarer

function instantiatePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  const totalWeight = PIECE_WEIGHTS.reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;
  let type = 1;
  for (let i = 0; i < PIECE_WEIGHTS.length; i++) {
    if (roll < PIECE_WEIGHTS[i]) { type = i + 1; break; }
    roll -= PIECE_WEIGHTS[i];
  }
  return instantiatePiece(type);
}

function makeBombPiece() {
  return instantiatePiece(BOMB_TYPE);
}

function nextFromPool() {
  if (bombQueued) {
    bombQueued = false;
    return makeBombPiece();
  }
  if (pieceQueue.length) {
    return instantiatePiece(pieceQueue.shift());
  }
  return randomPiece();
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function findFullRows() {
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    if (board[r].every(v => v !== 0)) rows.push(r);
  }
  return rows;
}

function finalizeClear() {
  const cleared = clearRows.length;
  const sorted = [...clearRows].sort((a, b) => a - b);
  for (const r of sorted) {
    board.splice(r, 1);
    board.unshift(new Array(COLS).fill(0));
  }

  lines += cleared;
  combo++;
  score += (LINE_SCORES[cleared] || 0) * level;

  if (combo >= 2) {
    score += combo * COMBO_BONUS * level;
    showCombo(combo);
    playComboSound(combo);
  } else {
    playLineClearSound();
  }

  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  linesSinceBomb += cleared;
  while (linesSinceBomb >= LINES_PER_BOMB) {
    linesSinceBomb -= LINES_PER_BOMB;
    bombQueued = true;
  }

  clearing = false;
  clearRows = [];
  updateHUD();
  afterLock();
}

function explodeBomb() {
  for (let r = current.y - 1; r <= current.y + 1; r++) {
    if (r < 0 || r >= ROWS) continue;
    for (let c = current.x - 1; c <= current.x + 1; c++) {
      if (c < 0 || c >= COLS) continue;
      board[r][c] = 0;
    }
  }
  score += BOMB_SCORE;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  playDropTickSound();
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    playDropTickSound();
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (current.type === BOMB_TYPE) {
    explodeBomb();
    afterLock();
    return;
  }

  merge();
  const fullRows = findFullRows();
  if (fullRows.length) {
    clearing = true;
    clearRows = fullRows;
    clearStart = performance.now();
  } else {
    combo = 0;
    afterLock();
  }
}

function afterLock() {
  if (swapLocked) {
    piecesUntilSwap--;
    if (piecesUntilSwap <= 0) {
      swapLocked = false;
      piecesUntilSwap = 0;
    }
  }
  spawn();
  updateHUD();
}

function trySwap() {
  if (swapLocked) return;
  const swapped = instantiatePiece(next.type);
  if (collide(swapped.shape, swapped.x, swapped.y)) return;
  const upcoming = nextFromPool();
  pieceQueue.push(current.type);
  current = swapped;
  next = upcoming;
  swapLocked = true;
  piecesUntilSwap = SWAP_COOLDOWN_PIECES;
  drawNext();
  updateHUD();
}

function spawn() {
  current = next;
  next = nextFromPool();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  powerupEl.textContent = current.type === BOMB_TYPE || next.type === BOMB_TYPE
    ? '¡Activo!'
    : (LINES_PER_BOMB - linesSinceBomb);

  swapCounterEl.textContent = swapLocked ? '1/1' : '0/1';
  swapSectionEl.classList.toggle('disabled', swapLocked);
  if (swapLocked) {
    swapProgressEl.hidden = false;
    swapProgressEl.textContent = `Disponible en ${piecesUntilSwap} pieza${piecesUntilSwap === 1 ? '' : 's'}`;
  } else {
    swapProgressEl.hidden = true;
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (colorIndex === BOMB_TYPE) {
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `${Math.floor(size * 0.7)}px sans-serif`;
    context.fillText('💣', x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function drawClearFlash() {
  const elapsed = performance.now() - clearStart;
  const t = Math.min(1, elapsed / CLEAR_ANIM_MS);
  const blink = Math.sin(t * Math.PI * 10) > 0;
  const alpha = 0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI * 10));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = blink ? '#ffffff' : '#ffeb3b';
  for (const r of clearRows) {
    ctx.fillRect(0, r * BLOCK, COLS * BLOCK, BLOCK);
  }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (clearing) {
    drawClearFlash();
    return;
  }

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  playGameOverSound();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  playPauseSound(paused);
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver) return;
  const dt = ts - lastTime;
  lastTime = ts;

  if (clearing) {
    if (ts - clearStart >= CLEAR_ANIM_MS) {
      finalizeClear();
      if (gameOver) return;
    }
    draw();
    animId = requestAnimationFrame(loop);
    return;
  }

  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      playDropTickSound();
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  linesSinceBomb = 0;
  bombQueued = false;
  pieceQueue = [];
  swapLocked = false;
  piecesUntilSwap = 0;
  combo = 0;
  clearing = false;
  clearRows = [];
  clearStart = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver || clearing) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyH':
    case 'KeyE':
      trySwap();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

initTheme();
initVolume();
init();
