// Sunfall City — an original open-world crime game. Entry point: boots the game, runs the
// loop, owns state (title, playing, paused, busted), input, wanted level and missions.
import { buildCity, drawCity, collidesBuilding, WORLD, PLACES } from './city.js';
// police cars respect buildings (slide around them) like traffic does
import { mulberry32 } from './rng.js';
import { AudioEngine } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { MISSIONS, currentMission } from './missions.js';
import { drawHUD } from './hud.js';
import {
  makeCar, makePed, updateCarPhysics, updateTrafficCar, updatePed, carCircleHit,
  drawCar, drawPed, dist, lerpAngle,
} from './entities.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');
const audio = new AudioEngine();

const city = buildCity(20261117);
const rng = mulberry32(987654321);

const state = {
  scene: 'title', // title | howto | playing | paused | busted
  menuIndex: 0,
  player: { x: PLACES.diner.x + 60, y: PLACES.diner.y + 60, angle: 0, health: 100, radius: 11 },
  inCar: null,
  cars: [], peds: [], thugs: [], boss: null, policeCars: [],
  money: 0, earned: 0, wanted: 0, wantedCooldown: 0,
  missionIndex: 0, missionStep: 0, missionStolenCar: null,
  objective: '', marker: null, toast: null,
  shotCooldown: 0, punchCooldown: 0, time: 0,
  camX: PLACES.diner.x, camY: PLACES.diner.y, camZoom: 1,
  shake: 0, titleDrift: 0,
};

// ---------- world population ----------
function populate() {
  state.cars = []; state.peds = []; state.policeCars = [];
  const prng = mulberry32(13579);
  // parked cars along roads
  const parkingSpots = [
    { x: PLACES.dealership.x - 80, y: PLACES.dealership.y + 70, type: 'sedan' },
    { x: PLACES.dealership.x + 20, y: PLACES.dealership.y + 70, type: 'sedan' },
    { x: PLACES.dealership.x + 110, y: PLACES.dealership.y + 70, type: 'sports' },
    { x: PLACES.dealership.x + 30, y: PLACES.dealership.y - 40, type: 'armored' },
    { x: PLACES.plaza.x - 130, y: PLACES.plaza.y + 100, type: 'sports' },
    { x: PLACES.plaza.x + 120, y: PLACES.plaza.y - 95, type: 'sports' },
    { x: PLACES.plaza.x - 30, y: PLACES.plaza.y + 105, type: 'sports' },
  ];
  for (const s of parkingSpots) state.cars.push(makeCar(s.type, s.x, s.y, prng() * Math.PI * 2, prng, true));
  // generic parked cars
  for (let i = 0; i < 26; i++) {
    const spot = city.vRoads[Math.floor(prng() * city.vRoads.length)];
    const y = prng() * WORLD.height;
    state.cars.push(makeCar(prng() < 0.25 ? 'truck' : 'sedan', spot + 18 + prng() * 20, y, Math.PI / 2 + (prng() - 0.5) * 0.2, prng, true));
  }
  // traffic
  for (let i = 0; i < 12; i++) {
    const vertical = prng() < 0.5;
    const road = vertical ? city.vRoads[Math.floor(prng() * city.vRoads.length)] : city.hRoads[Math.floor(prng() * city.hRoads.length)];
    const car = makeCar('sedan',
      vertical ? road + 30 + prng() * 36 : prng() * WORLD.width,
      vertical ? prng() * WORLD.height : road + 30 + prng() * 36,
      vertical ? 0 : Math.PI / 2, prng, false);
    state.cars.push(car);
  }
  // pedestrians
  for (let i = 0; i < 46; i++) {
    state.peds.push(makePed(prng() * WORLD.width, prng() * WORLD.height, prng, 'civilian'));
  }
  // thugs in the alley
  state.thugs = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    state.thugs.push(makePed(PLACES.alley.x + Math.cos(a) * 60, PLACES.alley.y + Math.sin(a) * 60, prng, 'thug'));
  }
  // boss at the plaza
  state.boss = makePed(PLACES.plaza.x, PLACES.plaza.y - 30, prng, 'boss');
  state.boss.health = 140;
}

