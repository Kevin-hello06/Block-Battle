// Blob mode: 6x12 board, connect 4+ same-coloured blobs to pop them and build chains.

const P_COLS = 6;
const P_ROWS = 13;      // row 0 is hidden
const P_SPAWN_X = 2;    // the "X" column: if row 1 here fills up, you lose
const P_NUISANCE = 'n';
const P_COLORS = ['#ef4b5a', '#43c26b', '#3f8cf0', '#f5c542', '#b26ce8'];
const P_NUISANCE_COLOR = '#9aa0b5';
// child offset relative to pivot for rot 0..3 (up, right, down, left)
const P_OFF = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// ---- pure helpers (shared with the CPU) ----
function puyoGravity(grid) {
  for (let x = 0; x < P_COLS; x++) {
    let write = P_ROWS - 1;
    for (let y = P_ROWS - 1; y >= 0; y--) {
      const v = grid[y][x];
      if (v !== null) { grid[y][x] = null; grid[write][x] = v; write--; }
    }
  }
}

function puyoFindGroups(grid) {
  const seen = Array.from({ length: P_ROWS }, () => Array(P_COLS).fill(false));
  const groups = [];
  for (let y = 1; y < P_ROWS; y++) {
    for (let x = 0; x < P_COLS; x++) {
      const c = grid[y][x];
      if (c === null || c === P_NUISANCE || seen[y][x]) continue;
      const group = [];
      const stack = [[x, y]];
      seen[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        group.push([cx, cy]);
        for (const [dx, dy] of P_OFF) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= P_COLS || ny < 1 || ny >= P_ROWS) continue;
          if (seen[ny][nx] || grid[ny][nx] !== c) continue;
          seen[ny][nx] = true;
          stack.push([nx, ny]);
        }
      }
      if (group.length >= 4) groups.push({ color: c, cells: group });
    }
  }
  return groups;
}

// Returns list of [x,y] to remove: the groups plus adjacent nuisance.
function puyoPopCells(grid, groups) {
  const key = (x, y) => y * P_COLS + x;
  const set = new Map();
  for (const g of groups) {
    for (const [x, y] of g.cells) {
      set.set(key(x, y), [x, y]);
      for (const [dx, dy] of P_OFF) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= P_COLS || ny < 1 || ny >= P_ROWS) continue;
        if (grid[ny][nx] === P_NUISANCE) set.set(key(nx, ny), [nx, ny]);
      }
    }
  }
  return [...set.values()];
}

function puyoStepAttack(chain, groups) {
  const A = CONFIG.attack;
  let step = chain === 1 ? A.puyoSinglePop : A.puyoChainPower[Math.min(chain, A.puyoChainPower.length - 1)];
  for (const g of groups) step += A.puyoGroupBonus * (g.cells.length - 4);
  step += A.puyoColorBonus * (new Set(groups.map((g) => g.color)).size - 1);
  return step;
}

class PuyoGame {
  constructor(opts) {
    this.kind = 'puyo';
    this.cfg = CONFIG.puyo;
    this.rng = opts.rng || Math.random;
    this.onAttack = opts.onAttack || (() => {});
    this.reset();
  }

  reset() {
    this.grid = Array.from({ length: P_ROWS }, () => Array(P_COLS).fill(null));
    this.queue = [];
    this.pending = 0;          // in nuisance blobs
    this.dead = false;
    this.maxChain = 0;
    this.sent = 0;
    this.chain = 0;
    this.chainAttack = 0;
    this.attackCarry = 0;
    this.state = 'active';
    this.timer = 0;
    this.elapsed = 0;
    this.level = 1;
    this.gravT = 0;
    this.lockT = 0;
    this.lockResets = 0;
    this.softDropping = false;
    this.popping = null;
    this.rep = new Repeater(this.cfg.das, this.cfg.arr);
    this.pieceId = 0;
    this.msg = null;
    this.spawn();
  }

  refill() {
    const n = this.cfg.colors;
    while (this.queue.length < 3) this.queue.push([Math.floor(this.rng() * n), Math.floor(this.rng() * n)]);
  }

  spawn() {
    this.refill();
    const [a, b] = this.queue.shift();
    this.refill();
    this.state = 'active';
    if (this.grid[1][P_SPAWN_X] !== null) { this.dead = true; this.pair = null; return; }
    this.pair = { x: P_SPAWN_X, y: 1, rot: 0, a, b };
    this.lockT = 0;
    this.lockResets = 0;
    this.gravT = 0;
    this.pieceId++;
  }

