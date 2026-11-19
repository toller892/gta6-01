// Solmar Heat: every number the game agrees on, in one place.
// The city is a grid of blocks split by roads; the world is measured in pixels.
export const TILE = 64;
export const BLOCK = 320;
export const ROAD = 96;
export const BLOCKS_X = 6;
export const BLOCKS_Y = 6;
export const WORLD_W = BLOCKS_X * BLOCK + (BLOCKS_X + 1) * ROAD;
export const WORLD_H = BLOCKS_Y * BLOCK + (BLOCKS_Y + 1) * ROAD;
export const STEP = 1 / 60;

export const PLAYER_WALK = 175;
export const PLAYER_RUN = 265;
export const PLAYER_RADIUS = 13;
export const PLAYER_HEALTH = 100;

export const CAR_LENGTH = 52;
export const CAR_WIDTH = 26;
export const CAR_ACCEL = 340;
export const CAR_BRAKE = 520;
export const CAR_MAX_SPEED = 430;
export const CAR_REVERSE_MAX = 150;
export const CAR_TURN = 2.6;

export const WANTED_DECAY_SECONDS = 22;
export const MAX_WANTED = 5;

export const SAVE_KEY = 'solmar-heat-save-v1';
export const BEST_KEY = 'solmar-heat-best-v1';

// Sun-soaked coastal palette: warm asphalt, pale sidewalks, bright rooftops.
export const COLORS = {
  grass: '#7fb069',
  sand: '#e8d8a0',
  water: '#3d9db5',
  road: '#3a3f4a',
  roadLine: '#e8d44d',
  sidewalk: '#b9b3a4',
  buildingRoof: ['#c96f4a', '#4a7fb5', '#b5a44a', '#7a5a9e', '#4a9e7f', '#b5526e', '#8a6d4b', '#5a7a8c'],
  buildingEdge: '#2c2c34',
  park: '#5d9e52',
  tree: '#3f7a37',
  player: '#ffd23f',
  playerCar: '#e63946',
  police: '#1d3557',
  ped: ['#f4a261', '#e76f51', '#2a9d8f', '#e9c46a', '#6d6875', '#8ab17d'],
  blood: '#a4133c',
};

// Mission money and names; the story is told in missions.js.
export const MISSION_REWARDS = [300, 500, 800, 2500];
