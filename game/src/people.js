// Pedestrians: Solmar's sidewalk crowd. They stroll along the roads, pause at
// corners, and run from gunfire, speeding cars and police chases. They are the
// city's life, and also its witnesses: hurting one is a crime.
import { PLAYER_RADIUS } from './config.js';
import { COLORS } from './config.js';
import { nearestRoadPoint } from './city.js';

export function makePedestrian(x, y, random) {
  return {
    x, y, angle: random.range(0, Math.PI * 2), speed: random.range(28, 52),
    color: random.pick(COLORS.ped), state: 'walk', panic: 0, pause: random.range(0, 3),
    alive: true, health: 30, walkPhase: random.range(0, Math.PI * 2),
  };
}

/** One pedestrian's step: walk the sidewalk, flee when panicked. */
export function stepPedestrian(ped, dt, random, city, danger) {
  if (!ped.alive) return;
  if (ped.panic > 0) {
    ped.panic -= dt;
    ped.state = 'flee';
    const dx = ped.x - danger.x;
    const dy = ped.y - danger.y;
    const d = Math.hypot(dx, dy) || 1;
    ped.angle = Math.atan2(dy / d, dx / d);
    const speed = 150;
    movePed(ped, dt, speed, city);
    return;
  }
  ped.state = 'walk';
  if (ped.pause > 0) {
    ped.pause -= dt;
    return;
  }
  const speed = ped.speed;
  movePed(ped, dt, speed, city);
  // At a corner, sometimes turn onto the crossing road.
  const road = nearestRoadPoint(ped.x, ped.y);
  const onCrossing = Math.abs(ped.x - road.x) < 8 && Math.abs(ped.y - road.y) < 8;
  if (onCrossing && random.chance(dt * 0.6)) {
    ped.angle = random.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    ped.pause = random.range(0, 1.5);
  }
}

function movePed(ped, dt, speed, city) {
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  const fixed = city.resolveCircle(nx, ny, PLAYER_RADIUS);
  ped.x = fixed.x;
  ped.y = fixed.y;
  if (fixed.moved) {
    // Bumped into a building: turn around and walk the other way.
    ped.angle += Math.PI;
    ped.pause = 0.5;
  }
  const road = nearestRoadPoint(ped.x, ped.y);
  // Drift back toward the sidewalk beside the road.
  if (Math.abs(ped.x - road.x) < Math.abs(ped.y - road.y)) {
    ped.y += (road.y + (ped.angle > 0 ? 40 : -40) - ped.y) * Math.min(1, dt * 2);
  } else {
    ped.x += (road.x + (Math.cos(ped.angle) > 0 ? 40 : -40) - ped.x) * Math.min(1, dt * 2);
  }
  ped.walkPhase += dt * 8;
}

/** Scare every pedestrian near a point (gunshot, crash, siren). */
export function scarePeds(peds, x, y, radius) {
  for (const ped of peds) {
    if (!ped.alive) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) ped.panic = 3 + (radius - d) / radius * 2;
  }
}
