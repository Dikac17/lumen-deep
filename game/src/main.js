// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, upgrade, paused, game over
// and victory.
//
// ?seed=N fixes the pattern of the deep. ?shot=start|play|end|win (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOSS, EVENT_HIT, EVENT_KILL, EVENT_ORB, EVENT_OVER, EVENT_SHOOT, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN, UPGRADE_CARDS } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
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

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  window.__lumen = { world, get screen() { return scene.screen; }, get best() { return scene.best; } };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let muted = false;
  let streak = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    world.startWave(1);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Dive in, keep your light fed.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.victory();
      announce(`Victory! Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.gameOver();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function handleEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_KILL) audio.kill();
    if (events & EVENT_ORB) {
      streak += 1;
      audio.pickup(streak);
    }
    if (events & EVENT_HIT) {
      audio.hurt();
      streak = 0;
    }
    if (events & EVENT_BOSS) {
      audio.bossRoar();
      announce('The Gloomwhale stirs.');
    }
    if (events & EVENT_WAVE_CLEAR) {
      audio.waveHorn();
      screen = SCREEN_UPGRADE;
      announce('Wave clear. Choose a gift of the deep.');
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function pickUpgrade(index) {
    const choices = world.state.upgradeChoices;
    if (!choices || index >= choices.length) return;
    const chosen = choices[index];
    world.applyUpgrade(chosen.id);
    audio.upgrade();
    announce(`Chose ${chosen.name}.`);
    world.startWave(world.state.wave + 1);
    screen = SCREEN_PLAY;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_PICK_1) pickUpgrade(0);
      else if (actions & ACTION_PICK_2) pickUpgrade(1);
      else if (actions & ACTION_PICK_3) pickUpgrade(2);
      else if (actions & ACTION_CONFIRM) {
        // A click on a card picks it; a click elsewhere does nothing here.
        const mouse = input.mouse();
        if (mouse) {
          const field = renderer.toField(mouse.x, mouse.y);
          for (let i = 0; i < UPGRADE_CARDS.length; i += 1) {
            const c = UPGRADE_CARDS[i];
            if (field.x >= c.x && field.x <= c.x + c.w && field.y >= c.y && field.y <= c.y + c.h) {
              pickUpgrade(i);
              break;
            }
          }
        }
      }
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The deep stays alive behind the title: harmless drift, no hurt, no score.
      // Refresh the scene every few seconds so it never crowds into one pile.
      if (world.state.elapsed > 8) {
        world.reset();
        world.startWave(1);
      }
      world.state.player.invulnerable = 9999;
      world.step(STEP, { steer: { x: 0, y: 0 }, aim: world.state.player.angle, firing: false });
      world.state.player.invulnerable = 0;
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const mouse = input.mouse();
    let aim = world.state.player.angle;
    if (mouse) {
      const field = renderer.toField(mouse.x, mouse.y);
      aim = Math.atan2(field.y - world.state.player.y, field.x - world.state.player.x);
    } else {
      // No mouse yet: aim at the nearest hunter.
      let nearest = null;
      let nearestD = Infinity;
      for (const e of world.state.enemies) {
        if (!e.active) continue;
        const d = Math.hypot(e.x - world.state.player.x, e.y - world.state.player.y);
        if (d < nearestD) { nearestD = d; nearest = e; }
      }
      if (nearest) aim = Math.atan2(nearest.y - world.state.player.y, nearest.x - world.state.player.x);
    }
    const events = world.step(STEP, { steer: input.steer(), aim, firing: input.firing() || false });
    handleEvents(events);
    if (events & EVENT_WAVE_CLEAR) {
      // The world already rolled the choices; the loop now waits on the upgrade screen.
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (world.state.hitStop > 0) {
      world.state.hitStop -= Math.min((now - last) / 1000, MAX_FRAME);
      last = now;
      renderer.draw(world.state, screen, best, muted);
      return;
    }
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, muted);
  }

  // Leaving the tab pauses a running game rather than letting things hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lumen Deep. Press Space or click to dive in.');
  world.startWave(1); // A living deep behind the title screen.
  // Debug handle for play-testing (read-only state, no cheats): window.__lumen.
  window.__lumen = { world, get screen() { return screen; }, get best() { return best; } };
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
