// Combat: fists up close, a pistol at range, and the enemies who shoot back.
// Bullets are simple projectiles with a short life; melee is a forward arc.
// Damage numbers, knockback and muzzle flashes live here, not in the renderer.
export function makeBullet(x, y, angle, fromPlayer, damage) {
  return { x, y, angle, speed: 720, life: 0.9, fromPlayer, damage: damage || 25, alive: true };
}

export function makeEnemy(x, y, kind, health) {
  return {
    x, y, angle: 0, kind: kind || 'guard', health: health || 40, alive: true,
    shootTimer: 1 + Math.random(), speed: 120, radius: 13,
  };
}

/** Step every bullet; returns hits as {bullet, target} pairs for the world to apply. */
export function stepBullets(bullets, dt, city, targets) {
  const hits = [];
  for (const b of bullets) {
    if (!b.alive) continue;
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    if (b.life <= 0 || city.hitBuilding(b.x, b.y, 2)) {
      b.alive = false;
      continue;
    }
    for (const t of targets) {
      if (!t.alive) continue;
      const d = Math.hypot(t.x - b.x, t.y - b.y);
      if (d < (t.radius || 13) + 4) {
        b.alive = false;
        hits.push({ bullet: b, target: t });
        break;
      }
    }
  }
  return hits;
}

/** Melee: everything hostile within range and in front of the attacker takes a hit. */
export function meleeHit(attacker, range, arc, targets) {
  const hit = [];
  for (const t of targets) {
    if (!t.alive || t === attacker) continue;
    const dx = t.x - attacker.x;
    const dy = t.y - attacker.y;
    const d = Math.hypot(dx, dy);
    if (d > range + (t.radius || 13)) continue;
    let diff = Math.atan2(dy, dx) - attacker.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < arc / 2) hit.push(t);
  }
  return hit;
}

/** An armed enemy strafes toward the player and fires when it has a line of fire. */
export function stepEnemy(enemy, dt, player, city, fireBullet) {
  if (!enemy.alive) return;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  enemy.angle = Math.atan2(dy, dx);
  if (dist > 260) {
    const nx = enemy.x + Math.cos(enemy.angle) * enemy.speed * dt;
    const ny = enemy.y + Math.sin(enemy.angle) * enemy.speed * dt;
    const fixed = city.resolveCircle(nx, ny, enemy.radius);
    enemy.x = fixed.x;
    enemy.y = fixed.y;
  } else if (dist < 140) {
    const nx = enemy.x - Math.cos(enemy.angle) * enemy.speed * 0.5 * dt;
    const ny = enemy.y - Math.sin(enemy.angle) * enemy.speed * 0.5 * dt;
    const fixed = city.resolveCircle(nx, ny, enemy.radius);
    enemy.x = fixed.x;
    enemy.y = fixed.y;
  }
  enemy.shootTimer -= dt;
  if (enemy.shootTimer <= 0 && dist < 420) {
    enemy.shootTimer = 1.1 + Math.random() * 0.9;
    const spread = (Math.random() - 0.5) * 0.22;
    // Muzzle ahead of the shooter, so the bullet never hits its own gunman.
    const mx = enemy.x + Math.cos(enemy.angle) * 22;
    const my = enemy.y + Math.sin(enemy.angle) * 22;
    fireBullet(mx, my, enemy.angle + spread, false, 8);
  }
}
