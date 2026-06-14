/* ============================================================
   KARAKURI — Workshop game (render + input + loop)
   ============================================================ */
import {
  DIR, DELTA, right, makeBelt, makeOp, makeFilter, makeSplitter,
} from './engine.js';
import { LEVELS, buildSim } from './levels.js';

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);
const canvas = $('ws-canvas');
const ctx = canvas.getContext('2d');
const wrap = $('canvas-wrap');

const C = {
  belt: '#1b2330', beltLine: '#33425a', grid: 'rgba(255,255,255,0.05)', cell: '#10151d',
  brass: '#d8a657', brassB: '#f2c879', brassD: '#a8772f',
  verd: '#57b09a', verdD: '#2f7d6b', signal: '#6cc6ff', copper: '#d4805a',
  paper: '#f3efe6', muted: '#8b96a8', lock: '#5a6577',
  even: '#57b09a', odd: '#6cc6ff',
};

/* ---------- State ---------- */
const SPEEDS = [{ label: '×1', dur: 360 }, { label: '×2', dur: 200 }, { label: '×4', dur: 100 }, { label: '×0.5', dur: 700 }];
const COMPLETED_KEY = 'karakuri.workshop.completed.v1';

const state = {
  levelIdx: 0,
  level: null,
  sim: null,
  counts: {},          // toolId -> remaining
  tools: [],           // palette tool descriptors (+ erase)
  tool: null,          // selected tool descriptor
  running: false,
  prog: 0,             // 0..1 animation progress within a step
  speedIdx: 0,
  hover: null,         // {r,c}
  fx: [],              // sink pops
  msg: '', msgKind: '',
  won: false,
  completed: loadCompleted(),
};