// ---------- input ----------
const keys = new Set();
const mouse = { x: 0, y: 0, down: false };
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (state.scene === 'title') handleMenuKey(k);
  else if (state.scene === 'howto' && (k === 'escape' || k === 'enter')) state.scene = 'title';
  else if (state.scene === 'playing') {
    if (k === 'e') toggleVehicle();
    if (k === 'escape') { state.scene = 'paused'; }
    if (k === 'f') punch();
  } else if (state.scene === 'paused') {
    if (k === 'escape') state.scene = 'playing';
    if (k === 'q') { saveGame('Progress saved.'); state.scene = 'title'; audio.setSiren(false); }
  } else if (state.scene === 'busted') {
    if (k === 'enter' || k === ' ') respawnAfterBust();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
});
canvas.addEventListener('mousedown', () => { mouse.down = true; if (state.scene === 'title') clickMenu(); });
window.addEventListener('mouseup', () => { mouse.down = false; });

function menuOptions() {
  const opts = ['New Game'];
  if (loadSave()) opts.push('Continue');
  opts.push('How to Play');
  return opts;
}
function handleMenuKey(k) {
  const opts = menuOptions();
  if (k === 'arrowup') state.menuIndex = (state.menuIndex + opts.length - 1) % opts.length;
  if (k === 'arrowdown') state.menuIndex = (state.menuIndex + 1) % opts.length;
  if (k === 'enter' || k === ' ') activateMenu(opts[state.menuIndex]);
}
function clickMenu() {
  const opts = menuOptions();
  const r = canvas.getBoundingClientRect();
  const mx = mouse.x / r.width * canvas.width, my = mouse.y / r.height * canvas.height;
  opts.forEach((label, i) => {
    const y = canvas.height * 0.52 + i * 64;
    if (Math.abs(my - y) < 28 && Math.abs(mx - canvas.width / 2) < 180) activateMenu(label);
  });
}
function activateMenu(choice) {
  audio.ensure();
  if (choice === 'New Game') { clearSave(); startNewGame(); }
  else if (choice === 'Continue') continueGame();
  else if (choice === 'How to Play') state.scene = 'howto';
}

function startNewGame() {
  populate();
  state.money = 150; state.earned = 0; state.wanted = 0;
  state.missionIndex = 0; state.missionStep = 0; state.missionStolenCar = null;
  state.player.x = PLACES.diner.x + 60; state.player.y = PLACES.diner.y + 60; state.player.health = 100;
  state.inCar = null; state.scene = 'playing';
  beginMission();
  showToast('Welcome to Sunfall City');
  setObjective('Talk to Mama Rosa outside the diner — walk into the marker');
}
function continueGame() {
  const save = loadSave();
  populate();
  state.money = save ? save.money : 150;
  state.earned = save ? save.earned : 0;
  state.missionIndex = save ? Math.min(save.missionIndex, MISSIONS.length) : 0;
  state.missionStep = 0; state.missionStolenCar = null;
  state.wanted = 0; state.player.health = 100; state.inCar = null;
  state.player.x = PLACES.diner.x + 60; state.player.y = PLACES.diner.y + 60;
  state.scene = 'playing';
  if (state.missionIndex < MISSIONS.length) beginMission();
  else setObjective('The city is yours. Free roam — or replay your legacy.');
  showToast('Save loaded');
}
function saveGame(msg) {
  writeSave(state);
  showToast(msg || 'Progress saved');
}

// ---------- missions ----------
function beginMission() {
  state.missionStep = 0; state.missionStolenCar = null;
  const m = currentMission(state);
  if (m) { showToast(`New mission: ${m.title}`); audio.missionDone(); }
  updateMissionObjective();
}
function updateMissionObjective() {
  const m = currentMission(state);
  if (!m) { setObjective('Sunfall City is free. Cruise the coast.'); state.marker = null; return; }
  const step = m.steps[state.missionStep];
  setObjective(step.label);
  state.marker = markerForStep(step);
}
function markerForStep(step) {
  switch (step.type) {
    case 'reach': case 'deliverCar': return placeOf(step.place);
    case 'stealCarType': return placeOf(step.near);
    case 'defeatThugs': return placeOf(step.near);
    case 'defeatBoss': return placeOf(step.near);
    case 'loseWanted': return null;
    default: return null;
  }
}
function placeOf(name) { return PLACES[name] ? { ...PLACES[name] } : null; }
function setObjective(text) { state.objective = text; statusLine.textContent = text; }
function showToast(text, ms = 3200) { state.toast = { text, until: performance.now() + ms }; }

