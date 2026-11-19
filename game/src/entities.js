// Entities: the player, vehicles (parked / traffic / stolen / police), and pedestrians.
import { WORLD, ROAD, collidesBuilding, isRoad } from './city.js';

export const CAR_TYPES = {
  sedan:   { w: 26, h: 48, maxSpeed: 9.5, accel: 0.28, color: ['#3f6f9e', '#7a3b3b', '#4a4a52', '#2e5e3a'] },
  sports:  { w: 24, h: 44, maxSpeed: 12.5, accel: 0.4, color: ['#c9a227', '#b03a2e', '#8e44ad'] },
  truck:   { w: 30, h: 56, maxSpeed: 7.5, accel: 0.2, color: ['#5d6d7e', '#6e2c00'] },
  armored: { w: 32, h: 54, maxSpeed: 6.5, accel: 0.16, color: ['#37474f'] },
  police:  { w: 27, h: 50, maxSpeed: 11.5, accel: 0.34, color: ['#1c2a4a'] },
};

export function makeCar(type, x, y, angle, rng, parked = false) {
  const t = CAR_TYPES[type];
  return {
    kind: 'car', type, x, y, angle, speed: 0,
    w: t.w, h: t.h, maxSpeed: t.maxSpeed, accel: t.accel,
    color: t.color[Math.floor((rng ? rng() : Math.random()) * t.color.length)],
    parked, health: 100, id: Math.random().toString(36).slice(2),
    aiAxis: null, aiDir: 1, turnCooldown: 0,
  };
}

export function makePed(x, y, rng, role = 'civilian') {
  return {
    kind: 'ped', role, x, y, angle: rng() * Math.PI * 2,
    speed: 1.5 + rng() * 0.6, health: role === 'thug' || role === 'boss' ? 60 : 30,
    targetX: x, targetY: y, retarget: 0, state: 'walk', shootCooldown: 0, color: pedColor(rng),
  };
}

function pedColor(rng) {
  const tones = ['#e0ac69', '#8d5524', '#f1c27d', '#c68642', '#ffdbac'];
  return { skin: tones[Math.floor(rng() * tones.length)], shirt: `hsl(${Math.floor(rng() * 360)},45%,55%)` };
}

export function updateCarPhysics(car, input, dt) {
  // input: {throttle:-1..1, steer:-1..1, handbrake:bool}
  const grip = car.kind === 'car' ? 0.86 : 0.9;
  car.speed += input.throttle * car.accel * dt * 60;
  car.speed *= (1 - 0.012 * dt * 60 * (input.throttle === 0 ? 2.2 : 1));
  car.speed = Math.max(-car.maxSpeed * 0.4, Math.min(car.maxSpeed, car.speed));
  const steerPower = 0.042 * Math.min(1, Math.abs(car.speed) / 4) * (car.speed < 0 ? -1 : 1);
  car.angle += input.steer * steerPower * dt * 60 * (input.handbrake ? 1.9 : 1);
  if (input.handbrake) car.speed *= 0.985;
  car.x += Math.sin(car.angle) * car.speed * dt * 60;
  car.y -= Math.cos(car.angle) * car.speed * dt * 60;
}

export function carCircleHit(city, car) {
  // crude but solid: sample nose, center, tail against building AABBs
  const pts = [[0, car.h / 2], [0, 0], [0, -car.h / 2]];
  for (const [lx, ly] of pts) {
    const wx = car.x + Math.sin(car.angle) * ly + Math.cos(car.angle) * lx;
    const wy = car.y - Math.cos(car.angle) * ly + Math.sin(car.angle) * lx;
    if (collidesBuilding(city, wx, wy, Math.max(car.w, car.h) / 3.4)) return true;
  }
  return false;
}

export function updateTrafficCar(car, city, rng, dt) {
  // Cruise along roads; pick a new direction at intersections.
  car.turnCooldown = Math.max(0, car.turnCooldown - dt);
  if (car.speed < 2.5) car.speed = 2.5;
  car.speed = Math.min(car.speed + 0.05 * dt * 60, 4.6);
  // steer toward nearest road center on current heading
  const nearV = nearestRoad(city.vRoads, car.x), nearH = nearestRoad(city.hRoads, car.y);
  const vertical = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
  if (vertical) {
    const cx = nearV + ROAD / 2;
    car.x += (cx - car.x) * 0.06 * dt * 60;
    if (car.turnCooldown === 0 && nearIntersection(city, car, ROAD)) {
      maybeTurn(car, rng, ['up', 'down', 'left', 'right']);
    }
  } else {
    const cy = nearH + ROAD / 2;
    car.y += (cy - car.y) * 0.06 * dt * 60;
    if (car.turnCooldown === 0 && nearIntersection(city, car, ROAD)) {
      maybeTurn(car, rng, ['left', 'right', 'up', 'down']);
    }
  }
  car.x += Math.sin(car.angle) * car.speed * dt * 60;
  car.y -= Math.cos(car.angle) * car.speed * dt * 60;
  car.x = Math.max(20, Math.min(WORLD.width - 20, car.x));
  car.y = Math.max(20, Math.min(WORLD.height - 20, car.y));
}