function loadCompleted() {
  try { return new Set(JSON.parse(localStorage.getItem(COMPLETED_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveCompleted() {
  try { localStorage.setItem(COMPLETED_KEY, JSON.stringify([...state.completed])); } catch {}
}

/* ---------- Canvas sizing ---------- */
let cs = 48, dpr = 1;
function resize() {
  const lvl = state.level; if (!lvl) return;
  const pad = 24;
  const availW = wrap.clientWidth - pad * 2;
  const availH = wrap.clientHeight - pad * 2;
  cs = Math.max(26, Math.min(74, Math.floor(Math.min(availW / lvl.cols, availH / lvl.rows))));
  const w = cs * lvl.cols, h = cs * lvl.rows;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
new ResizeObserver(resize).observe(wrap);

/* ---------- Level loading ---------- */
function loadLevel(idx) {
  idx = Math.max(0, Math.min(LEVELS.length - 1, idx));
  state.levelIdx = idx;
  const lvl = LEVELS[idx];
  state.level = lvl;
  state.sim = buildSim(lvl);
  state.tools = [...lvl.palette, { id: 'erase', kind: 'erase', label: '消す', sub: '部品を取り除く', count: Infinity }];
  state.counts = {};
  for (const t of lvl.palette) state.counts[t.id] = t.count;
  state.tool = lvl.palette[0];
  state.running = false; state.prog = 0; state.won = false; state.fx = [];
  state.msg = ''; state.msgKind = '';
  buildPaletteDOM();
  fillLevelInfo();
  hideToast();
  resize();
  updateStatus();
  if (location.hash !== '#' + lvl.id) history.replaceState(null, '', '#' + lvl.id);
}

function fillLevelInfo() {
  const l = state.level;
  $('lvl-no').textContent = '課題 ' + String(l.id).padStart(2, '0');
  $('lvl-title').textContent = l.title;
  $('lvl-concept').textContent = l.concept;
  $('lvl-brief').textContent = l.brief;
  $('lvl-idea').textContent = l.idea;
  $('lvl-hint').textContent = l.hint;
  $('goal-label').textContent = l.goal.label;
  $('goal-detail').textContent = 'まだ動かしていません';
  $('goal').classList.remove('is-win');
  refreshSelect();
}
function refreshSelect() {
  const sel = $('lvl-select'); sel.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = `${String(lv.id).padStart(2, '0')}　${lv.title}` + (state.completed.has(lv.id) ? '　✓' : '');
    if (i === state.levelIdx) o.selected = true;
    sel.appendChild(o);
  });
}

/* ---------- Palette ---------- */
function glyphFor(t) {
  if (t.kind === 'belt') return '→';
  if (t.kind === 'op') return t.op.glyph;
  if (t.kind === 'filter') return t.pred.glyph;
  if (t.kind === 'splitter') return '⋔';
  if (t.kind === 'erase') return '⌫';
  return '?';
}
function buildPaletteDOM() {
  const pal = $('palette'); pal.innerHTML = '';
  for (const t of state.tools) {
    const btn = document.createElement('button');
    btn.className = 'tool'; btn.dataset.kind = t.kind; btn.dataset.id = t.id;
    const cnt = state.counts[t.id];
    btn.innerHTML = `
      <span class="tool__glyph">${glyphFor(t)}</span>
      <span class="tool__body"><span class="tool__name">${t.label}</span><span class="tool__sub">${t.sub || ''}</span></span>
      <span class="tool__count">${t.kind === 'erase' ? '' : (cnt === Infinity ? '∞' : cnt)}</span>`;
    btn.addEventListener('click', () => selectTool(t.id));
    pal.appendChild(btn);
  }
  highlightTool();
}
function selectTool(id) { state.tool = state.tools.find(t => t.id === id); highlightTool(); }
function highlightTool() {
  document.querySelectorAll('.tool').forEach(el => el.classList.toggle('is-active', el.dataset.id === state.tool?.id));
}
function refreshCounts() {
  document.querySelectorAll('.tool').forEach(el => {
    const t = state.tools.find(x => x.id === el.dataset.id);
    if (!t || t.kind === 'erase') return;
    const c = state.counts[t.id];
    el.querySelector('.tool__count').textContent = c === Infinity ? '∞' : c;
    el.disabled = c !== Infinity && c <= 0 && state.tool?.id !== t.id;
  });
}

/* ---------- Editing ---------- */
function cellFromEvent(e) {
  const r = canvas.getBoundingClientRect();
  const c = Math.floor((e.clientX - r.left) / r.width * state.level.cols);
  const row = Math.floor((e.clientY - r.top) / r.height * state.level.rows);
  if (row < 0 || row >= state.level.rows || c < 0 || c >= state.level.cols) return null;
  return { r: row, c };
}
function makePart(t) {
  if (t.kind === 'belt') return makeBelt(DIR.E);
  if (t.kind === 'op') return makeOp(t.op, DIR.E);
  if (t.kind === 'filter') return makeFilter(t.pred, DIR.E);
  if (t.kind === 'splitter') return makeSplitter(DIR.E);
  return null;
}
function softReset() {
  const sim = state.sim;
  sim.tokens = []; sim.tick = 0; sim.spawned = 0;
  state.fx = []; state.prog = 0;
  for (let r = 0; r < sim.rows; r++) for (let c = 0; c < sim.cols; c++) {
    const p = sim.grid[r][c]; if (!p) continue;
    if (p.kind === 'source') { p.idx = 0; p.count = 0; p.done = false; }
    if (p.kind === 'sink') p.collected = [];
    if (p.kind === 'splitter') p.toggle = false;
  }
  state.won = false; $('goal').classList.remove('is-win');
}
function refund(part) {
  if (part && part._toolId && state.counts[part._toolId] !== undefined && state.counts[part._toolId] !== Infinity) {
    state.counts[part._toolId]++;
  }
}
function place(cell, erase) {
  if (state.running) return;
  const sim = state.sim;
  const existing = sim.grid[cell.r][cell.c];
  if (existing && existing.locked) { shake(); return; }
  if (sim.tick > 0 || sim.tokens.length) softReset();

  const tool = erase ? state.tools.find(t => t.id === 'erase') : state.tool;

  if (tool.kind === 'erase') {
    if (existing) { refund(existing); sim.grid[cell.r][cell.c] = null; }
  } else {
    if (existing && existing._toolId === tool.id) {
      existing.dir = right(existing.dir); // rotate same part
    } else {
      const have = state.counts[tool.id];
      if (have !== Infinity && have <= 0) { shake(); return; }
      if (existing) refund(existing);
      const part = makePart(tool);
      part._toolId = tool.id;
      sim.grid[cell.r][cell.c] = part;
      if (have !== Infinity) state.counts[tool.id]--;
    }
  }
  refreshCounts();
  setMsg('', '');
  $('goal-detail').textContent = 'まだ動かしていません';
}
function rotateAt(cell) {
  if (state.running || !cell) return;
  const p = state.sim.grid[cell.r][cell.c];
  if (!p || p.locked) return;
  if (sim_editable(p)) { if (state.sim.tick > 0 || state.sim.tokens.length) softReset(); p.dir = right(p.dir); }
}
const sim_editable = p => ['belt', 'op', 'filter', 'splitter'].includes(p.kind);

let shakeT = 0;
function shake() { shakeT = 1; }

/* ---------- Input wiring ---------- */
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  const cell = cellFromEvent(e); if (!cell) return;
  place(cell, e.button === 2 || e.shiftKey);
});
canvas.addEventListener('pointermove', e => { state.hover = cellFromEvent(e); });
canvas.addEventListener('pointerleave', () => { state.hover = null; });
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
  if (e.key === 'r' || e.key === 'R') rotateAt(state.hover);
  else if (e.key === 'Backspace' || e.key === 'Delete') { if (state.hover) place(state.hover, true); }
  else if (e.key === ' ') { e.preventDefault(); toggleRun(); }
  else if (e.key >= '1' && e.key <= '9') { const t = state.tools[(+e.key) - 1]; if (t) selectTool(t.id); }
});

