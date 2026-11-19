// The city of Solmar: a road grid, the blocks between the roads, and everything
// placed in them. Roads are strips; blocks hold buildings, parks, the beach along
// the south edge and the docks along the east edge. All queries are pure geometry.
import { BLOCK, BLOCKS_X, BLOCKS_Y, COLORS, ROAD, WORLD_H, WORLD_W } from './config.js';

export function roadCentersX() {
  const centers = [];
  for (let i = 0; i <= BLOCKS_X; i += 1) centers.push(i * (BLOCK + ROAD) + ROAD / 2);
  return centers;
}

export function roadCentersY() {
  const centers = [];
  for (let i = 0; i <= BLOCKS_Y; i += 1) centers.push(i * (BLOCK + ROAD) + ROAD / 2);
  return centers;
}

/** True when the point is on a road strip (not inside a block). */
export function onRoad(x, y) {
  const inXRoad = roadCentersX().some((c) => Math.abs(x - c) <= ROAD / 2);
  const inYRoad = roadCentersY().some((c) => Math.abs(y - c) <= ROAD / 2);
  return inXRoad || inYRoad;
}

/** Nearest point on the road network, for snapping spawns and walkers. */
export function nearestRoadPoint(x, y) {
  const xs = roadCentersX();
  const ys = roadCentersY();
  let bestX = xs[0];
  let bestY = ys[0];
  for (const c of xs) if (Math.abs(c - x) < Math.abs(bestX - x)) bestX = c;
  for (const c of ys) if (Math.abs(c - y) < Math.abs(bestY - y)) bestY = c;
  const dx = Math.abs(bestX - x);
  const dy = Math.abs(bestY - y);
  if (dx < dy) return { x: bestX, y, vertical: true };
  return { x, y: bestY, vertical: false };
}

export function createCity(random) {
  const buildings = [];
  const parks = [];
  const trees = [];
  const landmarks = {};
  const xs = roadCentersX();
  const ys = roadCentersY();

  for (let bx = 0; bx < BLOCKS_X; bx += 1) {
    for (let by = 0; by < BLOCKS_Y; by += 1) {
      const x0 = xs[bx] + ROAD / 2 + 8;
      const y0 = ys[by] + ROAD / 2 + 8;
      const w = BLOCK - 16;
      const h = BLOCK - 16;
      const roll = random.next();
      if (roll < 0.16) {
        // A park: grass, trees, a path.
        parks.push({ x: x0, y: y0, w, h });
        const count = random.int(5, 9);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: random.range(x0 + 20, x0 + w - 20), y: random.range(y0 + 20, y0 + h - 20), r: random.range(10, 18) });
        }
        continue;
      }
      // One or two buildings per block, with a gap between them.
      const split = random.chance(0.55);
      const color = random.pick(COLORS.buildingRoof);
      if (!split) {
        buildings.push({ x: x0 + 24, y: y0 + 24, w: w - 48, h: h - 48, color, height: random.int(1, 3) });
      } else if (random.chance(0.5)) {
        buildings.push({ x: x0 + 16, y: y0 + 16, w: w / 2 - 24, h: h - 32, color, height: random.int(1, 3) });
        buildings.push({ x: x0 + w / 2 + 8, y: y0 + 16, w: w / 2 - 24, h: h - 32, color: random.pick(COLORS.buildingRoof), height: random.int(1, 3) });
      } else {
        buildings.push({ x: x0 + 16, y: y0 + 16, w: w - 32, h: h / 2 - 24, color, height: random.int(1, 3) });
        buildings.push({ x: x0 + 16, y: y0 + h / 2 + 8, w: w - 32, h: h / 2 - 24, color: random.pick(COLORS.buildingRoof), height: random.int(1, 3) });
      }
    }
  }

  // Landmarks sit on fixed road corners so missions always find them.
  landmarks.garage = { x: xs[1], y: ys[1], label: "Lou's Garage" };
  landmarks.mara = { x: xs[4], y: ys[1], label: "Mara's Place" };
  landmarks.docks = { x: xs[6] - 30, y: ys[3], label: 'Solmar Docks' };
  landmarks.bank = { x: xs[3], y: ys[4], label: 'Marisol Bank' };
  landmarks.safehouse = { x: xs[1], y: ys[5], label: 'Safehouse' };
  landmarks.beach = { x: xs[3], y: WORLD_H - 40, label: 'Solmar Beach' };

  /** Circle vs building test; returns the building hit, or null. */
  function hitBuilding(x, y, radius) {
    for (const b of buildings) {
      if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return b;
    }
    return null;
  }

  /** Push a circle out of any building it overlaps. Returns true when it moved. */
  function resolveCircle(x, y, radius) {
    const b = hitBuilding(x, y, radius);
    if (!b) return { x, y, moved: false };
    const pushLeft = x + radius - b.x;
    const pushRight = b.x + b.w - (x - radius);
    const pushUp = y + radius - b.y;
    const pushDown = b.y + b.h - (y - radius);
    const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
    if (min === pushLeft) return { x: b.x - radius, y, moved: true };
    if (min === pushRight) return { x: b.x + b.w + radius, y, moved: true };
    if (min === pushUp) return { x, y: b.y - radius, moved: true };
    return { x, y: b.y + b.h + radius, moved: true };
  }

  function insideWorld(x, y, margin) {
    return x >= margin && x <= WORLD_W - margin && y >= margin && y <= WORLD_H - margin;
  }

  return { buildings, parks, trees, landmarks, hitBuilding, resolveCircle, insideWorld };
}