function nearestRoad(roads, v) {
  let best = roads[0], bd = Infinity;
  for (const r of roads) { const d = Math.abs(r + ROAD / 2 - v); if (d < bd) { bd = d; best = r; } }
  return best;
}

function nearIntersection(city, car, tol) {
  const nv = nearestRoad(city.vRoads, car.x) + ROAD / 2;
  const nh = nearestRoad(city.hRoads, car.y) + ROAD / 2;
  return Math.abs(car.x - nv) < tol * 0.6 && Math.abs(car.y - nh) < tol * 0.6;
}

function maybeTurn(car, rng, options) {
  const choice = options[Math.floor(rng() * options.length)];
  const map = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
  car.angle = map[choice];
  car.turnCooldown = 2.5;
}

export function updatePed(ped, city, rng, dt, fleeFrom) {
  ped.retarget -= dt;
  ped.shootCooldown = Math.max(0, ped.shootCooldown - dt);
  const fleeing = fleeFrom && dist(ped, fleeFrom) < 260;
  if (fleeing) {
    ped.state = 'flee';
    ped.angle = Math.atan2(ped.x - fleeFrom.x, -(ped.y - fleeFrom.y));
  } else if (ped.state === 'flee') {
    ped.state = 'walk'; ped.retarget = 0;
  }
  if (ped.retarget <= 0 || dist(ped, { x: ped.targetX, y: ped.targetY }) < 24) {
    for (let tries = 0; tries < 8; tries++) {
      const a = rng() * Math.PI * 2, d = 80 + rng() * 220;
      const tx = ped.x + Math.sin(a) * d, ty = ped.y + Math.cos(a) * d;
      if (tx > 30 && ty > 30 && tx < WORLD.width - 30 && ty < WORLD.height - 30 && !collidesBuilding(city, tx, ty, 12)) {
        ped.targetX = tx; ped.targetY = ty; break;
      }
    }
    ped.retarget = 3 + rng() * 4;
  }
  const targetAngle = Math.atan2(ped.targetX - ped.x, -(ped.targetY - ped.y));
  if (!fleeing) ped.angle = lerpAngle(ped.angle, targetAngle, 0.08 * dt * 60);
  const sp = ped.speed * (fleeing ? 1.9 : 1);
  const nx = ped.x + Math.sin(ped.angle) * sp * dt * 60;
  const ny = ped.y - Math.cos(ped.angle) * sp * dt * 60;
  if (!collidesBuilding(city, nx, ny, 10)) { ped.x = nx; ped.y = ny; }
  else { ped.angle += Math.PI / 2; ped.retarget = 0; }
}

export function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function drawCar(ctx, car, isPlayerCar) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  // roof + windshield
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(-car.w / 2 + 4, -car.h / 2 + 9, car.w - 8, 9);
  ctx.fillStyle = shade(car.color, 0.75);
  ctx.fillRect(-car.w / 2 + 4, -4, car.w - 8, 15);
  if (car.type === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-car.w / 2, -6, car.w, 12);
    ctx.fillStyle = Math.floor(performance.now() / 240) % 2 ? '#e74c3c' : '#3498db';
    ctx.fillRect(-6, -10, 12, 5);
  }
  // headlights
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(-car.w / 2 + 2, car.h / 2 - 3, 6, 3);
  ctx.fillRect(car.w / 2 - 8, car.h / 2 - 3, 6, 3);
  if (isPlayerCar) {
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3;
    ctx.strokeRect(-car.w / 2 - 3, -car.h / 2 - 3, car.w + 6, car.h + 6);
  }
  ctx.restore();
}

export function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(ped.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 8, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.color.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.color.skin;
  ctx.beginPath(); ctx.arc(0, -3, 5, 0, Math.PI * 2); ctx.fill();
  if (ped.role === 'thug' || ped.role === 'boss') {
    ctx.fillStyle = ped.role === 'boss' ? '#8e44ad' : '#2c2c34';
    ctx.fillRect(-5, -11, 10, 4); // bandana / mohawk
  }
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

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.floor(((n >> 16) & 255) * f), g = Math.floor(((n >> 8) & 255) * f), b = Math.floor((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

export function isOnRoadOrSidewalk(city, x, y) { return isRoad(city, x, y); }