/* ---------- Controls ---------- */
function toggleRun() {
  if (state.won) return;
  state.running = !state.running;
  if (state.running && state.sim.isSettled?.() && state.sim.tick === 0) { /* fresh */ }
  if (state.running) { setMsg('稼働中…', ''); state.prog = 0; }
  updateRunBtn();
}
function updateRunBtn() {
  const b = $('btn-run');
  b.classList.toggle('is-running', state.running);
  b.querySelector('span').textContent = state.running ? '止める' : '動かす';
  b.querySelector('svg').innerHTML = state.running
    ? '<path d="M4 3h3v10H4zM9 3h3v10H9z"/>'
    : '<path d="M4 3l9 5-9 5z"/>';
}
$('btn-run').addEventListener('click', toggleRun);
$('btn-step').addEventListener('click', () => { if (state.running || state.won) return; doStep(); state.prog = 0; });
$('btn-reset').addEventListener('click', () => { state.running = false; updateRunBtn(); softReset(); setMsg('', ''); $('goal-detail').textContent = 'まだ動かしていません'; updateStatus(); });
$('btn-speed').addEventListener('click', () => { state.speedIdx = (state.speedIdx + 1) % SPEEDS.length; $('speed-label').textContent = '速さ ' + SPEEDS[state.speedIdx].label; });
$('lvl-select').addEventListener('change', e => loadLevel(+e.target.value));
$('toast-next').addEventListener('click', () => loadLevel(state.levelIdx + 1));
$('toast-stay').addEventListener('click', hideToast);

/* ---------- Simulation step + win ---------- */
function doStep() {
  const sim = state.sim;
  const before = sinkLengths();
  sim.step();
  const after = sinkLengths();
  // sink pops
  for (const k in after) if (after[k] > (before[k] || 0)) {
    const [r, c] = k.split(',').map(Number);
    state.fx.push({ r, c, t: 0 });
  }
  checkOutcome();
  updateStatus();
}
function sinkLengths() {
  const sim = state.sim, out = {};
  for (let r = 0; r < sim.rows; r++) for (let c = 0; c < sim.cols; c++) {
    const p = sim.grid[r][c]; if (p && p.kind === 'sink') out[r + ',' + c] = p.collected.length;
  }
  return out;
}
function checkOutcome() {
  const sim = state.sim, lvl = state.level;
  const res = lvl.goal.check(sim.collected(), sim);
  $('goal-detail').textContent = res.detail;
  if (res.win && !state.won) { win(); return; }
  if (!res.win) {
    if (sim.isSettled()) { state.running = false; updateRunBtn(); setMsg('流れが止まった — 配置を見直そう', 'fail'); }
    else if (sim.tick >= sim.maxTick) { state.running = false; updateRunBtn(); setMsg('時間切れ — もう一度', 'fail'); }
  }
}
function win() {
  state.won = true; state.running = false; updateRunBtn();
  $('goal').classList.add('is-win');
  setMsg('課題クリア！', 'win');
  state.completed.add(state.level.id); saveCompleted();
  refreshSelect(); // update ✓ marks without clobbering the win styling
  showToast();
  burst();
}

/* ---------- Win toast ---------- */
function showToast() {
  const lvl = state.level;
  $('toast-title').textContent = lvl.id >= LEVELS.length ? '全課題を制覇！' : '組み上がった！';
  $('toast-msg').textContent = lvl.idea;
  $('toast-next').style.display = state.levelIdx >= LEVELS.length - 1 ? 'none' : '';
  $('toast').classList.add('is-show');
}
function hideToast() { $('toast').classList.remove('is-show'); }

