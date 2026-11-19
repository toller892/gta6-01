// Save and load: one localStorage slot. The save holds the player's money,
// health, ammo, mission progress and where they stood; the wanted level is
// never saved — a fresh session starts clean, as if the heat cooled overnight.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      health: state.health,
      ammo: state.ammo,
      mag: state.mag,
      reserve: state.reserve,
      x: Math.round(state.x),
      y: Math.round(state.y),
      completed: state.progress.completed,
      unlocked: state.progress.unlocked,
      best: state.best,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || !Array.isArray(data.completed)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}
