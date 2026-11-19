// The world: everything that exists in Solmar and one step that moves it all.
// The player, the cars, the crowd, the police, the bullets, the pickups and the
// story all live here; the renderer only paints what this holds, and main.js
// only feeds it input and reads its events.
import {
  CAR_LENGTH, PLAYER_HEALTH, PLAYER_RADIUS, PLAYER_RUN, PLAYER_WALK,
  STEP, WANTED_DECAY_SECONDS, WORLD_H, WORLD_W,
} from './config.js';
import { createCity, nearestRoadPoint, onRoad, roadCentersX, roadCentersY } from './city.js';
import { CAR_COLORS, collideCars, makeCar, stepPlayerCar, stepTraffic } from './vehicles.js';
import { makePedestrian, scarePeds, stepPedestrian } from './people.js';
import { footCopCount, makePolice, policeCarCount, spawnFootCop, spawnPoliceCar, stepFootCop, stepPoliceCar } from './police.js';
import { makeBullet, makeEnemy, meleeHit, stepBullets, stepEnemy } from './combat.js';
import { completeMission, freshProgress, missionByIndex } from './missions.js';
import { loadGame, saveGame } from './save.js';

export const EVENT_NONE = 0;
export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;
export const EVENT_MISSION_DONE = 4;
export const EVENT_CRIME = 8;
export const EVENT_HIT = 16;
export const EVENT_PICKUP = 32;

const TRAFFIC_COUNT = 11;
const PARKED_COUNT = 9;
const PED_COUNT = 26;