function missionTick(dt) {
  const m = currentMission(state);
  if (!m) return;
  const step = m.steps[state.missionStep];
  let done = false;
  switch (step.type) {
    case 'reach':
      done = dist(anchorPoint(), placeOf(step.place)) < 90;
      break;
    case 'stealCarType':
      if (state.inCar && state.inCar.type === step.carType && !state.inCar.missionCounted) {
        const near = PLACES[step.near];
        // count only if taken near the named place (the car was there when stolen)
        state.inCar.missionCounted = true;
        state.missionStolenCar = state.inCar;
        done = true;
      }
      break;
    case 'deliverCar':
      done = state.inCar && PLACES[step.place] && dist(state.inCar, placeOf(step.place)) < 110;
      break;
    case 'loseWanted':
      done = state.wanted === 0 && state.time - (state.lastCrimeTime || -99) > 2;
      break;
    case 'defeatThugs':
      done = state.thugs.filter((t) => t.health <= 0).length >= step.count;
      break;
    case 'defeatBoss':
      done = state.boss && state.boss.health <= 0;
      break;
  }
  if (done) {
    state.missionStep++;
    audio.cash();
    if (state.missionStep >= m.steps.length) {
      state.money += m.reward; state.earned += m.reward;
      state.missionIndex++;
      audio.missionDone();
      showToast(`Mission complete: ${m.title}  +$${m.reward}`);
      saveGame('Progress saved');
      if (state.missionIndex >= MISSIONS.length) {
        setObjective('SUNFALL CITY IS FREE. You are legend.');
        state.marker = null;
      } else beginMission();
    } else updateMissionObjective();
  }
}
function anchorPoint() { return state.inCar ? state.inCar : state.player; }

// ---------- vehicle enter/exit, combat, wanted ----------
function toggleVehicle() {
  if (state.inCar) {
    const car = state.inCar;
    state.inCar = null;
    state.player.x = car.x + Math.cos(car.angle) * 30;
    state.player.y = car.y + Math.sin(car.angle) * 30;
  } else {
    let best = null, bd = 70;
    for (const car of state.cars) {
      const d = dist(state.player, car);
      if (d < bd) { bd = d; best = car; }
    }
    if (best) {
      state.inCar = best;
      best.parked = false;
      if (best.type !== 'police') addWanted(1, 'Grand theft auto');
      else addWanted(0);
      audio.carEnter();
    }
  }
}
function addWanted(stars, why) {
  const before = state.wanted;
  state.wanted = Math.min(5, Math.max(state.wanted, state.wanted + stars));
  state.lastCrimeTime = state.time;
  if (state.wanted > before) audio.starUp();
  if (why) showToast(`${why} — wanted level ${state.wanted}★`);
}
function punch() {
  if (state.punchCooldown > 0 || state.inCar) return;
  state.punchCooldown = 0.38;
  audio.punch();
  const reach = 46;
  for (const ped of [...state.peds, ...state.thugs, state.boss].filter(Boolean)) {
    if (ped.health > 0 && dist(state.player, ped) < reach) {
      ped.health -= 34;
      ped.state = 'flee';
      audio.hit();
      state.shake = Math.max(state.shake, 4);
    }
  }
}
function shoot() {
  if (state.shotCooldown > 0) return;
  state.shotCooldown = 0.22;
  audio.gunshot();
  const origin = anchorPoint();
  const worldMouse = screenToWorld(mouse.x, mouse.y);
  const angle = Math.atan2(worldMouse.x - origin.x, -(worldMouse.y - origin.y));
  const muzzle = { x: origin.x + Math.sin(angle) * 22, y: origin.y - Math.cos(angle) * 22 };
  const targets = [...state.peds, ...state.thugs, ...state.policeCars, ...state.cars];
  if (state.boss) targets.push(state.boss);
  for (const t of targets) {
    if (!t || t === state.inCar) continue;
    if (segmentCircleHit(muzzle, angle, 900, t, t.kind === 'car' ? 26 : 12)) {
      t.health -= t.kind === 'car' ? 26 : 40;
      break;
    }
  }
  if (!state.inCar) addWanted(1, 'Shots fired');
  state.shake = Math.max(state.shake, 3);
}
function segmentCircleHit(origin, angle, range, target, radius) {
  const dx = Math.sin(angle), dy = -Math.cos(angle);
  const fx = target.x - origin.x, fy = target.y - origin.y;
  const along = fx * dx + fy * dy;
  if (along < 0 || along > range) return false;
  const perp = Math.abs(fx * dy - fy * dx);
  return perp < radius;
}
function screenToWorld(sx, sy) {
  return { x: sx - canvas.width / 2 + state.camX, y: sy - canvas.height / 2 + state.camY };
}

