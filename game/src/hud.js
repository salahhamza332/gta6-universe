// HUD: health, cash, wanted stars, mission objective, minimap, speedometer.
import { WORLD, ROAD } from './city.js';

let minimapCache = null;

export function drawHUD(ctx, state, city, viewW, viewH) {
  // top-left: health + cash
  ctx.fillStyle = 'rgba(10,10,16,0.62)';
  roundRect(ctx, 14, 14, 250, 84, 10); ctx.fill();
  ctx.fillStyle = '#e8e4da';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HEALTH', 26, 36);
  ctx.fillStyle = '#332';
  ctx.fillRect(26, 44, 200, 12);
  const hp = Math.max(0, state.player.health) / 100;
  ctx.fillStyle = hp > 0.5 ? '#5ad06a' : hp > 0.25 ? '#e5b355' : '#e74c3c';
  ctx.fillRect(26, 44, 200 * hp, 12);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`$${state.money.toLocaleString()}`, 26, 82);

  // top-right: wanted stars
  ctx.fillStyle = 'rgba(10,10,16,0.62)';
  roundRect(ctx, viewW - 214, 14, 200, 44, 10); ctx.fill();
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, viewW - 190 + i * 38, 36, 13, i < state.wanted ? '#ffd700' : 'rgba(255,255,255,0.18)');
  }

  // top-center: mission objective
  if (state.objective) {
    ctx.font = 'bold 14px system-ui, sans-serif';
    const w = Math.min(viewW - 560, ctx.measureText(state.objective).width + 44);
    ctx.fillStyle = 'rgba(10,10,16,0.62)';
    roundRect(ctx, viewW / 2 - w / 2, 14, w, 40, 10); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(state.objective, viewW / 2, 39, w - 20);
  }

  drawMinimap(ctx, state, city, viewW, viewH);

  // bottom-right: speed while driving
  if (state.inCar) {
    const kmh = Math.abs(Math.round(state.inCar.speed * 14));
    ctx.fillStyle = 'rgba(10,10,16,0.62)';
    roundRect(ctx, viewW - 150, viewH - 84, 136, 66, 10); ctx.fill();
    ctx.fillStyle = '#e8e4da';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(kmh), viewW - 82, viewH - 44);
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('KM/H', viewW - 82, viewH - 28);
  }

  // toast messages
  if (state.toast && state.toast.until > performance.now()) {
    const remaining = Math.min(1, (state.toast.until - performance.now()) / 400);
    ctx.globalAlpha = remaining;
    ctx.fillStyle = 'rgba(10,10,16,0.75)';
    ctx.font = 'bold 18px system-ui, sans-serif';
    const w = ctx.measureText(state.toast.text).width + 48;
    roundRect(ctx, viewW / 2 - w / 2, viewH - 150, w, 44, 10); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(state.toast.text, viewW / 2, viewH - 122);
    ctx.globalAlpha = 1;
  }
}

function drawMinimap(ctx, state, city, viewW, viewH) {
  const S = 172, pad = 16;
  const mx = pad, my = viewH - S - pad;
  if (!minimapCache) {
    minimapCache = document.createElement('canvas');
    minimapCache.width = S; minimapCache.height = S;
    const m = minimapCache.getContext('2d');
    m.fillStyle = '#d9b382'; m.fillRect(0, 0, S, S);
    const k = S / WORLD.width;
    m.fillStyle = '#5d8a4a';
    for (const p of city.parks) m.fillRect(p.x * k, p.y * k, p.w * k, p.h * k);
    m.fillStyle = '#3a3a44';
    for (const rx of city.vRoads) m.fillRect(rx * k, 0, ROAD * k, S);
    for (const ry of city.hRoads) m.fillRect(0, ry * k, S, ROAD * k);
    m.fillStyle = '#2e6f8e'; m.fillRect(0, S - 3, S, 3);
    m.fillStyle = '#a8563c';
    for (const b of city.buildings) m.fillRect(b.x * k, b.y * k, Math.max(2, b.w * k), Math.max(2, b.h * k));
  }
  const k = S / WORLD.width;
  ctx.save();
  ctx.beginPath(); roundRect(ctx, mx, my, S, S, 12); ctx.clip();
  ctx.drawImage(minimapCache, mx, my);
  // mission marker
  if (state.marker) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(mx + state.marker.x * k, my + state.marker.y * k, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7a5b00'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // police dots
  ctx.fillStyle = '#4aa3ff';
  for (const p of state.policeCars) { ctx.beginPath(); ctx.arc(mx + p.x * k, my + p.y * k, 3, 0, Math.PI * 2); ctx.fill(); }
  // player dot
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(mx + state.player.x * k, my + state.player.y * k, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  roundRect(ctx, mx, my, S, S, 12); ctx.stroke();
  ctx.fillStyle = '#e8e4da'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('SUNFALL CITY', mx + 8, my + 14);
}

function drawStar(ctx, cx, cy, r, fill) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