export function createWorld(random) {
  const city = createCity(random);
  const state = {
    time: 0, wanted: 0, wantedTimer: 0, money: 0, best: 0,
    player: null, cars: [], parked: [], policeCars: [], cops: [],
    peds: [], enemies: [], bullets: [], pickups: [], particles: [],
    progress: freshProgress(), missionMessage: '', toast: '', toastTimer: 0,
    policeTimer: 0, pickupTimer: 0, over: false, overKind: '',
    camera: { x: 0, y: 0 },
  };

  function spawnPlayer(x, y) {
    state.player = {
      x, y, angle: -Math.PI / 2, speed: 0, health: PLAYER_HEALTH,
      money: 0, ammo: 12, mag: 12, reserve: 48, inCar: false, car: null,
      punchTimer: 0, shootTimer: 0, hurtTimer: 0, weapon: 'pistol',
    };
  }

  function randomRoadSpot() {
    const xs = roadCentersX();
    const ys = roadCentersY();
    if (random.chance(0.5)) return { x: xs[Math.floor(random.next() * xs.length)], y: random.range(120, WORLD_H - 120) };
    return { x: random.range(120, WORLD_W - 120), y: ys[Math.floor(random.next() * ys.length)] };
  }

  function spawnTraffic() {
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      const spot = randomRoadSpot();
      const car = makeCar(spot.x, spot.y, 0, random.pick(CAR_COLORS), 'traffic');
      car.dir = Math.floor(random.next() * 4);
      car.speed = random.range(60, 120);
      state.cars.push(car);
    }
  }

  function spawnParked() {
    let placed = 0;
    let guard = 0;
    while (placed < PARKED_COUNT && guard < 200) {
      guard += 1;
      const spot = randomRoadSpot();
      const road = nearestRoadPoint(spot.x, spot.y);
      const px = road.vertical ? road.x + (random.chance(0.5) ? 40 : -40) : spot.x;
      const py = road.vertical ? spot.y : road.y + (random.chance(0.5) ? 40 : -40);
      if (city.hitBuilding(px, py, 30)) continue;
      if (Math.hypot(px - state.player.x, py - state.player.y) < 200) continue;
      const car = makeCar(px, py, road.vertical ? Math.PI / 2 : 0, random.pick(CAR_COLORS), 'parked');
      state.parked.push(car);
      placed += 1;
    }
  }

  function spawnPeds() {
    for (let i = 0; i < PED_COUNT; i += 1) {
      const spot = randomRoadSpot();
      state.peds.push(makePedestrian(spot.x, spot.y, random));
    }
  }

  function spawnPickup(kind, x, y) {
    state.pickups.push({ x, y, kind, bob: random.range(0, Math.PI * 2), alive: true });
  }

  function scatterPickups() {
    for (let i = 0; i < 10; i += 1) {
      const spot = randomRoadSpot();
      spawnPickup(random.chance(0.6) ? 'cash' : 'health', spot.x, spot.y);
    }
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, Math.PI * 2);
      const s = random.range(speed * 0.3, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: random.range(0.3, 0.8), max: 0.8, color, size: random.range(2, 5) });
    }
  }

  function addWanted(n) {
    const before = state.wanted;
    state.wanted = Math.min(5, state.wanted + n);
    state.wantedTimer = 0;
    return state.wanted > before;
  }

  function setToast(text, seconds) {
    state.toast = text;
    state.toastTimer = seconds || 3;
  }

  function startMission(index) {
    const mission = missionByIndex(index);
    if (!mission || index > state.progress.unlocked) return false;
    state.progress.active = index;
    state.progress.step = 0;
    state.progress.holdTime = 0;
    state.progress.surviveTime = 0;
    if (mission.id === 'heat') {
      state.wanted = 3;
      state.wantedTimer = 0;
    }
    setToast(`${mission.title}: ${mission.brief}`, 6);
    return true;
  }

  function finishMission() {
    const index = state.progress.active;
    const mission = missionByIndex(index);
    if (!mission) return EVENT_NONE;
    state.money += mission.reward;
    state.player.money = state.money;
    completeMission(state.progress, index);
    state.player.reserve += 24;
    setToast(`Job done: ${mission.title} — +$${mission.reward}`, 4);
    return EVENT_MISSION_DONE;
  }

  function nearestCar(maxDist) {
    let bestCar = null;
    let bestD = maxDist;
    const all = [...state.parked, ...state.cars];
    for (const car of all) {
      if (!car.alive) continue;
      const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
      if (d < bestD) {
        bestD = d;
        bestCar = car;
      }
    }
    return bestCar;
  }

  function enterCar(car) {
    const wasParked = car.kind === 'parked';
    if (wasParked) state.parked = state.parked.filter((c) => c !== car);
    else state.cars = state.cars.filter((c) => c !== car);
    car.kind = 'player';
    state.player.car = car;
    state.player.inCar = true;
    state.player.x = car.x;
    state.player.y = car.y;
    addWanted(1);
    setToast(wasParked ? 'You stole a parked car. The heat is on.' : 'You jacked a car in traffic!', 3);
    return EVENT_CRIME;
  }

  function exitCar() {
    const car = state.player.car;
    if (!car) return;
    car.kind = 'parked';
    car.speed = 0;
    const side = state.player.angle + Math.PI / 2;
    state.player.x = car.x + Math.cos(side) * 40;
    state.player.y = car.y + Math.sin(side) * 40;
    const fixed = city.resolveCircle(state.player.x, state.player.y, PLAYER_RADIUS);
    state.player.x = fixed.x;
    state.player.y = fixed.y;
    state.parked.push(car);
    state.player.car = null;
    state.player.inCar = false;
  }

  function fireBullet(x, y, angle, fromPlayer, damage) {
    state.bullets.push(makeBullet(x, y, angle, fromPlayer, damage));
  }

  function damagePlayer(amount) {
    const p = state.player;
    p.health -= amount;
    p.hurtTimer = 0.4;
    if (p.health <= 0) {
      p.health = 0;
      state.over = true;
      state.overKind = 'wasted';
      return EVENT_WASTED;
    }
    return EVENT_HIT;
  }

  function reset(keepSave) {
    const saved = keepSave ? loadGame() : null;
    state.time = 0;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.cars = [];
    state.parked = [];
    state.policeCars = [];
    state.cops = [];
    state.peds = [];
    state.enemies = [];
    state.bullets = [];
    state.pickups = [];
    state.particles = [];
    state.progress = freshProgress();
    state.over = false;
    state.overKind = '';
    state.toast = '';
    state.toastTimer = 0;
    state.policeTimer = 0;
    state.pickupTimer = 0;
    const start = city.landmarks.safehouse;
    spawnPlayer(start.x, start.y + 120);
    state.money = 0;
    state.player.money = 0;
    if (saved) {
      state.money = saved.money;
      state.player.money = saved.money;
      state.player.health = saved.health;
      state.player.mag = saved.mag;
      state.player.ammo = saved.ammo;
      state.player.reserve = saved.reserve;
      state.player.x = saved.x;
      state.player.y = saved.y;
      state.progress.completed = saved.completed.slice();
      state.progress.unlocked = saved.unlocked;
      state.best = saved.best || 0;
    }
    spawnTraffic();
    spawnParked();
    spawnPeds();
    scatterPickups();
  }

  function stepPlayer(dt, move, actions, aimWorld, interactHeld) {
    const p = state.player;
    p.punchTimer = Math.max(0, p.punchTimer - dt);
    p.shootTimer = Math.max(0, p.shootTimer - dt);
    p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    if (p.inCar && p.car) {
      const before = { x: p.car.x, y: p.car.y };
      stepPlayerCar(p.car, dt, move, city);
      p.x = p.car.x;
      p.y = p.car.y;
      p.angle = p.car.angle;
      p.speed = p.car.speed;
      // Crash into a pedestrian.
      for (const ped of state.peds) {
        if (!ped.alive) continue;
        if (Math.hypot(ped.x - p.x, ped.y - p.y) < CAR_LENGTH / 2 + 10 && Math.abs(p.car.speed) > 60) {
          ped.alive = false;
          burst(ped.x, ped.y, '#a4133c', 10, 120);
          addWanted(1);
          scarePeds(state.peds, p.x, p.y, 200);
        }
      }
      if (Math.hypot(p.car.x - before.x, p.car.y - before.y) < 0.01 && Math.abs(p.car.speed) > 80) {
        // Pinned against a building at speed: a scrape.
        p.car.speed *= 0.9;
      }
      return EVENT_NONE;
    }
    // On foot.
    const running = move.x !== 0 || move.y !== 0 ? state.player.runHeld : false;
    const maxSpeed = running ? PLAYER_RUN : PLAYER_WALK;
    const nx = p.x + move.x * maxSpeed * dt;
    const ny = p.y + move.y * maxSpeed * dt;
    const fixed = city.resolveCircle(nx, ny, PLAYER_RADIUS);
    p.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_W - PLAYER_RADIUS, fixed.x));
    // The beach is for walking on: stay on the sand, short of the water.
    p.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_H - 48, fixed.y));
    p.speed = (move.x !== 0 || move.y !== 0) ? maxSpeed : 0;
    if (aimWorld) p.angle = Math.atan2(aimWorld.y - p.y, aimWorld.x - p.x);
    else if (move.x !== 0 || move.y !== 0) p.angle = Math.atan2(move.y, move.x);
    return EVENT_NONE;
  }

  function stepMission(dt, actions, interactHeld) {
    const progress = state.progress;
    if (progress.active < 0) return EVENT_NONE;
    const mission = missionByIndex(progress.active);
    const stepDef = mission.steps[progress.step];
    if (!stepDef) return EVENT_NONE;
    const p = state.player;
    const landmark = stepDef.target ? city.landmarks[stepDef.target] : null;
    const nearLandmark = landmark ? Math.hypot(p.x - landmark.x, p.y - landmark.y) < 80 : false;
    if (stepDef.kind === 'steal') {
      if (p.inCar) {
        progress.step += 1;
        setToast('Nice wheels. Now bring it to Lou.', 3);
      }
    } else if (stepDef.kind === 'goto') {
      if (nearLandmark) {
        progress.step += 1;
        if (stepDef.target === 'docks') setToast('The package is here. Hold E to grab it.', 3);
        if (stepDef.target === 'bank') setToast('The vault is open. Hold E to crack it.', 3);
      }
    } else if (stepDef.kind === 'hold') {
      if (nearLandmark && interactHeld) {
        progress.holdTime += dt;
        if (progress.holdTime >= stepDef.seconds) {
          progress.holdTime = 0;
          progress.step += 1;
          if (mission.id === 'pickup') setToast('Package secured. Get it back to Mara.', 3);
          if (mission.id === 'job') {
            state.wanted = 4;
            state.wantedTimer = 0;
            for (let i = 0; i < 3; i += 1) {
              const gx = city.landmarks.bank.x + (i - 1) * 90;
              const gy = city.landmarks.bank.y + 120;
              state.enemies.push(makeEnemy(gx, gy, 'guard', 40));
            }
            setToast('Vault cracked! Guards incoming — RUN!', 4);
          }
        }
      } else {
        progress.holdTime = Math.max(0, progress.holdTime - dt * 2);
      }
    } else if (stepDef.kind === 'survive') {
      progress.surviveTime += dt;
      // Epsilon: 3600 fixed steps of 1/60 s sum to a hair under 60 in floats.
      if (progress.surviveTime >= stepDef.seconds - 0.01) {
        progress.surviveTime = 0;
        progress.step += 1;
        setToast('You shook them — for now. Get to the safehouse.', 3);
      }
    }
    if (progress.step >= mission.steps.length) return finishMission();
    return EVENT_NONE;
  }

  function stepWanted(dt) {
    if (state.wanted === 0) return;
    state.wantedTimer += dt;
    const policeNear = state.policeCars.some((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 420)
      || state.cops.some((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 420);
    if (state.wantedTimer > WANTED_DECAY_SECONDS && !policeNear) {
      state.wanted -= 1;
      state.wantedTimer = 0;
      if (state.wanted === 0) setToast('The heat cooled off.', 2);
    }
    // Keep the right number of police hunting.
    state.policeTimer -= dt;
    const wantCars = policeCarCount(state.wanted);
    const wantCops = footCopCount(state.wanted);
    if (state.policeTimer <= 0) {
      state.policeTimer = 1.2;
      if (state.policeCars.length < wantCars) state.policeCars.push(spawnPoliceCar(random, state.player));
      if (state.cops.length < wantCops && !state.player.inCar) state.cops.push(spawnFootCop(random, state.player));
    }
    if (state.policeCars.length > wantCars) state.policeCars.splice(wantCars);
    if (state.cops.length > wantCops) state.cops.splice(wantCops);
  }

  function step(dt, move, actions, aimWorld, interactHeld, audio) {
    if (state.over) return EVENT_NONE;
    state.time += dt;
    let events = EVENT_NONE;
    const p = state.player;

    // Interact: enter or leave a car.
    if (actions && (actions & 4)) {
      if (p.inCar) exitCar();
      else {
        const car = nearestCar(70);
        if (car) events |= enterCar(car);
      }
    }
    // Run flag comes through move.
    p.runHeld = move.run === true;
    events |= stepPlayer(dt, move, actions, aimWorld, interactHeld);
    events |= stepMission(dt, actions, interactHeld);

    // Combat: punch and pistol.
    if (!p.inCar) {
      if (actions && (actions & 8) && p.punchTimer <= 0) {
        p.punchTimer = 0.35;
        const targets = [...state.peds, ...state.cops, ...state.enemies];
        const hit = meleeHit(p, 46, Math.PI * 0.9, targets);
        for (const t of hit) {
          t.health -= 15;
          burst(t.x, t.y, '#ffd23f', 5, 90);
          if (t.health <= 0 && t.alive) {
            t.alive = false;
            if (state.peds.includes(t)) {
              addWanted(1);
              events |= EVENT_CRIME;
            }
          }
        }
        if (hit.length > 0 && audio) audio.punch();
      }
      if (actions && (actions & 16) && p.shootTimer <= 0 && p.mag > 0) {
        p.shootTimer = 0.22;
        p.mag -= 1;
        const muzzleX = p.x + Math.cos(p.angle) * 22;
        const muzzleY = p.y + Math.sin(p.angle) * 22;
        fireBullet(muzzleX, muzzleY, p.angle, true, 25);
        burst(muzzleX, muzzleY, '#ffe066', 3, 60);
        scarePeds(state.peds, p.x, p.y, 260);
        if (audio) audio.shoot();
      }
      if (actions && (actions & 32) && p.mag < 12 && p.reserve > 0) {
        const need = 12 - p.mag;
        const take = Math.min(need, p.reserve);
        p.mag += take;
        p.reserve -= take;
        if (audio) audio.click();
      }
    }

    // Traffic, parked respawn, pedestrians.
    const allCars = [...state.cars, ...state.policeCars, ...(p.car ? [p.car] : [])];
    for (const car of state.cars) stepTraffic(car, dt, random, city, allCars);
    for (const ped of state.peds) {
      const danger = state.policeCars[0] || p;
      stepPedestrian(ped, dt, random, city, danger);
    }
    // Player car bumps traffic cars.
    if (p.inCar && p.car) {
      for (const car of state.cars) {
        if (collideCars(p.car, car) && Math.abs(p.car.speed) > 120 && audio) audio.crash();
      }
      for (const cop of state.policeCars) collideCars(p.car, cop);
    }
    // Traffic cars nudge the player on foot.
    if (!p.inCar) {
      for (const car of state.cars) {
        const d = Math.hypot(car.x - p.x, car.y - p.y);
        if (d < CAR_LENGTH / 2 + PLAYER_RADIUS && Math.abs(car.speed) > 40) {
          events |= damagePlayer(10);
          const away = Math.atan2(p.y - car.y, p.x - car.x);
          p.x += Math.cos(away) * 30;
          p.y += Math.sin(away) * 30;
        }
      }
    }

    // Police chase.
    stepWanted(dt);
    for (const cop of state.policeCars) stepPoliceCar(cop, dt, { x: p.x, y: p.y, wanted: state.wanted }, city);
    for (const cop of state.cops) {
      if (stepFootCop(cop, dt, { x: p.x, y: p.y, speed: p.speed, inCar: p.inCar }, city)) {
        state.over = true;
        state.overKind = 'busted';
        return EVENT_BUSTED;
      }
    }
    // Police cars ram the player on foot.
    if (!p.inCar) {
      for (const cop of state.policeCars) {
        const d = Math.hypot(cop.x - p.x, cop.y - p.y);
        if (d < CAR_LENGTH / 2 + PLAYER_RADIUS && Math.abs(cop.speed) > 60) {
          events |= damagePlayer(12);
        }
      }
    }

    // Enemies shoot back; bullets fly.
    for (const e of state.enemies) {
      stepEnemy(e, dt, p, city, (x, y, a, from, dmg) => fireBullet(x, y, a, from, dmg));
    }
    const targets = [...state.enemies, ...state.cops, ...state.peds];
    const hits = stepBullets(state.bullets, dt, city, p.inCar ? targets : [...targets, { ...p, radius: PLAYER_RADIUS, alive: !state.over, isPlayer: true }]);
    for (const hit of hits) {
      const t = hit.target;
      if (t.isPlayer) {
        events |= damagePlayer(hit.bullet.damage);
        if (state.over) return EVENT_WASTED;
      } else {
        t.health -= hit.bullet.damage;
        burst(t.x, t.y, '#a4133c', 6, 100);
        if (t.health <= 0 && t.alive) {
          t.alive = false;
          burst(t.x, t.y, '#a4133c', 14, 160);
          if (state.peds.includes(t)) {
            addWanted(1);
            events |= EVENT_CRIME;
          }
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.alive);
    state.enemies = state.enemies.filter((e) => e.alive);
    state.cops = state.cops.filter((c) => c.alive);
    state.peds = state.peds.filter((ped) => ped.alive || random.chance(0.001));

    // Pickups: walk over cash or a health kit.
    for (const pk of state.pickups) {
      if (!pk.alive) continue;
      pk.bob += dt * 3;
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < 34) {
        pk.alive = false;
        if (pk.kind === 'cash') {
          const amount = 25 + Math.floor(random.next() * 50);
          state.money += amount;
          p.money = state.money;
          setToast(`+$${amount}`, 1.5);
        } else {
          p.health = Math.min(PLAYER_HEALTH, p.health + 30);
          setToast('+30 health', 1.5);
        }
        events |= EVENT_PICKUP;
        if (audio) audio.pickup();
      }
    }
    state.pickups = state.pickups.filter((pk) => pk.alive);
    state.pickupTimer -= dt;
    if (state.pickupTimer <= 0 && state.pickups.length < 12) {
      state.pickupTimer = 6;
      const spot = randomRoadSpot();
      spawnPickup(random.chance(0.6) ? 'cash' : 'health', spot.x, spot.y);
    }

    // Particles fade.
    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);

    if (state.toastTimer > 0) state.toastTimer -= dt;
    if (state.toastTimer <= 0) state.toast = '';

    // Camera follows the player, clamped to the world.
    state.camera.x = Math.max(0, Math.min(WORLD_W - 1280, p.x - 640));
    state.camera.y = Math.max(0, Math.min(WORLD_H - 720, p.y - 360));

    // Best money is the score the title screen shows.
    if (state.money > state.best) state.best = state.money;
    return events;
  }

  function save() {
    return saveGame({ ...state.player, money: state.money, x: state.player.x, y: state.player.y, progress: state.progress, best: state.best });
  }

  reset(true);
  return { state, city, reset, step, startMission, addWanted, setToast, save, spawnPickup, burst, onRoad };
}
