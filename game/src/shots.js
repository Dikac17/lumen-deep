// The screenshot scenes behind ?shot=start|play|end|win. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by an autopilot, so
// the frame is what a real game looks like and the same seed always gives the same frame.

import { FIELD, PLAYER, STEP, WIN_WAVE } from './config.js';
import { EVENT_OVER, EVENT_WIN, UPGRADES } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 55;
const END_LIMIT_SECONDS = 600;
const WIN_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** The skilled autopilot: keep distance, chase orbs, aim at the nearest hunter. */
function autopilot(state, skilled) {
  const p = state.player;
  let enemy = null;
  let enemyD = Infinity;
  let orb = null;
  let orbD = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < enemyD) { enemyD = d; enemy = e; }
  }
  for (const o of state.orbs) {
    if (!o.active) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < orbD) { orbD = d; orb = o; }
  }
  const aim = enemy ? Math.atan2(enemy.y - p.y, enemy.x - p.x) : p.angle;
  let sx = 0;
  let sy = 0;
  if (skilled) {
    if (enemy && enemyD < 130) {
      sx = (p.x - enemy.x) / enemyD;
      sy = (p.y - enemy.y) / enemyD;
    } else if (orb && orbD < 340) {
      sx = (orb.x - p.x) / orbD;
      sy = (orb.y - p.y) / orbD;
    } else if (enemy && enemyD > 260) {
      sx = (enemy.x - p.x) / enemyD;
      sy = (enemy.y - p.y) / enemyD;
    } else {
      sx = (FIELD.width / 2 - p.x) / 400;
      sy = (FIELD.height / 2 - p.y) / 400;
    }
  } else {
    // The hurried player: swims straight at the nearest hunter and rarely shoots.
    if (enemy) {
      sx = (enemy.x - p.x) / enemyD;
      sy = (enemy.y - p.y) / enemyD;
    }
  }
  const len = Math.hypot(sx, sy) || 1;
  const firing = skilled
    ? enemy !== null && enemyD < 650 && p.energy > 15
    : enemy !== null && enemyD < 300;
  return { steer: { x: sx / len, y: sy / len }, aim, firing };
}

/**
 * Set `world` to the named scene (start, play, end or win) and return the screen to
 * draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name === 'win') {
    // A great run: every gift of the deep, then the real ten waves, played well.
    for (const u of UPGRADES) world.applyUpgrade(u.id);
    world.startWave(1);
    for (let i = 0; i < WIN_LIMIT_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, autopilot(state, true));
      if (events & EVENT_WIN) break;
      if (events & EVENT_OVER) break;
      if (state.upgradeChoices) {
        world.applyUpgrade(state.upgradeChoices[0].id);
        world.startWave(state.wave + 1);
      }
    }
    if (state.won) return { screen: SCREEN_WIN, best: state.score };
    // Fallback: the final wave, staged through the real rules, the boss finished by
    // the same autopilot. The victory screen is still the game's own code.
    world.reset();
    for (const u of UPGRADES) world.applyUpgrade(u.id);
    world.startWave(WIN_WAVE);
    for (let i = 0; i < 240 / STEP; i += 1) {
      const events = world.step(STEP, autopilot(state, true));
      if (events & EVENT_WIN) break;
      if (events & EVENT_OVER) break;
      if (state.upgradeChoices) {
        world.applyUpgrade(state.upgradeChoices[0].id);
        world.startWave(state.wave + 1);
      }
    }
    return { screen: state.won ? SCREEN_WIN : SCREEN_PLAY, best: state.score };
  }
  if (name !== 'play' && name !== 'end') {
    // Title backdrop: the deep alive behind the panel, nothing able to hurt the diver.
    world.startWave(1);
    state.player.invulnerable = 9999;
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, autopilot(state, true));
    state.player.invulnerable = 0;
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const skilled = name === 'play';
  world.startWave(1);
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = world.step(STEP, autopilot(state, skilled));
    if (events & EVENT_OVER) break;
    if (state.upgradeChoices) {
      world.applyUpgrade(state.upgradeChoices[0].id);
      world.startWave(state.wave + 1);
    }
  }
  const over = state.over;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
}

export { SAMPLE, PLAYER };
