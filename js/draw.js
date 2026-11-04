// Shared canvas drawing helpers.

const UI = {
  boardBg: '#0d1222',
  panelBg: '#151b30',
  grid: 'rgba(255,255,255,0.04)',
  border: '#2c3557',
  text: '#e6e9f5',
  dim: '#8a93b8',
  danger: '#ff4d6d',
};

function drawCell(ctx, x, y, s, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(x + 1, y + 1, s - 2, Math.max(2, s * 0.12));
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 1, y + s - 1 - Math.max(2, s * 0.12), s - 2, Math.max(2, s * 0.12));
  ctx.globalAlpha = 1;
}

function drawGhostCell(ctx, x, y, s, color) {
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y + 2, s - 4, s - 4);
  ctx.globalAlpha = 1;
}

function drawBlob(ctx, cx, cy, r, color, nuisance = false, flash = false) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = flash ? '#ffffff' : color;
  ctx.fill();
  if (nuisance) {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (!flash) {
    // little eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx - r * 0.32, cy - r * 0.08, r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.32, cy - r * 0.08, r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.02, r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.34, cy - r * 0.02, r * 0.1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.arc(cx - r * 0.4, cy - r * 0.45, r * 0.18, 0, Math.PI * 2); ctx.fill();
}

function drawPanel(ctx, x, y, w, h, title) {
  ctx.fillStyle = UI.panelBg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = UI.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = UI.dim;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, x + w / 2, y + 16);
}

function drawBoardBg(ctx, L, cols, rows) {
  ctx.fillStyle = UI.boardBg;
  ctx.fillRect(L.x, L.y, L.w, L.h);
  const cw = L.w / cols, ch = L.h / rows;
  ctx.strokeStyle = UI.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < cols; i++) { ctx.moveTo(L.x + i * cw, L.y); ctx.lineTo(L.x + i * cw, L.y + L.h); }
  for (let j = 1; j < rows; j++) { ctx.moveTo(L.x, L.y + j * ch); ctx.lineTo(L.x + L.w, L.y + j * ch); }
  ctx.stroke();
}

function drawBoardFrame(ctx, L) {
  ctx.strokeStyle = UI.border;
  ctx.lineWidth = 3;
  ctx.strokeRect(L.x - 1.5, L.y - 1.5, L.w + 3, L.h + 3);
}

// Incoming garbage meter. frac 0..1
function drawMeter(ctx, x, y, h, frac) {
  ctx.fillStyle = UI.panelBg;
  ctx.fillRect(x, y, 10, h);
  const f = Math.min(1, frac);
  if (f > 0) {
    ctx.fillStyle = f > 0.5 ? UI.danger : '#ffb020';
    ctx.fillRect(x, y + h * (1 - f), 10, h * f);
  }
}

function drawPopup(ctx, L, msg) {
  if (!msg || msg.t <= 0) return;
  ctx.globalAlpha = Math.min(1, msg.t / 300);
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#000';
  ctx.strokeText(msg.text, L.x + L.w / 2, L.y + L.h * 0.35);
  ctx.fillStyle = '#fff';
  ctx.fillText(msg.text, L.x + L.w / 2, L.y + L.h * 0.35);
  ctx.globalAlpha = 1;
}
