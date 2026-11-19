// The story: Rico Santana, wheelman for hire in Solmar, takes jobs from Mara
// Voss and ends up owing the city a favour. Four missions, unlocked in order,
// each a small state machine: go somewhere, do the thing, get out. Free roam
// is always there between jobs.
import { MISSION_REWARDS } from './config.js';

export const MISSIONS = [
  {
    id: 'wheels',
    title: 'Wheels for Lou',
    giver: 'Mara Voss',
    brief: "Lou needs a ride and he does not ask where it came from. Steal any car and bring it to Lou's Garage.",
    steps: [
      { kind: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { kind: 'goto', target: 'garage', text: "Drive it to Lou's Garage" },
    ],
    reward: MISSION_REWARDS[0],
  },
  {
    id: 'pickup',
    title: 'The Harbor Pickup',
    giver: 'Mara Voss',
    brief: 'A package is waiting at the Solmar Docks. Pick it up and bring it back to my place. No questions, no cops.',
    steps: [
      { kind: 'goto', target: 'docks', text: 'Reach the Solmar Docks' },
      { kind: 'hold', target: 'docks', seconds: 2, text: 'Grab the package (hold E)' },
      { kind: 'goto', target: 'mara', text: "Bring the package to Mara's Place" },
    ],
    reward: MISSION_REWARDS[1],
  },
  {
    id: 'heat',
    title: 'Heat Wave',
    giver: 'Mara Voss',
    brief: 'The harbor job rattled a cage. The cops want a word. Lose them and get to the safehouse — do not get caught.',
    steps: [
      { kind: 'survive', seconds: 60, wanted: 3, text: 'Survive the heat for 60 seconds' },
      { kind: 'goto', target: 'safehouse', text: 'Reach the Safehouse' },
    ],
    reward: MISSION_REWARDS[2],
  },
  {
    id: 'job',
    title: 'The Marisol Job',
    giver: 'Mara Voss',
    brief: 'One last job and we are square. Marisol Bank keeps its cash behind a glass door. Take it, and do not stop running until the safehouse.',
    steps: [
      { kind: 'goto', target: 'bank', text: 'Reach Marisol Bank' },
      { kind: 'hold', target: 'bank', seconds: 3, text: 'Crack the vault (hold E) — guards will come' },
      { kind: 'goto', target: 'safehouse', text: 'Escape to the Safehouse' },
    ],
    reward: MISSION_REWARDS[3],
  },
];

/** Fresh mission progress: nothing done, first job open, free roam available. */
export function freshProgress() {
  return { completed: [], unlocked: 0, active: -1, step: 0, holdTime: 0, surviveTime: 0 };
}

export function missionByIndex(index) {
  return MISSIONS[index] || null;
}

export function nextUnlocked(progress) {
  return Math.min(progress.unlocked, MISSIONS.length - 1);
}

/** Mark a mission complete: it joins completed, the next one unlocks. */
export function completeMission(progress, index) {
  if (!progress.completed.includes(index)) progress.completed.push(index);
  progress.unlocked = Math.min(MISSIONS.length - 1, Math.max(progress.unlocked, index + 1));
  progress.active = -1;
  progress.step = 0;
  progress.holdTime = 0;
  progress.surviveTime = 0;
}

export function allMissionsDone(progress) {
  return progress.completed.length >= MISSIONS.length;
}
