// LUMEN DEEP's rules and state, with no drawing and no browser in it: the lanternfish,
// its light, the things that hunt in the dark, the waves, the upgrades and the boss.
// step() advances one fixed step and returns what happened as bit flags, so the caller
// can react (sound, shake, screens) without the world knowing about them.
// Nothing here allocates after createWorld returns, except a wave's spawn queue.

import { ENERGY, ENEMIES, FIELD, GLOB, ORB, PLAYER, POOL, WIN_WAVE } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_ORB = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_WAVE_CLEAR = 32;
export const EVENT_BOSS = 64;
export const EVENT_SHOOT = 128;

export const UPGRADES = [
  { id: 'fins', name: 'Swift Fins', desc: '+15% swim speed', apply: (p) => { p.speed *= 1.15; } },
  { id: 'lantern', name: 'Bright Lantern', desc: '+25% light radius', apply: (p) => { p.lightBonus += 60; } },
  { id: 'rapid', name: 'Rapid Pulse', desc: '+20% fire rate', apply: (p) => { p.fireInterval *= 0.83; } },
  { id: 'heavy', name: 'Heavy Bolt', desc: '+1 bolt damage', apply: (p) => { p.damage += 1; } },
  { id: 'pierce', name: 'Piercing Light', desc: 'Bolts pierce +1 enemy', apply: (p) => { p.pierce += 1; } },
  { id: 'heart', name: 'Deep Heart', desc: '+1 max life, heal 1', apply: (p) => { p.maxLives = Math.min(6, p.maxLives + 1); p.lives = Math.min(p.maxLives, p.lives + 1); } },
  { id: 'magnet', name: 'Orb Magnet', desc: 'Pickup radius x2', apply: (p) => { p.magnet *= 2; } },
  { id: 'aegis', name: 'Aegis Glow', desc: 'A shield blocks one hit each wave', apply: (p) => { p.shield = true; } },
];

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: 0, y: 0, angle: 0, lives: PLAYER.lives, maxLives: PLAYER.lives,
    invulnerable: 0, fireTimer: 0, energy: ENERGY.max,
    speed: PLAYER.speed, damage: PLAYER.boltDamage, pierce: 0,
    magnet: PLAYER.magnetRadius, lightBonus: 0, fireInterval: PLAYER.fireInterval,
    shield: false, shieldReady: false,
  };
  const enemies = [];
  for (let i = 0; i < POOL.enemy; i += 1) {
    enemies.push({ active: false, kind: 'mote', x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, radius: 14, speed: 70, score: 10, t: 0, state: 0, angle: 0, spawnT: 0 });
  }
  const bolts = [];
  for (let i = 0; i < POOL.bolt; i += 1) bolts.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 1, pierce: 0, life: 0 });
  const orbs = [];
  for (let i = 0; i < POOL.orb; i += 1) orbs.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const globs = [];
  for (let i = 0; i < POOL.glob; i += 1) globs.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const particles = [];
  for (let i = 0; i < POOL.particle; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff' });
  const floaters = [];
  for (let i = 0; i < POOL.floater; i += 1) floaters.push({ active: false, x: 0, y: 0, text: '', life: 0, color: '#fff' });
  const plankton = [];
  for (let i = 0; i < 90; i += 1) {
    plankton.push({ x: random() * FIELD.width, y: random() * FIELD.height, r: 1 + random() * 2.2, phase: random() * 6.28, speed: 4 + random() * 10 });
  }

  const state = {
    player, enemies, bolts, orbs, globs, particles, floaters, plankton,
    score: 0, kills: 0, wave: 0, elapsed: 0, streak: 0, streakTimer: 0,
    shake: 0, hitStop: 0, flash: 0, banner: null, bannerTimer: 0,
    spawnQueue: [], spawnTimer: 0, boss: null, over: false, won: false,
    upgradeChoices: null, lightRadius: PLAYER.lightFull,
  };

  function burst(x, y, color, count, speed) {
    let made = 0;
    for (let i = 0; i < particles.length && made < count; i += 1) {
      const p = particles[i];
      if (p.active) continue;
      const a = random() * 6.2832;
      const s = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.maxLife = 0.4 + random() * 0.5;
      p.life = p.maxLife;
      p.size = 1.5 + random() * 2.5;
      p.color = color;
      made += 1;
    }
  }

  function floater(x, y, text, color) {
    for (let i = 0; i < floaters.length; i += 1) {
      const f = floaters[i];
      if (f.active) continue;
      f.active = true;
      f.x = x;
      f.y = y;
      f.text = text;
      f.life = 0.9;
      f.color = color;
      return;
    }
  }

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function dropOrbs(x, y, count) {
    for (let n = 0; n < count; n += 1) {
      const o = free(orbs);
      if (!o) return;
      const a = random() * 6.2832;
      o.active = true;
      o.x = x;
      o.y = y;
      o.vx = Math.cos(a) * 40;
      o.vy = Math.sin(a) * 40;
      o.life = ORB.life;
    }
  }

  function spawnEnemy(kind, x, y) {
    const e = free(enemies);
    if (!e) return null;
    const def = ENEMIES[kind];
    e.active = true;
    e.kind = kind;
    e.x = x !== undefined ? x : 40 + random() * (FIELD.width - 80);
    e.y = y !== undefined ? y : 40 + random() * (FIELD.height - 80);
    e.hp = def.hp;
    e.maxHp = def.hp;
    e.radius = def.radius;
    e.speed = def.speed * (0.9 + random() * 0.2);
    e.score = def.score;
    e.t = 0;
    e.state = 0;
    e.angle = 0;
    e.vx = 0;
    e.vy = 0;
    return e;
  }

  function spawnBoss(wave) {
    const boss = spawnEnemy('boss', FIELD.width / 2, -80);
    if (!boss) return null;
    boss.hp = ENEMIES.boss.hp + (wave >= WIN_WAVE ? 40 : 0);
    boss.maxHp = boss.hp;
    boss.y = 90;
    state.boss = boss;
    return boss;
  }

  function waveComp(n) {
    const list = [];
    const count = 6 + 4 * n;
    const kinds = ['mote'];
    const weights = [5];
    if (n >= 2) { kinds.push('darter'); weights.push(3); }
    if (n >= 3) { kinds.push('spitter'); weights.push(2); }
    if (n >= 4) { kinds.push('bulwark'); weights.push(1); }
    let total = 0;
    for (const w of weights) total += w;
    for (let i = 0; i < count; i += 1) {
      let roll = random() * total;
      let kind = 'mote';
      for (let k = 0; k < kinds.length; k += 1) {
        roll -= weights[k];
        if (roll <= 0) { kind = kinds[k]; break; }
      }
      list.push(kind);
    }
    return list;
  }

  function startWave(n) {
    state.wave = n;
    state.spawnQueue = waveComp(n);
    if (n % 5 === 0) state.spawnQueue.push('boss');
    state.spawnTimer = 0.8;
    state.banner = n % 5 === 0 ? 'THE GLOOMWHALE STIRS' : `WAVE ${n}`;
    state.bannerTimer = 2.2;
    if (player.shield) player.shieldReady = true;
    return n % 5 === 0 ? EVENT_BOSS : 0;
  }

  function rollUpgrades() {
    const pool = UPGRADES.filter((u) => u.id !== 'aegis' || !player.shield);
    const picks = [];
    while (picks.length < 3 && pool.length > 0) {
      const index = Math.floor(random() * pool.length);
      picks.push(pool.splice(index, 1)[0]);
    }
    return picks;
  }

  function applyUpgrade(id) {
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (!upgrade) return false;
    upgrade.apply(player);
    state.upgradeChoices = null;
    return true;
  }

  function hurtPlayer() {
    if (player.invulnerable > 0) return 0;
    if (player.shieldReady) {
      player.shieldReady = false;
      player.invulnerable = 1.0;
      burst(player.x, player.y, '#7df9ff', 16, 160);
      return EVENT_HIT;
    }
    player.lives -= 1;
    player.invulnerable = PLAYER.invulnerable;
    state.shake = Math.min(1, state.shake + 0.7);
    state.flash = 0.5;
    state.streak = 0;
    burst(player.x, player.y, '#ff5f6d', 20, 200);
    if (player.lives <= 0) {
      state.over = true;
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function killEnemy(e) {
    e.active = false;
    state.kills += 1;
    state.streak += 1;
    state.streakTimer = 2;
    const bonus = e.score + Math.min(state.streak, 10);
    state.score += bonus;
    floater(e.x, e.y, `+${bonus}`, '#ffd76a');
    burst(e.x, e.y, ENEMIES[e.kind].color, e.kind === 'boss' ? 40 : 12, e.kind === 'boss' ? 260 : 160);
    dropOrbs(e.x, e.y, e.kind === 'boss' ? 10 : e.kind === 'bulwark' ? 3 : 1);
    if (e.kind === 'boss') {
      state.boss = null;
      state.shake = 1;
      state.hitStop = 0.12;
    }
    return EVENT_KILL;
  }

  function fireBolt() {
    const b = free(bolts);
    if (!b) return false;
    const px = player.x + Math.cos(player.angle) * (PLAYER.radius + 6);
    const py = player.y + Math.sin(player.angle) * (PLAYER.radius + 6);
    b.active = true;
    b.x = px;
    b.y = py;
    b.vx = Math.cos(player.angle) * PLAYER.boltSpeed;
    b.vy = Math.sin(player.angle) * PLAYER.boltSpeed;
    b.damage = player.damage;
    b.pierce = player.pierce;
    b.life = 1.1;
    burst(px, py, '#aef3ff', 3, 60);
    return true;
  }

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.angle = -Math.PI / 2;
    player.lives = PLAYER.lives;
    player.maxLives = PLAYER.lives;
    player.invulnerable = 0;
    player.fireTimer = 0;
    player.energy = ENERGY.max;
    player.speed = PLAYER.speed;
    player.damage = PLAYER.boltDamage;
    player.pierce = 0;
    player.magnet = PLAYER.magnetRadius;
    player.lightBonus = 0;
    player.fireInterval = PLAYER.fireInterval;
    player.shield = false;
    player.shieldReady = false;
    for (const pool of [enemies, bolts, orbs, globs, particles, floaters]) {
      for (const item of pool) item.active = false;
    }
    state.score = 0;
    state.kills = 0;
    state.wave = 0;
    state.elapsed = 0;
    state.streak = 0;
    state.streakTimer = 0;
    state.shake = 0;
    state.hitStop = 0;
    state.flash = 0;
    state.banner = null;
    state.bannerTimer = 0;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.boss = null;
    state.over = false;
    state.won = false;
    state.upgradeChoices = null;
    state.lightRadius = PLAYER.lightFull;
  }

  function step(dt, input) {
    let events = 0;
    if (state.over || state.won) return events;
    state.elapsed += dt;
    if (state.streakTimer > 0) {
      state.streakTimer -= dt;
      if (state.streakTimer <= 0) state.streak = 0;
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.8);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }

    // --- player movement ---
    const steer = input.steer;
    let mx = steer.x;
    let my = steer.y;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + mx * player.speed * dt));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + my * player.speed * dt));
    player.angle = input.aim;
    if (player.invulnerable > 0) player.invulnerable -= dt;

    // --- lantern energy ---
    player.energy = Math.max(0, player.energy - ENERGY.drainPerSecond * dt);
    const lightFrac = player.energy / ENERGY.max;
    state.lightRadius = PLAYER.lightBase + (PLAYER.lightFull - PLAYER.lightBase) * lightFrac + player.lightBonus;

    // --- firing ---
    player.fireTimer -= dt;
    if (input.firing && player.fireTimer <= 0 && player.energy > ENERGY.fireFloor) {
      player.energy -= PLAYER.boltCost;
      player.fireTimer = player.fireInterval;
      if (fireBolt()) events |= EVENT_SHOOT;
    }

    // --- spawning ---
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const kind = state.spawnQueue.shift();
        if (kind === 'boss') {
          if (spawnBoss(state.wave)) events |= EVENT_BOSS;
        } else {
          spawnEnemy(kind);
        }
        state.spawnTimer = Math.max(0.18, 0.5 - state.wave * 0.02);
      }
    }

    // --- enemies ---
    let aliveEnemies = 0;
    for (let i = 0; i < enemies.length; i += 1) {
      const e = enemies[i];
      if (!e.active) continue;
      aliveEnemies += 1;
      e.t += dt;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;
      if (e.kind === 'mote') {
        const wob = Math.sin(e.t * 3 + i) * 0.4;
        e.x += (nx * e.speed + -ny * wob * e.speed) * dt;
        e.y += (ny * e.speed + nx * wob * e.speed) * dt;
      } else if (e.kind === 'darter') {
        // Lunge in bursts: wind up, then dash.
        if (e.state === 0 && d < 240) { e.state = 1; e.t = 0; }
        if (e.state === 1) {
          e.x += nx * e.speed * 0.4 * dt;
          e.y += ny * e.speed * 0.4 * dt;
          if (e.t > 0.45) { e.state = 2; e.t = 0; }
        } else if (e.state === 2) {
          e.x += nx * 380 * dt;
          e.y += ny * 380 * dt;
          if (e.t > 0.35) { e.state = 3; e.t = 0; }
        } else {
          e.x += nx * e.speed * 0.5 * dt;
          e.y += ny * e.speed * 0.5 * dt;
          if (e.t > 1.1) { e.state = 0; e.t = 0; }
        }
      } else if (e.kind === 'spitter') {
        if (d < 260) { e.x -= nx * e.speed * dt; e.y -= ny * e.speed * dt; }
        else if (d > 380) { e.x += nx * e.speed * dt; e.y += ny * e.speed * dt; }
        else { e.x += -ny * e.speed * 0.6 * dt; e.y += nx * e.speed * 0.6 * dt; }
        if (e.t > 2.2 && d < 540) {
          e.t = 0;
          const g = free(globs);
          if (g) {
            g.active = true;
            g.x = e.x;
            g.y = e.y;
            g.vx = nx * GLOB.speed;
            g.vy = ny * GLOB.speed;
            g.life = 4;
          }
        }
      } else if (e.kind === 'bulwark') {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
      } else if (e.kind === 'boss') {
        // Charge telegraph, then dash; spawns motes now and then.
        if (e.state === 0) {
          e.x += nx * e.speed * dt;
          e.y += ny * e.speed * dt;
          if (e.t > 5) { e.state = 1; e.t = 0; }
        } else if (e.state === 1) {
          e.angle = Math.atan2(dy, dx);
          if (e.t > 0.7) { e.state = 2; e.t = 0; }
        } else if (e.state === 2) {
          e.x += Math.cos(e.angle) * 420 * dt;
          e.y += Math.sin(e.angle) * 420 * dt;
          if (e.t > 0.6) { e.state = 3; e.t = 0; }
        } else {
          e.x += nx * e.speed * 0.5 * dt;
          e.y += ny * e.speed * 0.5 * dt;
          if (e.t > 2) { e.state = 0; e.t = 0; }
        }
        e.spawnT += dt;
        if (e.spawnT > 8) {
          e.spawnT = 0;
          for (let n = 0; n < 3; n += 1) spawnEnemy('mote', e.x + (random() - 0.5) * 120, e.y + (random() - 0.5) * 120);
        }
      }
      e.x = Math.min(FIELD.width - e.radius, Math.max(e.radius, e.x));
      e.y = Math.min(FIELD.height - e.radius, Math.max(e.radius, e.y));
      // Touching the player hurts.
      if (d < e.radius + PLAYER.radius && player.invulnerable <= 0) {
        events |= hurtPlayer();
        if (state.over) return events;
        // Knock the enemy back so one touch is one hit.
        e.x -= nx * 30;
        e.y -= ny * 30;
      }
    }

    // --- bolts ---
    for (let i = 0; i < bolts.length; i += 1) {
      const b = bolts[i];
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) { b.active = false; continue; }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 0 || b.x > FIELD.width || b.y < 0 || b.y > FIELD.height) { b.active = false; continue; }
      for (let j = 0; j < enemies.length; j += 1) {
        const e = enemies[j];
        if (!e.active) continue;
        const rr = e.radius + PLAYER.boltRadius;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          e.hp -= b.damage;
          const kb = e.kind === 'bulwark' || e.kind === 'boss' ? 6 : 26;
          e.x += (b.vx / PLAYER.boltSpeed) * kb;
          e.y += (b.vy / PLAYER.boltSpeed) * kb;
          burst(b.x, b.y, '#aef3ff', 4, 90);
          if (e.hp <= 0) events |= killEnemy(e);
          if (b.pierce > 0) b.pierce -= 1;
          else { b.active = false; }
          break;
        }
      }
      if (!b.active) continue;
      // Bolts can pop spitter globs.
      for (let j = 0; j < globs.length; j += 1) {
        const g = globs[j];
        if (!g.active) continue;
        const rr = GLOB.radius + PLAYER.boltRadius;
        if (dist2(b.x, b.y, g.x, g.y) < rr * rr) {
          g.active = false;
          b.active = false;
          burst(g.x, g.y, '#b8ff5f', 5, 80);
          break;
        }
      }
    }

    // --- globs ---
    for (let i = 0; i < globs.length; i += 1) {
      const g = globs[i];
      if (!g.active) continue;
      g.life -= dt;
      if (g.life <= 0) { g.active = false; continue; }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (g.x < 0 || g.x > FIELD.width || g.y < 0 || g.y > FIELD.height) { g.active = false; continue; }
      const rr = GLOB.radius + PLAYER.radius;
      if (dist2(g.x, g.y, player.x, player.y) < rr * rr && player.invulnerable <= 0) {
        g.active = false;
        events |= hurtPlayer();
        if (state.over) return events;
      }
    }

    // --- orbs ---
    for (let i = 0; i < orbs.length; i += 1) {
      const o = orbs[i];
      if (!o.active) continue;
      o.life -= dt;
      if (o.life <= 0) { o.active = false; continue; }
      const dx = player.x - o.x;
      const dy = player.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < player.magnet) {
        o.vx += (dx / d) * 900 * dt;
        o.vy += (dy / d) * 900 * dt;
      } else {
        o.vx *= 0.98;
        o.vy *= 0.98;
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (d < PLAYER.radius + ORB.radius) {
        o.active = false;
        player.energy = Math.min(ENERGY.max, player.energy + ENERGY.orbGain);
        state.score += ORB.score;
        floater(o.x, o.y, `+${ORB.score}`, '#ffd76a');
        burst(o.x, o.y, '#ffd76a', 6, 100);
        events |= EVENT_ORB;
      }
    }

    // --- particles & floaters ---
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    for (let i = 0; i < floaters.length; i += 1) {
      const f = floaters[i];
      if (!f.active) continue;
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) f.active = false;
    }

    // --- plankton drift ---
    for (let i = 0; i < plankton.length; i += 1) {
      const p = plankton[i];
      p.y += p.speed * dt;
      p.x += Math.sin(state.elapsed * 0.4 + p.phase) * 6 * dt;
      if (p.y > FIELD.height + 4) { p.y = -4; p.x = random() * FIELD.width; }
    }

    // --- wave clear / win ---
    if (state.spawnQueue.length === 0 && aliveEnemies === 0 && !state.over && !state.won && state.wave > 0) {
      const bonus = 50 * state.wave;
      state.score += bonus;
      if (state.wave >= WIN_WAVE) {
        state.won = true;
        return events | EVENT_WIN;
      }
      state.upgradeChoices = rollUpgrades();
      return events | EVENT_WAVE_CLEAR;
    }
    return events;
  }

  reset();
  return { state, reset, step, startWave, rollUpgrades, applyUpgrade };
}
