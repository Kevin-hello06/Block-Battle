// Keyboard handling, per-player controllers, auto-repeat and seeded RNG.

const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
for (const map of Object.values(CONFIG.controls)) {
  for (const codes of Object.values(map)) codes.forEach((c) => GAME_KEYS.add(c));
}

class Keyboard {
  constructor() {
    this.held = new Set();
    this.hit = new Set();      // pressed since last frame
    this.capture = false;      // block browser scrolling etc. while playing
    window.addEventListener('keydown', (e) => {
      if (this.capture && GAME_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.held.add(e.code);
      this.hit.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
  }
  endFrame() { this.hit.clear(); }
}

class Controller {
  constructor(kb, map) { this.kb = kb; this.map = map; }
  down(action) { return (this.map[action] || []).some((k) => this.kb.held.has(k)); }
  pressed(action) { return (this.map[action] || []).some((k) => this.kb.hit.has(k)); }
}

// Delayed auto shift: move once on press, then repeat after `das` every `arr`.
class Repeater {
  constructor(das, arr) { this.das = das; this.arr = Math.max(1, arr); this.dir = 0; this.t = 0; this.charged = false; }
  update(dir, dt) {
    if (dir !== this.dir) { this.dir = dir; this.t = 0; this.charged = false; return dir; }
    if (dir === 0) return 0;
    this.t += dt;
    let steps = 0;
    if (!this.charged) {
      if (this.t < this.das) return 0;
      this.charged = true; this.t -= this.das; steps++;
    }
    while (this.t >= this.arr) { this.t -= this.arr; steps++; }
    return dir * steps;
  }
}

// Small seeded RNG so both players can get the same piece sequence.
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
