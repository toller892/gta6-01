// The wanted system: stars, police cars that chase, foot cops that arrest, and
// the heat that cools when the player lies low. Stars drive everything: spawn
// rates, police speed, and how hard the chase is to shake.
import { CAR_LENGTH, makeCar } from './vehicles.js';
import { WORLD_H, WORLD_W } from './config.js';

export function makePolice(x, y, onFoot) {
  return {
    x, y, angle: 0, speed: 0, onFoot: !!onFoot, color: '#1d3557',
    health: onFoot ? 50 : 120, alive: true, arrest: 0, siren: 0,
    targetSpeed: 0, dir: 0, kind: 'police',
  };
}

/** Stars wanted for how many police cars should be hunting the player. */
export function policeCarCount(wanted) {
  return [0, 1, 2, 3, 4, 5][wanted] || 0;
}

/** Stars wanted for how many foot cops should be on the street. */
export function footCopCount(wanted) {
  return [0, 1, 2, 2, 3, 4][wanted] || 0;
}

export function policeTopSpeed(wanted) {
  return 300 + wanted * 28;
}

/** A police car chases the player: steer toward them, ram when close. */
export function stepPoliceCar(cop, dt, player, city) {
  const dx = player.x - cop.x;
  const dy = player.y - cop.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - cop.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  cop.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
  const target = policeTopSpeed(player.wanted) * (dist > 500 ? 1 : 0.9);
  cop.speed += Math.max(-420 * dt, Math.min(360 * dt, target - cop.speed));
  const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
  const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
  if (!city.hitBuilding(nx, ny, CAR_LENGTH / 2 - 4)) {
    cop.x = nx;
    cop.y = ny;
  } else {
    cop.speed *= 0.4;
    cop.angle += 0.6 * dt;
  }
  cop.x = Math.max(30, Math.min(WORLD_W - 30, cop.x));
  cop.y = Math.max(30, Math.min(WORLD_H - 30, cop.y));
}

/** A foot cop runs at the player; standing close and slow fills the arrest meter. */
export function stepFootCop(cop, dt, player, city) {
  const dx = player.x - cop.x;
  const dy = player.y - cop.y;
  const dist = Math.hypot(dx, dy) || 1;
  cop.angle = Math.atan2(dy, dx);
  const speed = 205;
  const nx = cop.x + Math.cos(cop.angle) * speed * dt;
  const ny = cop.y + Math.sin(cop.angle) * speed * dt;
  const fixed = city.resolveCircle(nx, ny, 13);
  cop.x = fixed.x;
  cop.y = fixed.y;
  if (dist < 30 && Math.abs(player.speed || 0) < 40 && !player.inCar) {
    cop.arrest += dt;
  } else {
    cop.arrest = Math.max(0, cop.arrest - dt * 2);
  }
  return cop.arrest >= 1.4;
}

/** Spawn a police car just off-screen from the player, on a road. */
export function spawnPoliceCar(random, player) {
  const angle = random ? random.range(0, Math.PI * 2) : Math.random() * Math.PI * 2;
  const dist = 700;
  const x = Math.max(60, Math.min(WORLD_W - 60, player.x + Math.cos(angle) * dist));
  const y = Math.max(60, Math.min(WORLD_H - 60, player.y + Math.sin(angle) * dist));
  const cop = makeCar(x, y, 0, '#1d3557', 'police');
  cop.speed = 200;
  return cop;
}

export function spawnFootCop(random, player) {
  const angle = random ? random.range(0, Math.PI * 2) : Math.random() * Math.PI * 2;
  const x = Math.max(40, Math.min(WORLD_W - 40, player.x + Math.cos(angle) * 320));
  const y = Math.max(40, Math.min(WORLD_H - 40, player.y + Math.sin(angle) * 320));
  return makePolice(x, y, true);
}