/* ---------- confetti-ish burst ---------- */
let bursts = [];
function burst() {
  const lvl = state.level;
  for (let i = 0; i < 36; i++) {
    bursts.push({
      x: cs * lvl.cols / 2, y: cs * lvl.rows / 2,
      vx: (Math.cos(i / 36 * 6.28) * (1 + (i % 5))) * 1.6,
      vy: (Math.sin(i / 36 * 6.28) * (1 + (i % 5))) * 1.6 - 1,
      life: 1, col: [C.brass, C.verd, C.signal, C.brassB][i % 4],
    });
  }
}

/* ---------- Status ---------- */
function setMsg(m, kind) { state.msg = m; state.msgKind = kind || ''; }
function updateStatus() {
  const sim = state.sim;
  $('st-tick').textContent = sim.tick;
  $('st-tokens').textContent = sim.tokens.length;
  const col = sim.collected();
  $('st-collected').textContent = '[' + col.slice(-12).join(', ') + (col.length > 12 ? ', …' : '') + ']';
  const m = $('st-msg'); m.textContent = state.msg; m.className = 'msg ' + (state.msgKind ? 'is-' + state.msgKind : '');
}

/* ============================================================
   RENDERING
   ============================================================ */
const ease = t => t * t * (3 - 2 * t);
function center(r, c) { return { x: (c + 0.5) * cs, y: (r + 0.5) * cs }; }

function arrow(cx, cy, dir, len, color, w = 2) {
  const [dr, dc] = DELTA[dir];
  const ang = Math.atan2(dr, dc);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-len, 0); ctx.lineTo(len, 0);
  ctx.moveTo(len - w * 2.2, -w * 2.2); ctx.lineTo(len, 0); ctx.lineTo(len - w * 2.2, w * 2.2);
  ctx.stroke(); ctx.restore();
}
function box(r, c, fill, stroke, inset = 0.12) {
  const x = c * cs + cs * inset, y = r * cs + cs * inset, s = cs * (1 - inset * 2);
  ctx.beginPath(); ctx.roundRect(x, y, s, s, cs * 0.14);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.6; ctx.stroke(); }
}
function label(r, c, text, color, size = 0.3) {
  const { x, y } = center(r, c);
  ctx.fillStyle = color; ctx.font = `600 ${cs * size}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}
function lockMark(r, c) {
  const x = c * cs + cs * 0.78, y = r * cs + cs * 0.2;
  ctx.fillStyle = C.lock; ctx.font = `${cs * 0.16}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🔒', x, y);
}

function drawPart(r, c, p, time) {
  const { x, y } = center(r, c);
  switch (p.kind) {
    case 'belt': {
      box(r, c, C.belt, C.beltLine, 0.08);
      // animated chevrons along dir
      const flow = state.running ? (time * 0.0025) % 1 : 0.5;
      ctx.globalAlpha = 0.5;
      arrow(x, y, p.dir, cs * 0.22, C.beltLine, 2.4);
      ctx.globalAlpha = 1;
      break;
    }
    case 'op': {
      box(r, c, '#1a222e', C.brassD);
      label(r, c, p.op.glyph, C.brassB, p.op.glyph.length > 2 ? 0.24 : 0.32);
      arrowEdge(r, c, p.dir, C.brass);
      break;
    }
    case 'filter': {
      box(r, c, '#16201d', C.verdD);
      label(r, c, p.pred.glyph, C.verd, p.pred.glyph.length > 2 ? 0.2 : 0.32);
      arrowEdge(r, c, p.dir, C.verd);          // pass output
      arrowEdge(r, c, right(p.dir), C.copper, true); // reject output (dashed)
      break;
    }
    case 'splitter': {
      box(r, c, '#161e28', C.signal_d || C.signal);
      label(r, c, '⋔', C.signal, 0.34);
      arrowEdge(r, c, p.dir, C.signal);
      arrowEdge(r, c, right(p.dir), C.signal);
      break;
    }
    case 'source': {
      box(r, c, '#1d1810', C.brass);
      label(r, c, '源', C.brass, 0.34);
      arrowEdge(r, c, p.dir, C.brass);
      if (p.locked) lockMark(r, c);
      break;
    }
    case 'sink': {
      ctx.setLineDash([cs * 0.1, cs * 0.07]);
      box(r, c, 'rgba(0,0,0,0.25)', C.brassB);
      ctx.setLineDash([]);
      label(r, c, '溜', C.brassB, 0.3);
      if (p.id) { const cc = center(r, c); ctx.fillStyle = C.muted; ctx.font = `${cs * 0.16}px "JetBrains Mono"`; ctx.textAlign = 'center'; ctx.fillText(p.id, cc.x, r * cs + cs * 0.82); }
      if (p.locked) lockMark(r, c);
      break;
    }
  }
}
function arrowEdge(r, c, dir, color, dashed) {
  const { x, y } = center(r, c);
  const [dr, dc] = DELTA[dir];
  const ex = x + dc * cs * 0.34, ey = y + dr * cs * 0.34;
  ctx.save();
  if (dashed) { ctx.globalAlpha = 0.8; }
  arrow(ex, ey, dir, cs * 0.1, color, 2.2);
  ctx.restore();
}

