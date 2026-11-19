// Screenshot scenes: each one plays the real game forward from a fresh world
// for a fixed number of steps, steered by a simple autopilot, so the frame is
// what a short session really looks like and the same seed gives the same frame.
// ?shot=title|drive|chase|mission stages the scene, paints it twice and sets
// window.__shotReady for the screenshot tool.
import { STEP } from './config.js';
import { nearestRoadPoint } from './city.js';
import { spawnPoliceCar } from './police.js';
import { SCREEN_MISSION, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

/** Steer the player's car toward the centre line of the road it is on. */
function driveAutopilot(world) {
  const p = world.state.player;
  const car = p.car;
  if (!car) return { x: 0, y: 0, run: false };
  // Aim the car along its current heading, nudged back toward the road centre.
  const aheadX = car.x + Math.cos(car.angle) * 120;
  const aheadY = car.y + Math.sin(car.angle) * 120;
  const near = nearestRoadPoint(aheadX, aheadY);
  const targetAngle = Math.atan2(near.y - car.y, near.x - car.x);
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0;
  return { x: steer, y: -1, run: false };
}

function stepWorld(world, seconds, moveFn, actionsFn) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const move = moveFn ? moveFn(i) : { x: 0, y: 0, run: false };
    const actions = actionsFn ? actionsFn(i) : 0;
    world.step(SAMPLE, move, actions, null, false, null);
    if (world.state.over) break;
  }
}

function putPlayerInCar(world) {
  const p = world.state.player;
  // Stage a real parked car on the mid-city east-west road (y = 880), pointed
  // east: the run ahead is long and straight, so the car stays centred in
  // frame. The steal itself still goes through the real enter path.
  const parked = world.state.parked[0];
  if (!parked) return false;
  parked.x = 220;
  parked.y = 880;
  parked.angle = 0;
  p.x = parked.x + 30;
  p.y = parked.y;
  world.step(SAMPLE, { x: 0, y: 0, run: false }, 4, null, false, null);
  return p.inCar;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Unknown names stage the title.
 */
export function stageShot(name, world) {
  world.reset(false);
  if (name === 'drive') {
    putPlayerInCar(world);
    stepWorld(world, 4, () => driveAutopilot(world));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    putPlayerInCar(world);
    world.state.wanted = 3;
    world.state.wantedTimer = 0;
    stepWorld(world, 4, () => driveAutopilot(world));
    // Bring two police cars up behind the player, so the chase is in frame.
    const p = world.state.player;
    for (let i = 0; i < 2; i += 1) {
      const cop = spawnPoliceCar(null, p);
      cop.x = p.x - 230 - i * 70;
      cop.y = p.y + (i === 0 ? -70 : 70);
      cop.angle = p.angle;
      cop.speed = 300;
      world.state.policeCars.push(cop);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Staged scenes may open any job; real play still unlocks them in order.
    world.state.progress.unlocked = 3;
    world.startMission(1);
    const docks = world.city.landmarks.docks;
    const p = world.state.player;
    p.x = docks.x - 260;
    p.y = docks.y + 40;
    // Walk up to the package, then stand at the marker for the frame.
    stepWorld(world, 1.2, () => ({ x: 1, y: 0, run: false }));
    stepWorld(world, 2.5, () => ({ x: 0, y: 0, run: false }));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission-select') {
    return { screen: SCREEN_MISSION };
  }
  for (let i = 0; i < 5 / SAMPLE; i += 1) world.step(SAMPLE, { x: 0, y: 0, run: false }, 0, null, false, null);
  return { screen: SCREEN_TITLE };
}
