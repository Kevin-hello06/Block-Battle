// Falling-block mode: 10x20 board, clear full rows.

const B_COLS = 10;
const B_ROWS = 22;   // includes hidden rows at the top
const B_HIDDEN = 2;
const B_GARBAGE = '#6b7280';

const B_DEFS = {
  I: { color: '#36c5d9', m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
  O: { color: '#f4c542', m: [[1, 1], [1, 1]] },
  T: { color: '#a85be0', m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
  S: { color: '#5cc75c', m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
  Z: { color: '#e9504f', m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
  J: { color: '#3f7be0', m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
  L: { color: '#f08c33', m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
};
const B_TYPES = Object.keys(B_DEFS);

function rotateCW(m) {
  const n = m.length;
  const r = m.map((row) => row.slice());
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) r[x][n - 1 - y] = m[y][x];
  return r;
}

// B_SHAPES[type][rot] = [[x, y], ...]
const B_SHAPES = {};
for (const t of B_TYPES) {
  let m = B_DEFS[t].m;
  B_SHAPES[t] = [];
  for (let r = 0; r < 4; r++) {
    const cells = [];
    m.forEach((row, y) => row.forEach((v, x) => { if (v) cells.push([x, y]); }));
    B_SHAPES[t].push(cells);
    m = rotateCW(m);
  }
}

// Simple wall kicks (not full SRS, but forgiving)
const B_KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1], [-2, 0], [2, 0]];
const B_CLEAR_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD!'];

class BlockGame {
  constructor(opts) {
    this.kind = 'block';
    this.cfg = CONFIG.block;
    this.rng = opts.rng || Math.random;
    this.onAttack = opts.onAttack || (() => {});
    this.reset();
  }

  reset() {
    this.grid = Array.from({ length: B_ROWS }, () => Array(B_COLS).fill(null));
    this.queue = [];
    this.holdType = null;
    this.holdUsed = false;
    this.pending = 0;
    this.dead = false;
    this.lines = 0;
    this.sent = 0;
    this.combo = -1;
    this.b2b = false;
    this.elapsed = 0;
    this.level = 1;
    this.gravT = 0;
    this.lockT = 0;
    this.lockResets = 0;
    this.softDropping = false;
    this.rep = new Repeater(this.cfg.das, this.cfg.arr);
    this.pieceId = 0;
    this.msg = null;
    this.spawn();
  }

  refill() {
    while (this.queue.length < 7) {
      const bag = B_TYPES.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.queue.push(...bag);
    }
  }

  spawn(type) {
    this.refill();
    if (!type) type = this.queue.shift();
    this.refill();
    const size = B_DEFS[type].m.length;
    this.piece = { type, rot: 0, x: Math.floor((B_COLS - size) / 2), y: 1 };
    this.lockT = 0;
    this.lockResets = 0;
    this.gravT = 0;
    this.pieceId++;
    if (this.collides(this.piece)) this.dead = true;
  }

  cells(p) { return B_SHAPES[p.type][p.rot].map(([cx, cy]) => [p.x + cx, p.y + cy]); }

  collides(p) {
    for (const [x, y] of this.cells(p)) {
      if (x < 0 || x >= B_COLS || y >= B_ROWS) return true;
      if (y >= 0 && this.grid[y][x]) return true;
    }
    return false;
  }

  canControl() { return !this.dead && !!this.piece; }
  grounded() { return this.collides({ ...this.piece, y: this.piece.y + 1 }); }

  resetLock() {
    if (this.lockResets < this.cfg.maxLockResets) { this.lockT = 0; this.lockResets++; }
  }

  move(dx) {
    if (!this.canControl()) return false;
    const p = { ...this.piece, x: this.piece.x + dx };
    if (this.collides(p)) return false;
    this.piece = p;
    this.resetLock();
    return true;
  }

  rotate(dir) {
    if (!this.canControl() || this.piece.type === 'O') return false;
    const rot = (this.piece.rot + dir + 4) % 4;
    for (const [kx, ky] of B_KICKS) {
      const p = { ...this.piece, rot, x: this.piece.x + kx, y: this.piece.y + ky };
      if (!this.collides(p)) { this.piece = p; this.resetLock(); return true; }
    }
    return false;
  }

  fall() {
    const p = { ...this.piece, y: this.piece.y + 1 };
    if (this.collides(p)) return false;
    this.piece = p;
    return true;
  }

  hardDrop() {
    if (!this.canControl()) return;
    while (this.fall());
    this.lock();
  }

  hold() {
    if (!this.canControl() || this.holdUsed) return;
    const t = this.piece.type;
    if (this.holdType) { const h = this.holdType; this.holdType = t; this.spawn(h); }
    else { this.holdType = t; this.spawn(); }
    this.holdUsed = true;
  }

  receiveGarbage(lines) { this.pending += lines; }

  popup(text) { this.msg = { text, t: 1200 }; }

  lock() {
    const color = B_DEFS[this.piece.type].color;
    let allHidden = true;
    for (const [x, y] of this.cells(this.piece)) {
      if (y >= 0) this.grid[y][x] = color;
      if (y >= B_HIDDEN) allHidden = false;
    }
    this.piece = null;
    if (allHidden) { this.dead = true; return; }

    const full = [];
    for (let y = 0; y < B_ROWS; y++) if (this.grid[y].every((c) => c)) full.push(y);
    const n = full.length;

    if (n) {
      for (const y of full) { this.grid.splice(y, 1); this.grid.unshift(Array(B_COLS).fill(null)); }
      this.lines += n;
      this.combo++;
      const A = CONFIG.attack;
      let atk = A.blockLines[n];
      const quad = n === 4;
      if (quad && this.b2b) atk += A.backToBack;
      this.b2b = quad;
      atk += A.comboBonus[Math.min(this.combo, A.comboBonus.length - 1)];
      const allClear = this.grid.every((r) => r.every((c) => !c));
      if (allClear) atk += A.perfectClear;

      let text = B_CLEAR_NAMES[n];
      if (this.combo >= 2) text += ` ${this.combo} COMBO`;
      if (allClear) text = 'ALL CLEAR!';
      this.popup(text);

      // Attacks cancel incoming garbage first
      const cancel = Math.min(this.pending, atk);
      this.pending -= cancel;
      atk -= cancel;
      if (atk > 0) { this.sent += atk; this.onAttack(atk); }
    } else {
      this.combo = -1;
      this.applyGarbage();
    }

    this.holdUsed = false;
    if (!this.dead) this.spawn();
  }

  applyGarbage() {
    const n = Math.min(this.pending, this.cfg.maxGarbagePerLock);
    if (!n) return;
    this.pending -= n;
    const hole = Math.floor(Math.random() * B_COLS);
    for (let i = 0; i < n; i++) {
      const top = this.grid.shift();
      if (top.some((c) => c)) this.dead = true;
      const row = Array(B_COLS).fill(B_GARBAGE);
      row[hole] = null;
      this.grid.push(row);
    }
  }

  handleInput(c, dt) {
    if (!this.canControl()) return;
    if (c.pressed('hold')) this.hold();
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
    if (this.dead || !this.piece) return;
    this.elapsed += dt;
    this.level = 1 + Math.floor(this.elapsed / 1000 / this.cfg.gravityLevelSeconds);
    const interval = Math.max(this.cfg.minGravity,
      this.cfg.startGravity * Math.pow(this.cfg.gravityFactor, this.level - 1));
    const eff = this.softDropping ? Math.min(interval, this.cfg.softDropInterval) : interval;

    if (this.grounded()) {
      this.lockT += dt;
      if (this.lockT >= this.cfg.lockDelay) this.lock();
    } else {
      this.lockT = 0;
      this.gravT += dt;
      while (this.gravT >= eff) { this.gravT -= eff; if (!this.fall()) break; }
    }
  }

  statsText() { return `Lines ${this.lines}   ·   Sent ${this.sent}   ·   Lv ${this.level}`; }

  // ---------- drawing ----------
  draw(ctx, L) {
    const s = L.w / B_COLS;
    drawBoardBg(ctx, L, B_COLS, B_ROWS - B_HIDDEN);

    for (let y = B_HIDDEN; y < B_ROWS; y++) {
      for (let x = 0; x < B_COLS; x++) {
        const c = this.grid[y][x];
        if (c) drawCell(ctx, L.x + x * s, L.y + (y - B_HIDDEN) * s, s, c, this.dead ? 0.4 : 1);
      }
    }

    if (this.piece && !this.dead) {
      const color = B_DEFS[this.piece.type].color;
      const g = { ...this.piece };
      while (!this.collides({ ...g, y: g.y + 1 })) g.y++;
      for (const [x, y] of this.cells(g)) if (y >= B_HIDDEN) drawGhostCell(ctx, L.x + x * s, L.y + (y - B_HIDDEN) * s, s, color);
      for (const [x, y] of this.cells(this.piece)) if (y >= B_HIDDEN) drawCell(ctx, L.x + x * s, L.y + (y - B_HIDDEN) * s, s, color);
    }
    drawBoardFrame(ctx, L);

    // Hold
    drawPanel(ctx, L.holdX, L.y, 90, 80, 'HOLD');
    if (this.holdType) this.drawMini(ctx, this.holdType, L.holdX + 45, L.y + 47, 16, this.holdUsed);

    // Next (5)
    drawPanel(ctx, L.nextX, L.y, 80, 300, 'NEXT');
    for (let i = 0; i < 5; i++) this.drawMini(ctx, this.queue[i], L.nextX + 40, L.y + 52 + i * 54, i === 0 ? 16 : 13, false);

    drawMeter(ctx, L.meterX, L.y, L.h, this.pending / 20);
    drawPopup(ctx, L, this.msg);
  }

  drawMini(ctx, type, cx, cy, s, dim) {
    const cells = B_SHAPES[type][0];
    const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const ox = cx - ((maxX - minX + 1) * s) / 2 - minX * s;
    const oy = cy - ((maxY - minY + 1) * s) / 2 - minY * s;
    for (const [x, y] of cells) drawCell(ctx, ox + x * s, oy + y * s, s, dim ? '#4b5068' : B_DEFS[type].color);
  }
}