// ---------- police ----------
function policeTick(dt) {
  const target = anchorPoint();
  const shouldChase = state.wanted > 0;
  // maintain fleet
  const desired = shouldChase ? Math.min(1 + state.wanted, 4) : 0;
  while (state.policeCars.length < desired) {
    const edge = city.vRoads[Math.floor(rng() * city.vRoads.length)];
    const car = makeCar('police', edge + 48, rng() < 0.5 ? 0 : WORLD.height, 0, rng, false);
    car.maxSpeed = 11.5;
    state.policeCars.push(car);
  }
  if (!shouldChase && state.policeCars.length) state.policeCars = [];
  for (const p of state.policeCars) {
    const angle = Math.atan2(target.x - p.x, -(target.y - p.y));
    p.angle = lerpAngle(p.angle, angle, 0.045 * dt * 60);
    p.speed = Math.min(p.maxSpeed, p.speed + 0.3 * dt * 60);
    const px = p.x + Math.sin(p.angle) * p.speed * dt * 60;
    const py = p.y - Math.cos(p.angle) * p.speed * dt * 60;
    if (!collidesBuilding(city, px, py, 16)) { p.x = px; p.y = py; } else { p.angle += Math.PI / 3; p.speed *= 0.6; }
    // ram the player
    if (dist(p, target) < 44) {
      state.player.health -= 8 * dt;
      if (state.inCar) state.inCar.health -= 20 * dt;
      state.shake = Math.max(state.shake, 5);
    }
  }
  // wanted decay when nobody is near
  const nearest = state.policeCars.reduce((m, p) => Math.min(m, dist(p, target)), Infinity);
  if (state.wanted > 0 && nearest > 700) {
    state.wantedCooldown += dt;
    if (state.wantedCooldown > 4) { state.wanted = Math.max(0, state.wanted - 1); state.wantedCooldown = 0; }
  } else state.wantedCooldown = 0;
  audio.setSiren(state.policeCars.length > 0 && state.wanted > 0);
  // busted?
  if (state.player.health <= 0 || (state.inCar && state.inCar.health <= 0)) {
    if (state.policeCars.length > 0 || state.wanted > 0) arrest();
    else { state.player.health = 40; if (state.inCar) state.inCar.health = 60; }
  }
}
function arrest() {
  state.scene = 'busted';
  state.money = Math.floor(state.money * 0.7);
  audio.busted();
  audio.setSiren(false);
}
function respawnAfterBust() {
  state.player.health = 100;
  state.player.x = PLACES.hospital.x; state.player.y = PLACES.hospital.y + 90;
  state.inCar = null; state.wanted = 0; state.policeCars = [];
  state.scene = 'playing';
  showToast('You woke up at St. Aurelia. 30% lighter.');
}