function drawToken(t, time) {
  const a = center(t.prevR ?? t.r, t.prevC ?? t.c);
  const b = center(t.r, t.c);
  const e = state.running ? ease(state.prog) : ease(state.prog);
  const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
  const rad = cs * 0.3;
  const col = (t.value % 2 === 0) ? C.even : C.odd;
  ctx.save();
  ctx.shadowColor = col; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fillStyle = col; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
  ctx.fillStyle = '#0b0e13'; ctx.font = `700 ${rad * (String(t.value).length > 2 ? 0.85 : 1.05)}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(t.value, x, y + 0.5);
  ctx.restore();
}

function drawGrid() {
  const lvl = state.level;
  ctx.fillStyle = C.cell;
  ctx.fillRect(0, 0, cs * lvl.cols, cs * lvl.rows);
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  for (let c = 0; c <= lvl.cols; c++) { ctx.beginPath(); ctx.moveTo(c * cs, 0); ctx.lineTo(c * cs, lvl.rows * cs); ctx.stroke(); }
  for (let r = 0; r <= lvl.rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * cs); ctx.lineTo(lvl.cols * cs, r * cs); ctx.stroke(); }
}

let lastTime = 0;
function frame(time) {
  const dt = Math.min(time - lastTime || 16, 60); lastTime = time;
  const lvl = state.level;

  // advance sim
  const dur = SPEEDS[state.speedIdx].dur;
  state.prog += dt / dur;
  if (state.running) {
    let guard = 0;
    while (state.prog >= 1 && guard < 6) {
      state.prog -= 1; doStep(); guard++;
      if (!state.running) { state.prog = 0; break; }
    }
  } else if (state.prog > 1) state.prog = 1;

  // fx decay
  state.fx.forEach(f => f.t += dt / 380);
  state.fx = state.fx.filter(f => f.t < 1);
  bursts.forEach(b => { b.x += b.vx; b.y += b.vy; b.vy += 0.12; b.life -= dt / 900; });
  bursts = bursts.filter(b => b.life > 0);
  if (shakeT > 0) shakeT -= dt / 220;

  // ---- draw ----
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (shakeT > 0) ctx.translate(Math.sin(time / 18) * shakeT * 5, 0);

  drawGrid();

  // hover highlight
  if (state.hover && !state.running) {
    const p = state.sim.grid[state.hover.r][state.hover.c];
    ctx.fillStyle = (p && p.locked) ? 'rgba(240,106,106,0.10)' : 'rgba(216,166,87,0.10)';
    ctx.fillRect(state.hover.c * cs, state.hover.r * cs, cs, cs);
  }

  // parts
  for (let r = 0; r < lvl.rows; r++) for (let c = 0; c < lvl.cols; c++) {
    const p = state.sim.grid[r][c]; if (p) drawPart(r, c, p, time);
  }
  // sink pops
  for (const f of state.fx) {
    const { x, y } = center(f.r, f.c);
    ctx.beginPath(); ctx.arc(x, y, cs * (0.3 + f.t * 0.4), 0, 6.2832);
    ctx.strokeStyle = `rgba(242,200,121,${1 - f.t})`; ctx.lineWidth = 2; ctx.stroke();
  }
  // tokens
  for (const t of state.sim.tokens) drawToken(t, time);

  // bursts
  for (const b of bursts) { ctx.globalAlpha = Math.max(0, b.life); ctx.fillStyle = b.col; ctx.fillRect(b.x, b.y, 5, 5); }
  ctx.globalAlpha = 1;

  ctx.restore();
  requestAnimationFrame(frame);
}

/* ---------- Boot ---------- */
C.signal_d = '#2f7fb8';
const startId = parseInt((location.hash || '').slice(1), 10);
const startIdx = LEVELS.findIndex(l => l.id === startId);
loadLevel(startIdx >= 0 ? startIdx : 0);
$('speed-label').textContent = '速さ ' + SPEEDS[0].label;
requestAnimationFrame(frame);