  pcells(p) {
    const [dx, dy] = P_OFF[p.rot];
    return [[p.x, p.y, p.a], [p.x + dx, p.y + dy, p.b]];
  }

  blocked(x, y) {
    if (x < 0 || x >= P_COLS || y >= P_ROWS) return true;
    return y >= 0 && this.grid[y][x] !== null;
  }

  fits(p) { return this.pcells(p).every(([x, y]) => !this.blocked(x, y)); }
  canControl() { return !this.dead && this.state === 'active' && !!this.pair; }
  grounded() { return !this.fits({ ...this.pair, y: this.pair.y + 1 }); }

  resetLock() {
    if (this.lockResets < this.cfg.maxLockResets) { this.lockT = 0; this.lockResets++; }
  }

  move(dx) {
    if (!this.canControl()) return false;
    const p = { ...this.pair, x: this.pair.x + dx };
    if (!this.fits(p)) return false;
    this.pair = p;
    this.resetLock();
    return true;
  }

  rotate(dir) {
    if (!this.canControl()) return false;
    const tryRot = (rot) => {
      const p = { ...this.pair, rot };
      if (this.fits(p)) return p;
      const [dx, dy] = P_OFF[rot];
      const k = { ...p, x: p.x - dx, y: p.y - dy };   // push away from the wall/stack
      return this.fits(k) ? k : null;
    };
    const p = tryRot((this.pair.rot + dir + 4) % 4) || tryRot((this.pair.rot + 2) % 4); // flip if stuck
    if (!p) return false;
    this.pair = p;
    this.resetLock();
    return true;
  }

  fall() {
    const p = { ...this.pair, y: this.pair.y + 1 };
    if (!this.fits(p)) return false;
    this.pair = p;
    return true;
  }

  hardDrop() {
    if (!this.canControl()) return;
    while (this.fall());
    this.lock();
  }

  hold() { /* no hold in blob mode */ }

  receiveGarbage(lines) { this.pending += lines * this.cfg.nuisancePerLine; }

  popup(text) { this.msg = { text, t: 1200 }; }

  lock() {
    for (const [x, y, c] of this.pcells(this.pair)) if (y >= 0) this.grid[y][x] = c;
    this.pair = null;
    this.chain = 0;
    this.chainAttack = 0;
    puyoGravity(this.grid);
    this.state = 'settle';
    this.timer = this.cfg.settleTime;
  }

  finishChain() {
    if (this.chain > 0) {
      const total = this.chainAttack + this.attackCarry;
      let atk = Math.floor(total);
      this.attackCarry = total - atk;
      const npl = this.cfg.nuisancePerLine;
      const cancel = Math.min(this.pending, atk * npl);
      this.pending -= cancel;
      atk -= Math.ceil(cancel / npl);
      if (atk > 0) { this.sent += atk; this.onAttack(atk); }
    }
    if (this.pending > 0) {
      this.dropNuisance();
      this.state = 'garbage';
      this.timer = this.cfg.garbageTime;
    } else {
      this.spawn();
    }
  }

  dropNuisance() {
    const n = Math.min(this.pending, this.cfg.maxNuisancePerDrop);
    this.pending -= n;
    const counts = Array(P_COLS).fill(Math.floor(n / P_COLS));
    const cols = [...Array(P_COLS).keys()].sort(() => Math.random() - 0.5);
    for (let i = 0; i < n % P_COLS; i++) counts[cols[i]]++;
    for (let x = 0; x < P_COLS; x++) {
      for (let k = 0; k < counts[x]; k++) {
        let y = P_ROWS - 1;
        while (y >= 0 && this.grid[y][x] !== null) y--;
        if (y >= 0) this.grid[y][x] = P_NUISANCE;
      }
    }
  }

  handleInput(c, dt) {
    if (!this.canControl()) return;
    if (c.pressed('cw')) this.rotate(1);
    if (c.pressed('ccw')) this.rotate(-1);
    const dir = (c.down('right') ? 1 : 0) - (c.down('left') ? 1 : 0);
    const steps = this.rep.update(dir, dt);
    for (let i = 0; i < Math.abs(steps); i++) if (!this.move(Math.sign(steps))) break;
    this.softDropping = c.down('soft');
    if (c.pressed('hard')) this.hardDrop();
  }

