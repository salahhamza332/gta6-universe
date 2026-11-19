// Sunfall City: deterministic open-world layout. A sun-baked coastal grid of terracotta
// blocks, palm parks and a central plaza, ringed by docks to the south.
import { mulberry32, pick } from './rng.js';

export const WORLD = { width: 3600, height: 3600 };
export const ROAD = 96;
const MARGIN = 150, BLOCK = 250, CELL = BLOCK + ROAD, COLS = 9, ROWS = 9;

export const PALETTE = {
  road: '#3a3a44', roadLine: '#c9c96a', sidewalk: '#8f8a7d',
  sand: '#d9b382', grass: '#5d8a4a', water: '#2e6f8e',
  buildings: ['#c96f4a', '#d98e5f', '#e0c090', '#b8543e', '#e8d8b0', '#a8563c', '#d4a05a'],
};

// Named places the story uses. Filled in by buildCity().
export const PLACES = {};

export function buildCity(seed = 20261117) {
  const rng = mulberry32(seed);
  const vRoads = [], hRoads = [];
  for (let i = 0; i <= COLS; i++) vRoads.push(MARGIN + i * CELL - ROAD / 2);
  for (let i = 0; i <= ROWS; i++) hRoads.push(MARGIN + i * CELL - ROAD / 2);

  const buildings = [], parks = [];
  const parkBlocks = new Set();
  while (parkBlocks.size < 9) parkBlocks.add(Math.floor(rng() * COLS * ROWS));
  const plazaBlock = Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2);
  parkBlocks.delete(plazaBlock);

  for (let br = 0; br < ROWS; br++) {
    for (let bc = 0; bc < COLS; bc++) {
      const x = MARGIN + bc * CELL, y = MARGIN + br * CELL;
      const idx = br * COLS + bc;
      if (idx === plazaBlock) { PLACES.plaza = { x: x + BLOCK / 2, y: y + BLOCK / 2 }; continue; }
      if (parkBlocks.has(idx)) { parks.push({ x, y, w: BLOCK, h: BLOCK }); continue; }
      const n = 1 + Math.floor(rng() * 3);
      if (n === 1) {
        buildings.push(makeBuilding(rng, x + 18, y + 18, BLOCK - 36, BLOCK - 36));
      } else {
        // split the block into a 2x2 of lots, keep some empty
        const half = BLOCK / 2;
        for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
          if (rng() < 0.22) continue;
          const pad = 14 + rng() * 10;
          buildings.push(makeBuilding(rng, x + sx * half + pad, y + sy * half + pad, half - pad * 2, half - pad * 2));
        }
      }
    }
  }

  // Landmark blocks replace whatever buildings landed there.
  const landmark = (name, bc, br, w, h, color) => {
    const x = MARGIN + bc * CELL, y = MARGIN + br * CELL;
    for (let i = buildings.length - 1; i >= 0; i--) {
      const b = buildings[i];
      if (b.x < x + BLOCK && b.x + b.w > x && b.y < y + BLOCK && b.y + b.h > y) buildings.splice(i, 1);
    }
    buildings.push({ x: x + (BLOCK - w) / 2, y: y + (BLOCK - h) / 2, w, h, color, landmark: name, shade: 0.85 });
    PLACES[name] = { x: x + BLOCK / 2, y: y + BLOCK / 2 };
  };
  landmark('diner', 2, 2, 150, 110, '#e5b355');      // Mama Rosa's diner, mission hub
  landmark('hospital', 6, 1, 170, 130, '#e8e4da');   // St. Aurelia hospital, respawn point
  landmark('stash', 1, 1, 140, 140, '#7a5b3a');      // the stash garage, northwest
  landmark('alley', 5, 5, 120, 120, '#4d4d5c');      // gang alley, midtown
  landmark('dealership', 7, 6, 160, 120, '#3f6f9e'); // marina dealership, east

  // Docks: an open pier strip along the south edge.
  PLACES.docks = { x: WORLD.width / 2, y: WORLD.height - 90 };

  return { vRoads, hRoads, buildings, parks, plaza: PLACES.plaza };
}

