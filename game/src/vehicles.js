// Cars: the player's ride, parked cars to steal, and traffic that drives the road
// grid. Traffic cars pick a road direction at each intersection and keep to their
// lane; they brake for the car ahead. A car is a circle for collisions, drawn as
// a rotated rectangle.
import { CAR_ACCEL, CAR_BRAKE, CAR_LENGTH, CAR_MAX_SPEED, CAR_REVERSE_MAX, CAR_TURN, CAR_WIDTH, WORLD_H, WORLD_W } from './config.js';
import { nearestRoadPoint, roadCentersX, roadCentersY } from './city.js';

const CAR_COLORS = ['#e63946', '#457b9d', '#f4d35e', '#2a9d8f', '#e07a5f', '#6d6875', '#90be6d', '#f28482', '#b5838d', '#8ecae6'];
const LANE = 22;

export function makeCar(x, y, angle, color, kind) {
  return {
    x, y, angle, speed: 0, color: color || CAR_COLORS[0], kind: kind || 'traffic',
    dir: 0, // traffic heading: 0 east, 1 south, 2 west, 3 north
    targetSpeed: 0, brake: false, alive: true, honk: 0,
  };
}

/** Drive a traffic car one step: follow its road, choose a turn at intersections. */
export function stepTraffic(car, dt, random, city, others) {
  const headings = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const dir = car.dir;
  // Lane offset: right-hand traffic.
  const laneX = dir === 1 ? LANE : dir === 3 ? -LANE : 0;
  const laneY = dir === 0 ? LANE : dir === 2 ? -LANE : 0;
  const ahead = carAhead(car, others);
  const want = ahead ? 0 : random.range(95, 135);
  car.targetSpeed = want;
  car.speed += Math.max(-CAR_BRAKE * dt, Math.min(CAR_ACCEL * 0.6 * dt, want - car.speed));
  if (car.speed < 0) car.speed = 0;
  const heading = headings[dir];
  car.angle = heading;
  const nx = car.x + Math.cos(heading) * car.speed * dt;
  const ny = car.y + Math.sin(heading) * car.speed * dt;
  car.x = nx;
  car.y = ny;
  // Keep the car centred on its lane.
  const road = nearestRoadPoint(car.x, car.y);
  if (dir === 0 || dir === 2) car.y += (road.y + laneY - car.y) * Math.min(1, dt * 3);
  else car.x += (road.x + laneX - car.x) * Math.min(1, dt * 3);
  // At an intersection centre, maybe turn (never reverse).
  const xs = roadCentersX();
  const ys = roadCentersY();
  const nearX = xs.find((c) => Math.abs(car.x - c) < 14);
  const nearY = ys.find((c) => Math.abs(car.y - c) < 14);
  if (nearX !== undefined && nearY !== undefined) {
    if (random.chance(0.45)) {
      const options = [0, 1, 2, 3].filter((d) => d !== (dir + 2) % 4);
      car.dir = options[Math.floor(random.next() * options.length)];
    }
  }
  // Leave the world: respawn on a random road edge.
  if (!city.insideWorld(car.x, car.y, -80)) {
    const edge = Math.floor(random.next() * 4);
    const xs2 = roadCentersX();
    const ys2 = roadCentersY();
    if (edge === 0) { car.x = xs2[Math.floor(random.next() * xs2.length)]; car.y = 40; car.dir = 1; }
    if (edge === 1) { car.x = xs2[Math.floor(random.next() * xs2.length)]; car.y = WORLD_H - 40; car.dir = 3; }
    if (edge === 2) { car.x = 40; car.y = ys2[Math.floor(random.next() * ys2.length)]; car.dir = 0; }
    if (edge === 3) { car.x = WORLD_W - 40; car.y = ys2[Math.floor(random.next() * ys2.length)]; car.dir = 2; }
    car.speed = 0;
  }
}

function carAhead(car, others) {
  const dx = Math.cos(car.angle);
  const dy = Math.sin(car.angle);
  for (const other of others) {
    if (other === car || !other.alive) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const along = ox * dx + oy * dy;
    const side = Math.abs(ox * -dy + oy * dx);
    if (along > 0 && along < 90 && side < 30) return true;
  }
  return false;
}

/** The player's car: arcade handling, accelerate / brake / reverse / steer. */
export function stepPlayerCar(car, dt, move, city) {
  const forward = move.y < 0 ? 1 : move.y > 0 ? -0.6 : 0;
  const steering = move.x;
  if (forward > 0) car.speed += CAR_ACCEL * dt;
  else if (forward < 0) {
    if (car.speed > 5) car.speed -= CAR_BRAKE * dt;
    else car.speed -= CAR_ACCEL * 0.5 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  }
  car.speed = Math.max(-CAR_REVERSE_MAX, Math.min(CAR_MAX_SPEED, car.speed));
  const turnRate = CAR_TURN * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steering * turnRate * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = city.hitBuilding(nx, ny, CAR_LENGTH / 2 - 4);
  if (hit) {
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.y = ny;
  }
  const m = 30;
  car.x = Math.max(m, Math.min(WORLD_W - m, car.x));
  // The beach is for walking on: cars stop on the sand, short of the water.
  car.y = Math.max(m, Math.min(WORLD_H - 48, car.y));
}

/** Two cars overlap: push them apart and trade a little speed. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const min = CAR_LENGTH * 0.85;
  if (d >= min) return false;
  const push = (min - d) / 2;
  const ux = dx / d;
  const uy = dy / d;
  a.x -= ux * push;
  a.y -= uy * push;
  b.x += ux * push;
  b.y += uy * push;
  const swap = a.speed;
  a.speed = b.speed * 0.5;
  b.speed = swap * 0.5;
  return true;
}

export { CAR_COLORS, CAR_LENGTH, CAR_WIDTH };