  update(dt) {
    if (this.msg) this.msg.t -= dt;
    if (this.dead) return;
    this.elapsed += dt;
    this.level = 1 + Math.floor(this.elapsed / 1000 / this.cfg.gravityLevelSeconds);

    if (this.state === 'active') {
      if (!this.pair) return;
      const interval = Math.max(this.cfg.minGravity,
        this.cfg.startGravity * Math.pow(this.cfg.gravityFactor, this.level - 1));
      const eff = this.softDropping ? Math.min(interval, this.cfg.softDropInterval) : interval;
      if (this.grounded()) {
        this.lockT += dt;
        if (this.lockT >= (this.softDropping ? this.cfg.lockDelay / 2 : this.cfg.lockDelay)) this.lock();
      } else {
        this.lockT = 0;
        this.gravT += dt;
        while (this.gravT >= eff) { this.gravT -= eff; if (!this.fall()) break; }
      }
      return;
    }

    this.timer -= dt;
    if (this.timer > 0) return;

    if (this.state === 'settle') {
      const groups = puyoFindGroups(this.grid);
      if (groups.length) {
        this.chain++;
        this.maxChain = Math.max(this.maxChain, this.chain);
        this.chainAttack += puyoStepAttack(this.chain, groups);
        this.popping = puyoPopCells(this.grid, groups);
        if (this.chain >= 2) this.popup(`${this.chain}-CHAIN!`);
        this.state = 'pop';
        this.timer = this.cfg.popTime;
      } else {
        this.finishChain();
      }
    } else if (this.state === 'pop') {
      for (const [x, y] of this.popping) this.grid[y][x] = null;
      this.popping = null;
      puyoGravity(this.grid);
      this.state = 'settle';
      this.timer = this.cfg.chainPause;
    } else if (this.state === 'garbage') {
      this.spawn();
    }
  }

  statsText() { return `Best chain ${this.maxChain}   ·   Sent ${this.sent}   ·   Lv ${this.level}`; }

  // ---------- drawing ----------
  draw(ctx, L) {
    const s = L.w / P_COLS;
    const r = s * 0.44;
    drawBoardBg(ctx, L, P_COLS, P_ROWS - 1);

    // danger X
    ctx.strokeStyle = 'rgba(255,77,109,0.45)';
    ctx.lineWidth = 3;
    const xx = L.x + P_SPAWN_X * s, xy = L.y;
    ctx.beginPath();
    ctx.moveTo(xx + s * 0.25, xy + s * 0.25); ctx.lineTo(xx + s * 0.75, xy + s * 0.75);
    ctx.moveTo(xx + s * 0.75, xy + s * 0.25); ctx.lineTo(xx + s * 0.25, xy + s * 0.75);
    ctx.stroke();

    const flashOn = this.popping && Math.floor(this.timer / 70) % 2 === 0;
    const popSet = new Set((this.popping || []).map(([x, y]) => y * P_COLS + x));
    if (this.dead) ctx.globalAlpha = 0.4;
    for (let y = 1; y < P_ROWS; y++) {
      for (let x = 0; x < P_COLS; x++) {
        const c = this.grid[y][x];
        if (c === null) continue;
        const cx = L.x + x * s + s / 2, cy = L.y + (y - 1) * s + s / 2;
        const isN = c === P_NUISANCE;
        drawBlob(ctx, cx, cy, r, isN ? P_NUISANCE_COLOR : P_COLORS[c], isN, flashOn && popSet.has(y * P_COLS + x));
      }
    }
    ctx.globalAlpha = 1;

    if (this.pair && !this.dead) {
      for (const [x, y, c] of this.pcells(this.pair)) {
        if (y >= 1) drawBlob(ctx, L.x + x * s + s / 2, L.y + (y - 1) * s + s / 2, r, P_COLORS[c]);
      }
    }
    drawBoardFrame(ctx, L);

    drawPanel(ctx, L.nextX, L.y, 80, 200, 'NEXT');
    for (let i = 0; i < 2; i++) {
      const [a, b] = this.queue[i];
      const cx = L.nextX + 40, top = L.y + 30 + i * 85, rr = i === 0 ? 17 : 13;
      drawBlob(ctx, cx, top + rr, rr, P_COLORS[b]);
      drawBlob(ctx, cx, top + rr * 3 + 2, rr, P_COLORS[a]);
    }

    drawMeter(ctx, L.meterX, L.y, L.h, this.pending / (P_COLS * 12));
    drawPopup(ctx, L, this.msg);
  }
}