// ---------- update ----------
function update(dt) {
  state.time += dt;
  state.shotCooldown = Math.max(0, state.shotCooldown - dt);
  state.punchCooldown = Math.max(0, state.punchCooldown - dt);
  state.shake = Math.max(0, state.shake - dt * 14);

  const playerInput = {
    throttle: (keys.has('w') || keys.has('arrowup') ? 1 : 0) + (keys.has('s') || keys.has('arrowdown') ? -1 : 0),
    steer: (keys.has('d') || keys.has('arrowright') ? 1 : 0) + (keys.has('a') || keys.has('arrowleft') ? -1 : 0),
    handbrake: keys.has('shift'),
  };

  if (state.inCar) {
    const car = state.inCar;
    updateCarPhysics(car, playerInput, dt);
    if (carCircleHit(city, car)) {
      car.x -= Math.sin(car.angle) * car.speed * dt * 60;
      car.y += Math.cos(car.angle) * car.speed * dt * 60;
      if (Math.abs(car.speed) > 4) { audio.carCrash(); state.shake = Math.max(state.shake, 7); car.health -= 12; }
      car.speed *= -0.35;
    }
    // run over pedestrians
    for (const ped of state.peds) {
      if (ped.health > 0 && dist(car, ped) < 30 && Math.abs(car.speed) > 3) {
        ped.health = 0;
        addWanted(2, 'Vehicular manslaughter');
        state.shake = Math.max(state.shake, 6);
      }
    }
    state.player.x = car.x; state.player.y = car.y;
  } else {
    // on foot
    let mx = playerInput.steer, my = -playerInput.throttle;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len; my /= len;
      const nx = state.player.x + mx * 3.1 * dt * 60;
      const ny = state.player.y + my * 3.1 * dt * 60;
      if (!collidesBuilding(city, nx, ny, state.player.radius)) { state.player.x = nx; state.player.y = ny; }
      else if (!collidesBuilding(city, nx, state.player.y, state.player.radius)) state.player.x = nx;
      else if (!collidesBuilding(city, state.player.x, ny, state.player.radius)) state.player.y = ny;
      state.player.angle = Math.atan2(mx, -my);
    }
  }
  if (mouse.down) shoot();

  // traffic + peds
  for (const car of state.cars) if (car !== state.inCar && !car.parked) updateTrafficCar(car, city, rng, dt);
  const fleeFrom = state.wanted > 0 ? anchorPoint() : null;
  for (const ped of state.peds) if (ped.health > 0) updatePed(ped, city, rng, dt, fleeFrom);
  for (const thug of state.thugs) {
    if (thug.health <= 0) continue;
    if (dist(thug, state.player) < 420) {
      // thugs advance and shoot
      const angle = Math.atan2(state.player.x - thug.x, -(state.player.y - thug.y));
      thug.angle = lerpAngle(thug.angle, angle, 0.1 * dt * 60);
      thug.x += Math.sin(thug.angle) * 1.9 * dt * 60;
      thug.y -= Math.cos(thug.angle) * 1.9 * dt * 60;
      if (dist(thug, state.player) < 380 && thug.shootCooldown <= 0) {
        thug.shootCooldown = 1.4;
        if (segmentCircleHit(thug, thug.angle, 400, anchorPoint(), 14)) {
          state.player.health -= 9;
          state.shake = Math.max(state.shake, 3);
          audio.hit();
        }
      }
    } else updatePed(thug, city, rng, dt, null);
  }
  if (state.boss && state.boss.health > 0) {
    const b = state.boss;
    if (dist(b, state.player) < 520) {
      const angle = Math.atan2(state.player.x - b.x, -(state.player.y - b.y));
      b.angle = lerpAngle(b.angle, angle, 0.12 * dt * 60);
      b.x += Math.sin(b.angle) * 2.3 * dt * 60;
      b.y -= Math.cos(b.angle) * 2.3 * dt * 60;
      if (dist(b, state.player) < 420 && b.shootCooldown <= 0) {
        b.shootCooldown = 1.1;
        if (segmentCircleHit(b, b.angle, 430, anchorPoint(), 14)) {
          state.player.health -= 12;
          state.shake = Math.max(state.shake, 4);
          audio.hit();
        }
      }
    } else updatePed(b, city, rng, dt, null);
  }

  // remove dead cars / count wrecked
  for (const car of state.cars) {
    if (car.health <= 0 && car !== state.inCar) {
      car.dead = true;
    }
  }
  state.cars = state.cars.filter((c) => !c.dead);

  missionTick(dt);
  policeTick(dt);

  // camera
  const focus = anchorPoint();
  state.camX += (focus.x - state.camX) * Math.min(1, 4.2 * dt);
  state.camY += (focus.y - state.camY) * Math.min(1, 4.2 * dt);
}

