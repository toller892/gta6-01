// Keyboard and mouse, read once a frame. Actions are edge-triggered (pressed this
// frame), movement is level-triggered (held down). The game never reads keys itself.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_RELOAD = 32;
export const ACTION_MUTE = 64;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyE: ACTION_INTERACT,
  KeyF: ACTION_PUNCH,
  KeyR: ACTION_RELOAD,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action !== undefined) pressed.add(action);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onMouseDown(event) {
    mouseDown = true;
    mouseX = event.clientX;
    mouseY = event.clientY;
    pressed.add(ACTION_SHOOT);
  }
  function onMouseUp() {
    mouseDown = false;
  }
  function onMouseMove(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mousemove', onMouseMove);

  /** Held movement keys as a unit-ish vector: x right, y down. */
  function moveVector() {
    let x = 0;
    let y = 0;
    if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
    if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
    if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
    if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  function running() {
    return held.has('ShiftLeft') || held.has('ShiftRight');
  }

  /** True while the named physical key is held down (for hold-to-do actions). */
  function heldKey(code) {
    return held.has(code);
  }

  /** Actions pressed since the last take, as a bitmask; mouse held counts as shoot. */
  function takeActions() {
    let actions = 0;
    for (const action of pressed) actions |= action;
    pressed.clear();
    if (mouseDown) actions |= ACTION_SHOOT;
    return actions;
  }

  function aim() {
    return { x: mouseX, y: mouseY };
  }

  function destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('mousemove', onMouseMove);
  }

  return { moveVector, running, heldKey, takeActions, aim, destroy };
}
