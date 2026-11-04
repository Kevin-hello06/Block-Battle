// Menu, match setup, game loop and screen layout.

const W = 1000, H = 640;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const kb = new Keyboard();
const menu = document.getElementById('menu');
const form = document.getElementById('setup');

let match = null;
let lastOpts = null;

function layoutFor(index, count) {
  const bw = 260, bh = 520, top = 90;
  if (count === 1) {
    const x = (W - bw) / 2;
    return { x, y: top, w: bw, h: bh, holdX: x - 112, meterX: x + bw + 6, nextX: x + bw + 22 };
  }
  if (index === 0) {
    const x = 130;
    return { x, y: top, w: bw, h: bh, holdX: 30, meterX: x + bw + 6, nextX: x + bw + 22 };
  }
  const x = W - 130 - bw;
  return { x, y: top, w: bw, h: bh, holdX: x + bw + 10, meterX: x - 16, nextX: x - 102 };
}

function startMatch(opts) {
  lastOpts = opts;
  const seed = (Math.random() * 4294967296) >>> 0;   // same seed => same piece order for both
  const specs = [];
  [opts.p1, opts.p2].forEach((s, slot) => { if (s.control !== 'off') specs.push({ ...s, slot }); });
  const humans = specs.filter((s) => s.control === 'human').length;

  const players = specs.map((s, i) => {
    const Game = s.mode === 'puyo' ? PuyoGame : BlockGame;
    const game = new Game({ rng: mulberry32(seed) });
    const map = humans === 1 ? CONFIG.controls.solo : (s.slot === 0 ? CONFIG.controls.p1 : CONFIG.controls.p2);
    return {
      name: `P${s.slot + 1}`,
      spec: s,
      game,
      ctrl: s.control === 'human' ? new Controller(kb, map) : null,
      cpu: s.control === 'cpu' ? new CpuPlayer(game, opts.difficulty) : null,
      layout: layoutFor(i, specs.length),
    };
  });

  if (players.length === 2) {
    players[0].game.onAttack = (n) => players[1].game.receiveGarbage(n);
    players[1].game.onAttack = (n) => players[0].game.receiveGarbage(n);
  }

  match = { players, countdown: 1800, paused: false, over: false, result: '' };
  menu.classList.add('hidden');
  kb.capture = true;
}

function toMenu() {
  match = null;
  kb.capture = false;
  menu.classList.remove('hidden');
  form.querySelector('button').focus();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(form);
  startMatch({
    p1: { mode: f.get('p1mode'), control: f.get('p1control') },
    p2: { mode: f.get('p2mode'), control: f.get('p2control') },
    difficulty: f.get('difficulty'),
  });
});

function checkOver() {
  const ps = match.players;
  if (ps.length === 1) {
    if (ps[0].game.dead) { match.over = true; match.result = 'GAME OVER'; }
    return;
  }
  const d0 = ps[0].game.dead, d1 = ps[1].game.dead;
  if (d0 || d1) {
    match.over = true;
    match.result = d0 && d1 ? 'DRAW' : `${d0 ? ps[1].name : ps[0].name} WINS!`;
  }
}

function handleGlobalKeys() {
  if (kb.hit.has('Escape')) { toMenu(); return; }
  if (kb.hit.has('KeyP') && !match.over) match.paused = !match.paused;
  if (kb.hit.has('Enter') && match.over) startMatch(lastOpts);
}

// ---------- drawing ----------
function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1b1f3b');
  g.addColorStop(1, '#0a0d1a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = UI.text;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BLOB & BLOCK BATTLE', W / 2, 42);
}

function drawOverlay(title, sub) {
  ctx.fillStyle = 'rgba(5,8,18,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText(title, W / 2, H / 2);
  if (sub) {
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = UI.dim;
    ctx.fillText(sub, W / 2, H / 2 + 40);
  }
}

function draw() {
  drawBackground();
  if (!match) return;
  for (const p of match.players) {
    const L = p.layout;
    p.game.draw(ctx, L);
    ctx.textAlign = 'center';
    ctx.fillStyle = UI.text;
    ctx.font = 'bold 16px system-ui, sans-serif';
    const who = p.spec.control === 'cpu' ? 'CPU' : 'Human';
    const mode = p.spec.mode === 'puyo' ? 'Blobs' : 'Blocks';
    ctx.fillText(`${p.name} · ${who} · ${mode}`, L.x + L.w / 2, L.y - 14);
    ctx.fillStyle = UI.dim;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(p.game.statsText(), L.x + L.w / 2, L.y + L.h + 22);
  }
  if (match.countdown > 0) {
    drawOverlay(match.countdown > 600 ? 'READY' : 'GO!');
  } else if (match.over) {
    drawOverlay(match.result, 'Enter: rematch   ·   Esc: menu');
  } else if (match.paused) {
    drawOverlay('PAUSED', 'P: resume   ·   Esc: menu');
  }
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(50, now - last);
  last = now;
  if (match) {
    handleGlobalKeys();
    if (match && !match.paused && !match.over) {
      if (match.countdown > 0) {
        match.countdown -= dt;
      } else {
        for (const p of match.players) {
          if (p.ctrl) p.game.handleInput(p.ctrl, dt);
          if (p.cpu) p.cpu.update(dt);
          p.game.update(dt);
        }
        checkOver();
      }
    }
  }
  draw();
  kb.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