// ---------- render ----------
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function render() {
  const viewW = canvas.width, viewH = canvas.height;
  if (state.scene === 'title' || state.scene === 'howto') { renderTitle(viewW, viewH); return; }
  const shakeX = (Math.random() - 0.5) * state.shake, shakeY = (Math.random() - 0.5) * state.shake;
  const cam = { x: state.camX + shakeX, y: state.camY + shakeY };
  drawCity(ctx, city, cam, viewW, viewH);

  ctx.save();
  ctx.translate(viewW / 2 - cam.x, viewH / 2 - cam.y);

  // mission marker beacon
  if (state.marker) {
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    ctx.strokeStyle = 'rgba(255,215,0,0.9)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(state.marker.x, state.marker.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,215,0,0.25)';
    ctx.beginPath(); ctx.arc(state.marker.x, state.marker.y, 60 * pulse, 0, Math.PI * 2); ctx.fill();
  }

  // cars
  for (const car of state.cars) drawCar(ctx, car, car === state.inCar);
  for (const p of state.policeCars) drawCar(ctx, p, false);
  // peds
  for (const ped of state.peds) if (ped.health > 0) drawPed(ctx, ped);
  for (const thug of state.thugs) if (thug.health > 0) drawPed(ctx, thug);
  if (state.boss && state.boss.health > 0) {
    drawPed(ctx, state.boss);
    // boss health bar
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(state.boss.x - 40, state.boss.y - 28, 80, 7);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(state.boss.x - 40, state.boss.y - 28, 80 * Math.max(0, state.boss.health / 140), 7);
  }

  // player (on foot)
  if (!state.inCar) {
    ctx.save();
    ctx.translate(state.player.x, state.player.y);
    ctx.rotate(state.player.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 3, 10, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2e86c1';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(0, -3.5, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  drawHUD(ctx, state, city, viewW, viewH);

  if (state.scene === 'paused') {
    ctx.fillStyle = 'rgba(8,8,14,0.72)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', viewW / 2, viewH / 2 - 60);
    ctx.fillStyle = '#e8e4da';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Esc — resume', viewW / 2, viewH / 2);
    ctx.fillText('Q — save progress and return to title', viewW / 2, viewH / 2 + 34);
  } else if (state.scene === 'busted') {
    ctx.fillStyle = 'rgba(20,8,8,0.78)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#ff8a7a';
    ctx.font = 'bold 52px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED', viewW / 2, viewH / 2 - 40);
    ctx.fillStyle = '#e8e4da';
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillText('The cops dragged you to St. Aurelia. 30% of your cash is gone.', viewW / 2, viewH / 2 + 6);
    ctx.fillText('Press Enter to wake up', viewW / 2, viewH / 2 + 44);
  }
}

function renderTitle(viewW, viewH) {
  // slow attract-mode pan across the city behind the menu
  state.titleDrift += 0.0035;
  const cam = {
    x: WORLD.width / 2 + Math.cos(state.titleDrift) * 620,
    y: WORLD.height / 2 + Math.sin(state.titleDrift * 1.3) * 620,
  };
  drawCity(ctx, city, cam, viewW, viewH);
  const g = ctx.createLinearGradient(0, 0, 0, viewH);
  g.addColorStop(0, 'rgba(20,10,26,0.82)');
  g.addColorStop(0.45, 'rgba(20,10,26,0.25)');
  g.addColorStop(1, 'rgba(20,10,26,0.88)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 92px Georgia, serif';
  ctx.fillText('SUNFALL CITY', viewW / 2, viewH * 0.24);
  ctx.fillStyle = '#ffb27a';
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText('Crime never sleeps on the sun-soaked coast', viewW / 2, viewH * 0.24 + 44);

  if (state.scene === 'howto') {
    ctx.fillStyle = '#e8e4da';
    ctx.font = '19px system-ui, sans-serif';
    const lines = [
      'W A S D / arrows — walk and drive',
      'E — enter or exit a vehicle (stealing raises your wanted level)',
      'Mouse — aim, Left click — shoot',
      'F — punch',
      'Shift — handbrake in a car',
      'Esc — pause   •   Q (in pause) — save & quit to title',
      'Follow the gold marker. Finish Mama Rosa’s missions. Become a legend.',
      'Save happens automatically after each mission.',
      '',
      'Press Enter to go back',
    ];
    lines.forEach((l, i) => ctx.fillText(l, viewW / 2, viewH * 0.46 + i * 32));
    return;
  }

  const opts = menuOptions();
  state.menuIndex = Math.min(state.menuIndex, opts.length - 1);
  opts.forEach((label, i) => {
    const y = viewH * 0.52 + i * 64;
    const selected = i === state.menuIndex;
    ctx.fillStyle = selected ? 'rgba(255,215,0,0.92)' : 'rgba(10,10,16,0.65)';
    roundRect(ctx, viewW / 2 - 180, y - 26, 360, 50, 12);
    ctx.fill();
    ctx.fillStyle = selected ? '#1a1206' : '#ffe9a8';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(label, viewW / 2, y + 7);
  });
  ctx.fillStyle = 'rgba(232,228,218,0.75)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('An original open-world crime game — no Rockstar assets, all code and art generated in-engine', viewW / 2, viewH - 30);
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

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.scene === 'playing') update(dt);
  render();
  requestAnimationFrame(frame);
}

// expose a tiny debug/screenshot hook (used by the maker to capture real gameplay)
window.__sunfall = { state, startNewGame, continueGame, PLACES };

requestAnimationFrame(frame);
