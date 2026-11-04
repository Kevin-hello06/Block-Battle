// Simple CPU opponents. Each picks a target (rotation, column) for the current
// piece, then "presses buttons" towards it at a speed set by difficulty.

// ---------- block mode ----------
function evalBlockGrid(grid) {
  let lines = 0;
  const rows = [];
  for (const r of grid) { if (r.every((c) => c)) lines++; else rows.push(r); }
  while (rows.length < grid.length) rows.unshift(Array(B_COLS).fill(null));

  const heights = Array(B_COLS).fill(0);
  let holes = 0;
  for (let x = 0; x < B_COLS; x++) {
    let seen = false;
    for (let y = 0; y < rows.length; y++) {
      if (rows[y][x]) { if (!seen) { heights[x] = rows.length - y; seen = true; } }
      else if (seen) holes++;
    }
  }
  const agg = heights.reduce((a, b) => a + b, 0);
  let bump = 0;
  for (let x = 0; x < B_COLS - 1; x++) bump += Math.abs(heights[x] - heights[x + 1]);
  return -0.51 * agg + 0.76 * lines - 0.36 * holes - 0.18 * bump;
}

function planBlock(g, noise) {
  const p = g.piece;
  const rots = p.type === 'O' ? [0] : [0, 1, 2, 3];
  let best = null;
  for (const rot of rots) {
    for (let x = -3; x < B_COLS; x++) {
      const t = { type: p.type, rot, x, y: p.y };
      if (g.collides(t)) continue;
      while (!g.collides({ ...t, y: t.y + 1 })) t.y++;
      const grid = g.grid.map((r) => r.slice());
      for (const [cx, cy] of g.cells(t)) if (cy >= 0) grid[cy][cx] = '#';
      const score = evalBlockGrid(grid) + (Math.random() - 0.5) * noise;
      if (!best || score > best.score) best = { rot, x, score };
    }
  }
  return best;
}

// ---------- blob mode ----------
function colTop(grid, x) {
  for (let y = P_ROWS - 1; y >= 0; y--) if (grid[y][x] === null) return y;
  return -1;
}

function dropPair(grid, x, rot, a, b) {
  const cx = x + P_OFF[rot][0];
  if (cx < 0 || cx >= P_COLS) return false;
  const place = (col, c) => { const y = colTop(grid, col); if (y < 0) return false; grid[y][col] = c; return true; };
  if (rot === 0) return place(x, a) && place(x, b);
  if (rot === 2) return place(x, b) && place(x, a);
  return place(x, a) && place(cx, b);
}

function simulateChain(grid) {
  let chain = 0, attack = 0;
  for (;;) {
    puyoGravity(grid);
    const groups = puyoFindGroups(grid);
    if (!groups.length) break;
    chain++;
    attack += puyoStepAttack(chain, groups);
    for (const [x, y] of puyoPopCells(grid, groups)) grid[y][x] = null;
  }
  return { chain, attack };
}

function evalBlobGrid(grid, sim, pending) {
  if (grid[1][P_SPAWN_X] !== null) return -1e6;
  let conn = 0, maxH = 0;
  const heights = [];
  for (let x = 0; x < P_COLS; x++) {
    const h = P_ROWS - 1 - colTop(grid, x);
    heights.push(h);
    maxH = Math.max(maxH, h);
    for (let y = 1; y < P_ROWS; y++) {
      const c = grid[y][x];
      if (c === null || c === P_NUISANCE) continue;
      if (x + 1 < P_COLS && grid[y][x + 1] === c) conn++;
      if (y + 1 < P_ROWS && grid[y + 1][x] === c) conn++;
    }
  }
  let bump = 0;
  for (let x = 0; x < P_COLS - 1; x++) bump += Math.abs(heights[x] - heights[x + 1]);
  const danger = maxH >= 8 || heights[P_SPAWN_X] >= 7 || pending > 12;
  let score = conn * 1.5 - bump * 0.4 - maxH * 0.3 - heights[P_SPAWN_X] * 0.8;
  score += sim.attack * (sim.chain >= 2 ? 14 : danger ? 10 : 2);
  return score;
}

function planPuyo(g, noise) {
  const p = g.pair;
  let best = null;
  for (let rot = 0; rot < 4; rot++) {
    for (let x = 0; x < P_COLS; x++) {
      const grid = g.grid.map((r) => r.slice());
      if (!dropPair(grid, x, rot, p.a, p.b)) continue;
      const sim = simulateChain(grid);
      const score = evalBlobGrid(grid, sim, g.pending) + (Math.random() - 0.5) * noise * 4;
      if (!best || score > best.score) best = { rot, x, score };
    }
  }
  return best;
}

// ---------- driver ----------
class CpuPlayer {
  constructor(game, difficulty) {
    this.g = game;
    this.lv = CONFIG.cpu[difficulty] || CONFIG.cpu.normal;
    this.planId = -1;
    this.target = null;
    this.t = 0;
    this.steps = 0;
  }

  update(dt) {
    const g = this.g;
    if (!g.canControl()) return;
    if (this.planId !== g.pieceId) {
      this.planId = g.pieceId;
      this.target = g.kind === 'block' ? planBlock(g, this.lv.noise) : planPuyo(g, this.lv.noise);
      this.t = this.lv.think;
      this.steps = 0;
    }
    this.t -= dt;
    let guard = 0;
    while (this.t <= 0 && g.canControl() && this.planId === g.pieceId && guard++ < 10) {
      this.act();
      this.t += this.lv.step;
    }
  }

  act() {
    const g = this.g;
    const cur = g.kind === 'block' ? g.piece : g.pair;
    const tg = this.target;
    if (!tg || ++this.steps > 25) { g.hardDrop(); return; }
    if (cur.rot !== tg.rot) {
      const d = (tg.rot - cur.rot + 4) % 4 === 3 ? -1 : 1;
      if (!g.rotate(d)) this.target = { ...tg, rot: cur.rot };
      return;
    }
    if (cur.x !== tg.x) {
      if (!g.move(Math.sign(tg.x - cur.x))) g.hardDrop();
      return;
    }
    g.hardDrop();
  }
}
