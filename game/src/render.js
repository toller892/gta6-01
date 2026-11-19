// The renderer: everything the player sees. Top-down Solmar — roads, blocks,
// buildings with rooftop shading, parks, the beach, the cars and the crowd —
// plus the HUD: health, money, wanted stars, ammo, the objective banner and a
// live minimap. Screens are drawn here too: title, pause, busted, wasted.
import { BLOCK, BLOCKS_X, BLOCKS_Y, CAR_LENGTH, CAR_WIDTH, COLORS, ROAD, WORLD_H, WORLD_W } from './config.js';
import { roadCentersX, roadCentersY } from './city.js';
import { MISSIONS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_MISSION = 'mission';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function view() {
    return { w: canvas.clientWidth, h: canvas.clientHeight };
  }

  function drawCity(state, city, cam, vw, vh) {
    // Ground.
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, vw, vh);
    // Beach and water along the south edge.
    const beachY = WORLD_H - 90 - cam.y;
    if (beachY < vh) {
      ctx.fillStyle = COLORS.sand;
      ctx.fillRect(0, Math.max(0, beachY), vw, vh - Math.max(0, beachY));
      ctx.fillStyle = COLORS.water;
      ctx.fillRect(0, Math.max(0, beachY + 55), vw, vh - Math.max(0, beachY + 55));
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let x = 0; x < vw; x += 90) {
        const wave = Math.sin((x + state.time * 40) * 0.02) * 3;
        ctx.fillRect(x, beachY + 58 + wave, 46, 2);
      }
    }
    // Roads.
    ctx.fillStyle = COLORS.road;
    for (const c of roadCentersX()) {
      const x = c - ROAD / 2 - cam.x;
      if (x < vw && x + ROAD > 0) ctx.fillRect(x, -cam.y, ROAD, WORLD_H);
    }
    for (const c of roadCentersY()) {
      const y = c - ROAD / 2 - cam.y;
      if (y < vh && y + ROAD > 0) ctx.fillRect(-cam.x, y, WORLD_W, ROAD);
    }
    // Sidewalks: pale strips along every road.
    ctx.fillStyle = COLORS.sidewalk;
    for (const c of roadCentersX()) {
      const x = c - ROAD / 2 - 10 - cam.x;
      if (x < vw && x + ROAD + 20 > 0) {
        ctx.fillRect(x, -cam.y, 10, WORLD_H);
        ctx.fillRect(x + ROAD + 10, -cam.y, 10, WORLD_H);
      }
    }
    for (const c of roadCentersY()) {
      const y = c - ROAD / 2 - 10 - cam.y;
      if (y < vh && y + ROAD + 20 > 0) {
        ctx.fillRect(-cam.x, y, WORLD_W, 10);
        ctx.fillRect(-cam.x, y + ROAD + 10, WORLD_W, 10);
      }
    }
    // Centre dashes.
    ctx.fillStyle = COLORS.roadLine;
    for (const c of roadCentersX()) {
      const x = c - cam.x;
      if (x < -4 || x > vw + 4) continue;
      for (let y = -cam.y; y < WORLD_H - cam.y; y += 56) ctx.fillRect(x - 2, y, 4, 28);
    }
    for (const c of roadCentersY()) {
      const y = c - cam.y;
      if (y < -4 || y > vh + 4) continue;
      for (let x = -cam.x; x < WORLD_W - cam.x; x += 56) ctx.fillRect(x, y - 2, 28, 4);
    }
    // Parks.
    for (const park of city.parks) {
      const x = park.x - cam.x;
      const y = park.y - cam.y;
      if (x > vw || y > vh || x + park.w < 0 || y + park.h < 0) continue;
      ctx.fillStyle = COLORS.park;
      ctx.fillRect(x, y, park.w, park.h);
    }
    // Buildings: roof, edge, and a shaded side so they read as blocks.
    for (const b of city.buildings) {
      const x = b.x - cam.x;
      const y = b.y - cam.y;
      if (x > vw || y > vh || x + b.w < 0 || y + b.h < 0) continue;
      const lift = b.height * 7;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 6, y + 6 + lift, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y, b.w, b.h);
      ctx.strokeStyle = COLORS.buildingEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, b.w - 2, b.h - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + 8, y + 8, b.w - 16, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      for (let wy = y + 34; wy < y + b.h - 12; wy += 30) {
        for (let wx = x + 14; wx < x + b.w - 14; wx += 34) ctx.fillRect(wx, wy, 16, 12);
      }
    }
    // Trees.
    for (const t of city.trees) {
      const x = t.x - cam.x;
      const y = t.y - cam.y;
      if (x < -20 || y < -20 || x > vw + 20 || y > vh + 20) continue;
      ctx.fillStyle = COLORS.tree;
      ctx.beginPath();
      ctx.arc(x, y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(x - t.r * 0.3, y - t.r * 0.3, t.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    // Landmark labels.
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const key of Object.keys(city.landmarks)) {
      const lm = city.landmarks[key];
      const x = lm.x - cam.x;
      const y = lm.y - cam.y;
      if (x < -80 || y < -20 || x > vw + 80 || y > vh + 20) continue;
      ctx.fillStyle = 'rgba(20,20,30,0.65)';
      const w = ctx.measureText(lm.label).width + 16;
      ctx.fillRect(x - w / 2, y - 24, w, 20);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(lm.label, x, y - 10);
    }
  }

  function drawCarShape(x, y, angle, color, police) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-CAR_LENGTH / 2 + 3, -CAR_WIDTH / 2 + 3, CAR_LENGTH, CAR_WIDTH);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-CAR_LENGTH / 2 + 8, -CAR_WIDTH / 2 + 3, 14, CAR_WIDTH - 6);
    ctx.fillStyle = '#1d3557';
    ctx.fillRect(-6, -CAR_WIDTH / 2 + 4, 16, CAR_WIDTH - 8);
    if (police) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-CAR_LENGTH / 2 + 2, -CAR_WIDTH / 2 + 2, 10, 5);
      ctx.fillStyle = '#e63946';
      ctx.fillRect(-CAR_LENGTH / 2 + 2, CAR_WIDTH / 2 - 7, 10, 5);
    }
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(CAR_LENGTH / 2 - 3, -CAR_WIDTH / 2 + 3, 3, 6);
    ctx.fillRect(CAR_LENGTH / 2 - 3, CAR_WIDTH / 2 - 9, 3, 6);
    ctx.restore();
  }

  function drawPersonShape(x, y, angle, color, walkPhase, isPlayer) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const bob = Math.sin(walkPhase || 0) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 2, 11, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(4 + bob * 0.3, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    if (isPlayer) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEntities(state, city, cam) {
    // Pickups: cash as a green bill, health as a white cross.
    for (const pk of state.pickups) {
      if (!pk.alive) continue;
      const x = pk.x - cam.x;
      const y = pk.y - cam.y + Math.sin(pk.bob) * 3;
      ctx.save();
      ctx.translate(x, y);
      if (pk.kind === 'cash') {
        ctx.fillStyle = '#2a9d8f';
        ctx.fillRect(-10, -6, 20, 12);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', 0, 4);
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = '#e63946';
        ctx.fillRect(-2, -7, 4, 14);
        ctx.fillRect(-7, -2, 14, 4);
      }
      ctx.restore();
    }
    for (const car of state.parked) {
      if (car.kind === 'player') continue;
      drawCarShape(car.x - cam.x, car.y - cam.y, car.angle, car.color, false);
    }
    for (const car of state.cars) drawCarShape(car.x - cam.x, car.y - cam.y, car.angle, car.color, false);
    for (const cop of state.policeCars) drawCarShape(cop.x - cam.x, cop.y - cam.y, cop.angle, cop.color, true);
    for (const ped of state.peds) {
      if (!ped.alive) continue;
      drawPersonShape(ped.x - cam.x, ped.y - cam.y, ped.angle, ped.color, ped.walkPhase, false);
    }
    for (const cop of state.cops) {
      if (!cop.alive) continue;
      drawPersonShape(cop.x - cam.x, cop.y - cam.y, cop.angle, '#1d3557', state.time * 8, false);
      if (cop.arrest > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(cop.x - cam.x - 18, cop.y - cam.y - 30, 36, 6);
        ctx.fillStyle = '#e63946';
        ctx.fillRect(cop.x - cam.x - 17, cop.y - cam.y - 29, 34 * (cop.arrest / 1.4), 4);
      }
    }
    for (const e of state.enemies) {
      if (!e.alive) continue;
      drawPersonShape(e.x - cam.x, e.y - cam.y, e.angle, '#7a1f2b', state.time * 8, false);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - cam.x - 16, e.y - cam.y - 28, 32, 5);
      ctx.fillStyle = '#e63946';
      ctx.fillRect(e.x - cam.x - 15, e.y - cam.y - 27, 30 * (e.health / 40), 3);
    }
    const p = state.player;
    if (p.inCar && p.car) {
      drawCarShape(p.car.x - cam.x, p.car.y - cam.y, p.car.angle, p.car.color, false);
      // Headlight cone ahead of the player's car.
      ctx.save();
      ctx.translate(p.car.x - cam.x, p.car.y - cam.y);
      ctx.rotate(p.car.angle);
      const grad = ctx.createLinearGradient(0, 0, 190, 0);
      grad.addColorStop(0, 'rgba(255,240,170,0.28)');
      grad.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(20, -8);
      ctx.lineTo(190, -46);
      ctx.lineTo(190, 46);
      ctx.lineTo(20, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      drawPersonShape(p.x - cam.x, p.y - cam.y, p.angle, COLORS.player, state.time * 8, true);
      // Aim line and crosshair when armed.
      if (p.mag > 0 || p.weapon) {
        const ax = p.x - cam.x + Math.cos(p.angle) * 30;
        const ay = p.y - cam.y + Math.sin(p.angle) * 30;
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ax, ay, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax - 11, ay);
        ctx.lineTo(ax - 4, ay);
        ctx.moveTo(ax + 4, ay);
        ctx.lineTo(ax + 11, ay);
        ctx.moveTo(ax, ay - 11);
        ctx.lineTo(ax, ay - 4);
        ctx.moveTo(ax, ay + 4);
        ctx.lineTo(ax, ay + 11);
        ctx.stroke();
      }
    }
    // Bullets as bright tracers.
    for (const b of state.bullets) {
      if (!b.alive) continue;
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - cam.x - Math.cos(b.angle) * 10, b.y - cam.y - Math.sin(b.angle) * 10);
      ctx.lineTo(b.x - cam.x, b.y - cam.y);
      ctx.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - cam.x - pt.size / 2, pt.y - cam.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    // Mission objective marker: a bouncing diamond over the target.
    const progress = state.progress;
    if (progress.active >= 0) {
      const mission = MISSIONS[progress.active];
      const stepDef = mission.steps[progress.step];
      if (stepDef && stepDef.target) {
        const lm = city.landmarks[stepDef.target];
        const mx = lm.x - cam.x;
        const my = lm.y - cam.y - 30 + Math.sin(state.time * 4) * 6;
        ctx.fillStyle = '#ffd23f';
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-9, -9, 18, 18);
        ctx.restore();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', mx, my + 4);
        // A faint guide line from the player to the marker.
        ctx.strokeStyle = 'rgba(255,210,63,0.35)';
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(p.x - cam.x, p.y - cam.y);
        ctx.lineTo(lm.x - cam.x, lm.y - cam.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function drawMinimap(state, city, vw, vh) {
    const size = 190;
    const x0 = vw - size - 14;
    const y0 = vh - size - 14;
    const scale = size / WORLD_W;
    ctx.fillStyle = 'rgba(10,14,20,0.82)';
    ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();
    ctx.fillStyle = '#5d9e52';
    ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = '#3a3f4a';
    for (const c of roadCentersX()) ctx.fillRect(x0 + (c - ROAD / 2) * scale, y0, ROAD * scale, size);
    for (const c of roadCentersY()) ctx.fillRect(x0, y0 + (c - ROAD / 2) * scale, size, ROAD * scale);
    ctx.fillStyle = '#3d9db5';
    ctx.fillRect(x0, y0 + (WORLD_H - 90) * scale, size, 90 * scale);
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(20,20,30,0.55)';
      ctx.fillRect(x0 + b.x * scale, y0 + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
    }
    const progress = state.progress;
    if (progress.active >= 0) {
      const mission = MISSIONS[progress.active];
      const stepDef = mission.steps[progress.step];
      if (stepDef && stepDef.target) {
        const lm = city.landmarks[stepDef.target];
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(x0 + lm.x * scale, y0 + lm.y * scale, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const cop of state.policeCars) {
      ctx.fillStyle = '#4a90e2';
      ctx.beginPath();
      ctx.arc(x0 + cop.x * scale, y0 + cop.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = state.player;
    ctx.fillStyle = p.inCar ? '#e63946' : '#ffd23f';
    ctx.beginPath();
    ctx.arc(x0 + p.x * scale, y0 + p.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR', x0, y0 - 8);
  }

  function drawHud(state, city, vw, vh) {
    const p = state.player;
    // Health bar and money, top left.
    ctx.fillStyle = 'rgba(10,14,20,0.75)';
    ctx.fillRect(12, 12, 220, 64);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${state.money}`, 24, 36);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(24, 46, 160, 12);
    ctx.fillStyle = p.health > 30 ? '#2a9d8f' : '#e63946';
    ctx.fillRect(24, 46, 160 * (p.health / 100), 12);
    ctx.fillStyle = '#fff';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`${Math.ceil(p.health)} HP`, 190, 56);
    // Ammo, below the health box.
    ctx.fillStyle = 'rgba(10,14,20,0.75)';
    ctx.fillRect(12, 84, 110, 30);
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(p.inCar ? 'DRIVING' : `AMMO ${p.mag} / ${p.reserve}`, 22, 104);
    // Wanted stars, top right.
    ctx.fillStyle = 'rgba(10,14,20,0.75)';
    const starsW = 34 * 5 + 20;
    ctx.fillRect(vw - starsW - 12, 12, starsW, 40);
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < state.wanted ? '#ffd23f' : 'rgba(255,255,255,0.25)';
      drawStar(vw - starsW + 10 + i * 34, 32, 12);
    }
    // Objective banner, top centre.
    const progress = state.progress;
    if (progress.active >= 0) {
      const mission = MISSIONS[progress.active];
      const stepDef = mission.steps[progress.step];
      const text = stepDef ? stepDef.text : mission.title;
      ctx.font = 'bold 14px system-ui, sans-serif';
      const w = ctx.measureText(text).width + 28;
      ctx.fillStyle = 'rgba(10,14,20,0.75)';
      ctx.fillRect((vw - w) / 2, 12, w, 34);
      ctx.fillStyle = '#ffd23f';
      ctx.textAlign = 'center';
      ctx.fillText(`${mission.title} — ${text}`, vw / 2, 34);
      if (stepDef && stepDef.kind === 'survive') {
        const left = Math.max(0, Math.ceil(stepDef.seconds - progress.surviveTime));
        ctx.fillStyle = '#fff';
        ctx.fillText(`Survive: ${left}s`, vw / 2, 62);
      }
      if (stepDef && stepDef.kind === 'hold' && progress.holdTime > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect((vw - 200) / 2, 52, 200, 8);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect((vw - 200) / 2, 52, 200 * (progress.holdTime / stepDef.seconds), 8);
      }
    } else if (progress.completed.length > 0) {
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.fillText('Free roam — press Enter for missions', vw / 2, 30);
    }
    // Toast, bottom centre above the minimap.
    if (state.toast) {
      ctx.font = 'bold 15px system-ui, sans-serif';
      const w = ctx.measureText(state.toast).width + 28;
      ctx.fillStyle = 'rgba(10,14,20,0.8)';
      ctx.fillRect((vw - w) / 2, vh - 52, w, 32);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(state.toast, vw / 2, vh - 31);
    }
    // Hurt vignette.
    if (p.hurtTimer > 0) {
      ctx.fillStyle = `rgba(230,57,70,${(p.hurtTimer / 0.4) * 0.25})`;
      ctx.fillRect(0, 0, vw, vh);
    }
    // Controls hint, bottom left.
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('WASD move/drive · E enter car · Click shoot · F punch · R reload · Shift run · P pause · M mute', 14, vh - 14);
    drawMinimap(state, city, vw, vh);
  }

  function drawStar(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const x = cx + Math.cos(angle) * rad;
      const y = cy + Math.sin(angle) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawTitle(state, best) {
    const vw = canvas.clientWidth;
    const vh = canvas.clientHeight;
    const grad = ctx.createLinearGradient(0, 0, 0, vh);
    grad.addColorStop(0, '#ff9e5e');
    grad.addColorStop(0.55, '#e63946');
    grad.addColorStop(1, '#1d3557');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vw, vh);
    // Sun.
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(vw * 0.78, vh * 0.2, 64, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,224,102,0.35)';
    ctx.beginPath();
    ctx.arc(vw * 0.78, vh * 0.2, 92, 0, Math.PI * 2);
    ctx.fill();
    // Skyline silhouette.
    ctx.fillStyle = 'rgba(20,20,40,0.85)';
    let x = 0;
    const heights = [120, 200, 150, 260, 180, 300, 210, 160, 240, 130];
    for (let i = 0; i < heights.length; i += 1) {
      const w = vw / heights.length;
      ctx.fillRect(x, vh - 190 - heights[i] * 0.5, w - 8, heights[i] * 0.5 + 190);
      x += w;
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText('SOLMAR HEAT', vw / 2, vh * 0.3);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('An open-world crime story in the sun', vw / 2, vh * 0.3 + 44);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('Steal cars. Outrun the law. Finish the jobs Mara Voss sends you.', vw / 2, vh * 0.3 + 78);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('Press ENTER or click to play', vw / 2, vh * 0.62);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('WASD move / drive · E enter or steal a car · Click to shoot · F punch · R reload', vw / 2, vh * 0.62 + 32);
    ctx.fillText('Shift run · P pause · M mute · progress saves automatically', vw / 2, vh * 0.62 + 58);
    if (best > 0) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(`Best haul so far: $${best}`, vw / 2, vh * 0.62 + 92);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('A wholly original game. No real city, person or brand appears in it.', vw / 2, vh - 18);
  }

  function drawMissionSelect(state, selected) {
    const vw = canvas.clientWidth;
    const vh = canvas.clientHeight;
    ctx.fillStyle = 'rgba(10,14,20,0.88)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('JOBS FROM MARA VOSS', vw / 2, 90);
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Pick a job. Finish it, get paid, unlock the next one. Esc goes back.', vw / 2, 122);
    const progress = state.progress;
    const cardW = Math.min(720, vw - 80);
    const cardH = 92;
    const gap = 16;
    const top = 160;
    MISSIONS.forEach((m, i) => {
      const y = top + i * (cardH + gap);
      const locked = i > progress.unlocked;
      const done = progress.completed.includes(i);
      ctx.fillStyle = i === selected ? 'rgba(255,210,63,0.2)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect((vw - cardW) / 2, y, cardW, cardH);
      ctx.strokeStyle = i === selected ? '#ffd23f' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect((vw - cardW) / 2, y, cardW, cardH);
      ctx.textAlign = 'left';
      ctx.fillStyle = locked ? 'rgba(255,255,255,0.4)' : '#fff';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.fillText(`${i + 1}. ${m.title}`, (vw - cardW) / 2 + 20, y + 32);
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = locked ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.8)';
      ctx.fillText(locked ? 'Locked — finish the job above it.' : m.brief, (vw - cardW) / 2 + 20, y + 58);
      ctx.textAlign = 'right';
      ctx.fillStyle = done ? '#2a9d8f' : '#ffd23f';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(done ? 'DONE' : `$${m.reward}`, (vw - cardW) / 2 + cardW - 20, y + 32);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('Up / Down to choose · Enter to start · F for free roam', vw / 2, top + MISSIONS.length * (cardH + gap) + 20);
  }

  function drawOver(state, kind) {
    const vw = canvas.clientWidth;
    const vh = canvas.clientHeight;
    ctx.fillStyle = 'rgba(10,10,16,0.82)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = kind === 'busted' ? '#4a90e2' : '#e63946';
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', vw / 2, vh * 0.4);
    ctx.fillStyle = '#fff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(
      kind === 'busted'
        ? 'The Solmar PD caught up with you. Bail is $200 — the city keeps the rest.'
        : 'Rico went down in the streets of Solmar. The city does not wait.',
      vw / 2, vh * 0.4 + 44,
    );
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`Money kept: $${state.money}`, vw / 2, vh * 0.4 + 84);
    ctx.fillStyle = '#fff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('Press ENTER to get back on the streets', vw / 2, vh * 0.4 + 124);
  }

  function drawPaused() {
    const vw = canvas.clientWidth;
    const vh = canvas.clientHeight;
    ctx.fillStyle = 'rgba(10,14,20,0.7)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('PAUSED', vw / 2, vh / 2 - 10);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('P or Esc to resume · your progress is saved', vw / 2, vh / 2 + 30);
  }

  function draw(state, city, screen, best, selected) {
    resize();
    const { w: vw, h: vh } = view();
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    if (screen === SCREEN_MISSION) {
      drawMissionSelect(state, selected);
      return;
    }
    // The camera follows the player and fits whatever window the game is in.
    const cam = {
      x: Math.max(0, Math.min(WORLD_W - vw, state.player.x - vw / 2)),
      y: Math.max(0, Math.min(WORLD_H - vh, state.player.y - vh / 2)),
    };
    drawCity(state, city, cam, vw, vh);
    drawEntities(state, city, cam);
    drawHud(state, city, vw, vh);
    if (screen === SCREEN_OVER) drawOver(state, state.overKind);
    if (screen === SCREEN_PAUSED) drawPaused();
  }

  return { draw, resize, drawCarShape };
}