function makeBuilding(rng, x, y, w, h) {
  return {
    x, y, w, h,
    color: pick(rng, PALETTE.buildings),
    shade: 0.7 + rng() * 0.5,
    windows: Math.floor(rng() * 1e9),
  };
}

export function isRoad(city, x, y) {
  for (const rx of city.vRoads) if (x >= rx && x <= rx + ROAD) return true;
  for (const ry of city.hRoads) if (y >= ry && y <= ry + ROAD) return true;
  return false;
}

export function collidesBuilding(city, x, y, radius) {
  for (const b of city.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return b;
  }
  return null;
}

export function randomRoadPoint(city, rng) {
  if (rng() < 0.5) {
    const rx = city.vRoads[Math.floor(rng() * city.vRoads.length)];
    return { x: rx + ROAD / 2, y: rng() * WORLD.height };
  }
  const ry = city.hRoads[Math.floor(rng() * city.hRoads.length)];
  return { x: rng() * WORLD.width, y: ry + ROAD / 2 };
}

export function drawCity(ctx, city, cam, viewW, viewH) {
  const x0 = cam.x - viewW / 2, y0 = cam.y - viewH / 2;
  // sand base
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.save();
  ctx.translate(-x0, -y0);

  // grass parks
  for (const p of city.parks) {
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 6; i++) {
      const px = p.x + 20 + (i * 53) % (p.w - 40), py = p.y + 20 + (i * 97) % (p.h - 40);
      ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
    }
  }
  // plaza
  ctx.fillStyle = '#b9b2a4';
  ctx.fillRect(city.plaza.x - 125, city.plaza.y - 125, 250, 250);
  ctx.fillStyle = '#8d8578';
  ctx.beginPath(); ctx.arc(city.plaza.x, city.plaza.y, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c9c96a';
  ctx.beginPath(); ctx.arc(city.plaza.x, city.plaza.y, 30, 0, Math.PI * 2); ctx.fill();

  // roads
  ctx.fillStyle = PALETTE.road;
  for (const rx of city.vRoads) ctx.fillRect(rx, 0, ROAD, WORLD.height);
  for (const ry of city.hRoads) ctx.fillRect(0, ry, WORLD.width, ROAD);
  // lane markings
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 4;
  ctx.setLineDash([26, 22]);
  for (const rx of city.vRoads) { ctx.beginPath(); ctx.moveTo(rx + ROAD / 2, 0); ctx.lineTo(rx + ROAD / 2, WORLD.height); ctx.stroke(); }
  for (const ry of city.hRoads) { ctx.beginPath(); ctx.moveTo(0, ry + ROAD / 2); ctx.lineTo(WORLD.width, ry + ROAD / 2); ctx.stroke(); }
  ctx.setLineDash([]);

  // water strip (docks) along the south edge
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, WORLD.height - 40, WORLD.width, 40);

  // buildings with a sun-side highlight and roof details
  for (const b of city.buildings) {
    ctx.fillStyle = shadeColor(b.color, 0.55 * b.shade);
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h); // drop shadow
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // roof clutter
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    const rr = mulberry32(b.windows || 1);
    for (let i = 0; i < 3; i++) {
      const rw = 12 + rr() * (b.w * 0.28), rh = 10 + rr() * (b.h * 0.28);
      ctx.fillRect(b.x + rr() * (b.w - rw), b.y + rr() * (b.h - rh), rw, rh);
    }
    if (b.landmark) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(landmarkLabel(b.landmark), b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
  }
  ctx.restore();
}

function landmarkLabel(name) {
  switch (name) {
    case 'diner': return "MAMA ROSA'S";
    case 'hospital': return 'ST. AURELIA';
    case 'stash': return 'THE STASH';
    case 'alley': return 'GANG ALLEY';
    case 'dealership': return 'MARINA MOTORS';
    default: return name.toUpperCase();
  }
}

export function shadeColor(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.floor(((n >> 16) & 255) * factor + 30));
  const g = Math.min(255, Math.floor(((n >> 8) & 255) * factor + 30));
  const b = Math.min(255, Math.floor((n & 255) * factor + 30));
  return `rgb(${r},${g},${b})`;
}
