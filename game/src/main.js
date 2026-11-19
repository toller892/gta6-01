// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. Screens: title, mission
// select, play, paused, and busted/wasted. Progress saves on pause, on a job
// done, and when the player is caught or goes down.
//
// ?seed=N fixes the city. ?shot=title|drive|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION_DONE, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_MISSION, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { MISSIONS } from './missions.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  const selected = 0;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, world.city, scene.screen, world.state.best, selected);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = world.state.best;
  let selected = 0;
  let lastNavY = 0;
  let accumulator = 0;
  let last = performance.now();
  let muted = false;

  function announce(message) {
    status.textContent = message;
  }

  function startFreeRoam() {
    world.state.progress.active = -1;
    screen = SCREEN_PLAY;
    audio.resume();
    announce('Free roam. Press Enter for jobs.');
  }

  function startSelectedMission() {
    const mission = MISSIONS[selected];
    if (!mission || selected > world.state.progress.unlocked) return;
    if (world.startMission(selected)) {
      screen = SCREEN_PLAY;
      audio.resume();
      audio.click();
      announce(`${mission.title}. ${mission.brief}`);
    }
  }

  function endRun(kind) {
    screen = SCREEN_OVER;
    world.state.overKind = kind;
    if (kind === 'busted') {
      world.state.money = Math.max(0, world.state.money - 200);
      world.state.player.money = world.state.money;
      audio.busted();
    }
    if (world.state.money > best) best = world.state.money;
    world.save();
    announce(kind === 'busted' ? 'Busted. Press Enter to get back on the streets.' : 'Wasted. Press Enter to get back on the streets.');
  }

  function handleTitleActions(actions) {
    if (actions & ACTION_CONFIRM) {
      audio.resume();
      audio.click();
      selected = 0;
      screen = SCREEN_MISSION;
      announce('Choose a job.');
    }
  }

  function handleMissionActions(actions) {
    if (actions & ACTION_PAUSE) screen = SCREEN_TITLE;
    else if (actions & ACTION_CONFIRM) startSelectedMission();
  }

  function handlePlayActions(actions) {
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      world.save();
      announce('Paused.');
    } else if (actions & ACTION_CONFIRM) {
      screen = SCREEN_MISSION;
      announce('Choose a job.');
    } else if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    let actions = input.takeActions();
    const move = input.moveVector();
    move.run = input.running();
    const interactHeld = input.heldKey('KeyE');

    if (screen === SCREEN_TITLE) handleTitleActions(actions);
    else if (screen === SCREEN_MISSION) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_TITLE;
      } else if (actions & ACTION_CONFIRM) {
        startSelectedMission();
      } else if (move.y !== 0 && move.y !== lastNavY) {
        // Edge-triggered selection: holding the key does not scroll past.
        selected = Math.max(0, Math.min(MISSIONS.length - 1, selected + move.y));
        audio.click();
      }
      lastNavY = move.y;
    } else if (screen === SCREEN_PLAY) handlePlayActions(actions);
    else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        world.reset(true);
        best = world.state.best;
        screen = SCREEN_MISSION;
        announce('Choose a job.');
      }
    }

    if (screen === SCREEN_PLAY) {
      // Mouse aim in world coordinates, for shooting and facing.
      const aim = input.aim();
      const cam = world.state.camera;
      const aimWorld = { x: aim.x + cam.x, y: aim.y + cam.y };
      while (accumulator >= STEP) {
        const events = world.step(STEP, move, actions, aimWorld, interactHeld, audio);
        actions = 0;
        accumulator -= STEP;
        if (events & EVENT_BUSTED) {
          endRun('busted');
          break;
        }
        if (events & EVENT_WASTED) {
          endRun('wasted');
          break;
        }
        if (events & EVENT_MISSION_DONE) {
          audio.missionDone();
          world.save();
          if (world.state.money > best) best = world.state.money;
        }
      }
      // Continuous sounds follow the world.
      const p = world.state.player;
      audio.engine(p.inCar ? Math.abs(p.speed) / 430 : 0, p.inCar);
      audio.siren(STEP, world.state.wanted > 0);
    } else {
      accumulator = 0;
      audio.engine(0, false);
      audio.siren(STEP, false);
    }

    // Mission select navigation lives in the frame handler, edge-triggered.

    renderer.draw(world.state, world.city, screen, best, selected);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      world.save();
      announce('Paused.');
    }
  });

  // Clicking the canvas also starts from the title.
  canvas.addEventListener('mousedown', () => {
    if (screen === SCREEN_TITLE) {
      audio.resume();
      selected = 0;
      screen = SCREEN_MISSION;
    }
  });

  announce('Solmar Heat. Press Enter or click to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
