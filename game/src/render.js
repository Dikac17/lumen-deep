// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Everything is drawn with the Canvas 2D API — no image files, no fonts from
// the network. The deep sea is dark; the player's lantern cuts a hole in the dark.

import { ENEMIES, FIELD, FONT, GLOB, ORB, PALETTE, PLAYER } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** Upgrade cards, in field coordinates, for drawing and click hit-testing. */
export const UPGRADE_CARDS = [
  { x: 130, y: 250, w: 300, h: 220 },
  { x: 490, y: 250, w: 300, h: 220 },
  { x: 850, y: 250, w: 300, h: 220 },
];

const LIFE_R = 11;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const dark = document.createElement('canvas');
  dark.width = FIELD.width;
  dark.height = FIELD.height;
  const darkCtx = dark.getContext('2d');
  const scoreLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const waveLabel = cachedLabel('WAVE ');
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, glow) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    if (glow) {
      context.shadowColor = color;
      context.shadowBlur = glow;
    } else {
      context.shadowBlur = 0;
    }
    context.fillText(value, x, y);
    context.shadowBlur = 0;
  }

  function toField(cssX, cssY) {
    const ratio = window.devicePixelRatio || 1;
    return {
      x: (cssX * ratio - view.x) / view.scale,
      y: (cssY * ratio - view.y) / view.scale,
    };
  }

  function drawBackground(state) {
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.deepTop);
    grad.addColorStop(1, PALETTE.deepBottom);
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // God rays from the surface, faint and slow.
    context.save();
    context.globalAlpha = 0.05;
    context.fillStyle = '#7df9ff';
    for (let i = 0; i < 4; i += 1) {
      const sway = Math.sin(state.elapsed * 0.2 + i * 1.7) * 40;
      const x = 180 + i * 300 + sway;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + 90, 0);
      context.lineTo(x + 190, FIELD.height);
      context.lineTo(x + 40, FIELD.height);
      context.closePath();
      context.fill();
    }
    context.restore();
    // Drifting plankton motes.
    for (const p of state.plankton) {
      const tw = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(state.elapsed * 1.3 + p.phase));
      context.globalAlpha = tw;
      context.fillStyle = PALETTE.plankton;
      context.beginPath();
      context.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawEnemy(e, state) {
    const def = ENEMIES[e.kind];
    context.save();
    context.translate(e.x, e.y);
    if (e.kind === 'boss') {
      const telegraph = e.state === 1;
      context.rotate(e.state === 2 ? e.angle : Math.atan2(state.player.y - e.y, state.player.x - e.x));
      context.fillStyle = '#1a0510';
      context.beginPath();
      context.ellipse(0, 0, 78, 46, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = telegraph ? '#ff3d5e' : '#3d0a18';
      context.beginPath();
      context.moveTo(-70, 0);
      context.lineTo(-108, -26);
      context.lineTo(-108, 26);
      context.closePath();
      context.fill();
      context.fillStyle = telegraph ? '#ff8fa3' : '#ff3d5e';
      context.beginPath();
      context.arc(38, -12, 7, 0, Math.PI * 2);
      context.arc(38, 12, 7, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#ff3d5e';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(0, 0, 58, -0.9, 0.9);
      context.stroke();
      // Boss health ring.
      context.strokeStyle = '#3d0a18';
      context.lineWidth = 6;
      context.beginPath();
      context.arc(0, 0, 88, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = '#ff3d5e';
      context.beginPath();
      context.arc(0, 0, 88, -Math.PI / 2, -Math.PI / 2 + (e.hp / e.maxHp) * Math.PI * 2);
      context.stroke();
    } else if (e.kind === 'mote') {
      context.fillStyle = '#120a2e';
      context.beginPath();
      context.arc(0, 0, e.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = def.color;
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = def.color;
      context.beginPath();
      context.arc(-4, -3, 2.5, 0, Math.PI * 2);
      context.arc(4, -3, 2.5, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === 'darter') {
      const ang = Math.atan2(state.player.y - e.y, state.player.x - e.x);
      context.rotate(ang);
      context.fillStyle = '#22081a';
      context.beginPath();
      context.moveTo(16, 0);
      context.lineTo(-12, -10);
      context.lineTo(-6, 0);
      context.lineTo(-12, 10);
      context.closePath();
      context.fill();
      context.strokeStyle = def.color;
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = def.color;
      context.beginPath();
      context.arc(6, 0, 3, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === 'spitter') {
      context.fillStyle = '#0d1f08';
      context.beginPath();
      context.arc(0, 0, e.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = def.color;
      context.lineWidth = 2;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + e.t;
        context.beginPath();
        context.moveTo(Math.cos(a) * e.radius, Math.sin(a) * e.radius);
        context.lineTo(Math.cos(a) * (e.radius + 7), Math.sin(a) * (e.radius + 7));
        context.stroke();
      }
      context.fillStyle = def.color;
      context.beginPath();
      context.arc(0, 0, 6, 0, Math.PI * 2);
      context.fill();
    } else {
      // bulwark
      context.fillStyle = '#1f0d02';
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      context.strokeStyle = def.color;
      context.lineWidth = 3;
      context.stroke();
      context.strokeStyle = '#ffd76a';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(-e.radius * 0.5, -e.radius * 0.2);
      context.lineTo(0, e.radius * 0.2);
      context.lineTo(e.radius * 0.5, -e.radius * 0.3);
      context.stroke();
    }
    context.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0) return; // Blink while invulnerable.
    context.save();
    context.translate(p.x, p.y);
    context.rotate(p.angle);
    // Tail fin, wagging.
    const wag = Math.sin(state.elapsed * 14) * 6;
    context.fillStyle = '#0e7490';
    context.beginPath();
    context.moveTo(-12, 0);
    context.lineTo(-30, -12 + wag);
    context.lineTo(-30, 12 + wag);
    context.closePath();
    context.fill();
    // Body.
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.ellipse(0, 0, 18, 11, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.playerCore;
    context.beginPath();
    context.ellipse(4, -2, 10, 6, 0, 0, Math.PI * 2);
    context.fill();
    // Eye.
    context.fillStyle = '#01222e';
    context.beginPath();
    context.arc(9, -3, 3, 0, Math.PI * 2);
    context.fill();
    // Lantern stalk + glowing bulb.
    context.strokeStyle = '#9adfe8';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(6, -8);
    context.quadraticCurveTo(14, -20, 20, -18);
    context.stroke();
    context.shadowColor = PALETTE.lantern;
    context.shadowBlur = 18;
    context.fillStyle = PALETTE.lantern;
    context.beginPath();
    context.arc(21, -18, 5, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.restore();
    // Shield ring.
    if (p.shieldReady) {
      context.strokeStyle = '#7df9ff';
      context.globalAlpha = 0.6;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(p.x, p.y, PLAYER.radius + 10, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    }
  }

  function drawDarkness(state) {
    darkCtx.setTransform(1, 0, 0, 1, 0, 0);
    darkCtx.globalCompositeOperation = 'source-over';
    darkCtx.clearRect(0, 0, FIELD.width, FIELD.height);
    darkCtx.fillStyle = 'rgba(1, 4, 12, 0.72)';
    darkCtx.fillRect(0, 0, FIELD.width, FIELD.height);
    darkCtx.globalCompositeOperation = 'destination-out';
    const p = state.player;
    const grad = darkCtx.createRadialGradient(p.x, p.y, 20, p.x, p.y, state.lightRadius);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.65, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    darkCtx.fillStyle = grad;
    darkCtx.beginPath();
    darkCtx.arc(p.x, p.y, state.lightRadius, 0, Math.PI * 2);
    darkCtx.fill();
    // Each bolt and orb carries a little light of its own.
    for (const b of state.bolts) {
      if (!b.active) continue;
      const g2 = darkCtx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 46);
      g2.addColorStop(0, 'rgba(255,255,255,0.7)');
      g2.addColorStop(1, 'rgba(255,255,255,0)');
      darkCtx.fillStyle = g2;
      darkCtx.beginPath();
      darkCtx.arc(b.x, b.y, 46, 0, Math.PI * 2);
      darkCtx.fill();
    }
    for (const o of state.orbs) {
      if (!o.active) continue;
      const g2 = darkCtx.createRadialGradient(o.x, o.y, 2, o.x, o.y, 34);
      g2.addColorStop(0, 'rgba(255,255,255,0.6)');
      g2.addColorStop(1, 'rgba(255,255,255,0)');
      darkCtx.fillStyle = g2;
      darkCtx.beginPath();
      darkCtx.arc(o.x, o.y, 34, 0, Math.PI * 2);
      darkCtx.fill();
    }
    context.drawImage(dark, 0, 0);
  }

  function drawHeart(x, y, filled) {
    context.save();
    context.translate(x, y);
    context.scale(0.9, 0.9);
    context.beginPath();
    context.moveTo(0, 8);
    context.bezierCurveTo(-12, -2, -8, -12, 0, -5);
    context.bezierCurveTo(8, -12, 12, -2, 0, 8);
    context.closePath();
    context.fillStyle = filled ? '#ff5f6d' : '#26303d';
    context.fill();
    context.strokeStyle = '#ff8fa3';
    context.lineWidth = 1.5;
    context.stroke();
    context.restore();
  }

  function drawHud(state, best, muted) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 30, PALETTE.text, 'left', 8);
    text(bestLabel(best), 24, 52, 16, PALETTE.muted, 'left');
    text(waveLabel(state.wave), FIELD.width / 2, 18, 30, PALETTE.text, 'center', 8);
    const remaining = state.spawnQueue.length + state.enemies.reduce((n, e) => n + (e.active ? 1 : 0), 0);
    text(`${remaining} left`, FIELD.width / 2, 52, 16, PALETTE.muted, 'center');
    const p = state.player;
    for (let i = 0; i < p.maxLives; i += 1) {
      drawHeart(FIELD.width - 30 - i * 30, 32, i < p.lives);
    }
    // Lantern energy bar, bottom left.
    const barX = 24;
    const barY = FIELD.height - 44;
    const barW = 220;
    const barH = 14;
    text('LIGHT', barX, barY - 22, 14, PALETTE.muted, 'left');
    context.fillStyle = '#0a1a2a';
    context.fillRect(barX, barY, barW, barH);
    const frac = p.energy / 100;
    context.fillStyle = frac > 0.35 ? PALETTE.lantern : PALETTE.danger;
    context.fillRect(barX, barY, barW * frac, barH);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(barX, barY, barW, barH);
    if (p.shieldReady) text('AEGIS READY', barX + barW + 16, barY - 4, 14, '#7df9ff', 'left');
    text(muted ? 'MUTED (M)' : 'M — mute', FIELD.width - 24, FIELD.height - 30, 14, PALETTE.muted, 'right');
    // Boss bar.
    if (state.boss && state.boss.active) {
      const bw = 420;
      const bx = (FIELD.width - bw) / 2;
      const by = 84;
      text('GLOOMWHALE', FIELD.width / 2, by - 4, 16, PALETTE.boss, 'center');
      context.fillStyle = '#1a0510';
      context.fillRect(bx, by + 18, bw, 12);
      context.fillStyle = PALETTE.boss;
      context.fillRect(bx, by + 18, bw * (state.boss.hp / state.boss.maxHp), 12);
      context.strokeStyle = '#5c1220';
      context.strokeRect(bx, by + 18, bw, 12);
    }
    // Wave banner.
    if (state.banner) {
      const alpha = Math.min(1, state.bannerTimer);
      context.globalAlpha = alpha;
      text(state.banner, FIELD.width / 2, 180, 52, PALETTE.lantern, 'center', 20);
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 620;
    const maxText = width - 64;
    // Word-wrap every line so none ever spills past the panel's edge.
    const wrapped = [];
    context.font = `20px ${FONT}`;
    for (const line of lines) {
      const words = line.split(' ');
      let current = '';
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (context.measureText(test).width > maxText && current) {
          wrapped.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      wrapped.push(current);
    }
    const height = 150 + wrapped.length * 34;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(2, 8, 16, 0.88)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 46, PALETTE.text, 'center', 12);
    for (let i = 0; i < wrapped.length; i += 1) {
      text(wrapped[i], FIELD.width / 2, y + 118 + i * 34, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 22, PALETTE.lantern, 'center');
  }

  function drawUpgradeCards(choices) {
    text('CHOOSE A GIFT OF THE DEEP', FIELD.width / 2, 170, 34, PALETTE.text, 'center', 10);
    text('Press 1, 2 or 3 — or click a card', FIELD.width / 2, 208, 18, PALETTE.muted, 'center');
    for (let i = 0; i < choices.length; i += 1) {
      const card = UPGRADE_CARDS[i];
      const u = choices[i];
      context.fillStyle = 'rgba(6, 18, 31, 0.94)';
      context.fillRect(card.x, card.y, card.w, card.h);
      context.strokeStyle = PALETTE.panelEdge;
      context.lineWidth = 2;
      context.strokeRect(card.x, card.y, card.w, card.h);
      context.textBaseline = 'alphabetic';
      text(`${i + 1}`, card.x + card.w / 2, card.y + 52, 30, PALETTE.lantern, 'center');
      text(u.name, card.x + card.w / 2, card.y + 98, 24, PALETTE.text, 'center');
      // Wrap the description.
      const words = u.desc.split(' ');
      let line = '';
      let ly = card.y + 140;
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (test.length > 20 && line) {
          text(line, card.x + card.w / 2, ly, 18, PALETTE.muted, 'center');
          line = word;
          ly += 26;
        } else {
          line = test;
        }
      }
      if (line) text(line, card.x + card.w / 2, ly, 18, PALETTE.muted, 'center');
    }
  }

  /** Paint one frame: the field, the dark, then the HUD or a panel for the screen. */
  function draw(state, screen, best, muted) {
    // Screen shake: deterministic wobble from elapsed time, scaled by trauma.
    const sh = state.shake * state.shake;
    const shX = sh * 12 * Math.sin(state.elapsed * 97.3);
    const shY = sh * 12 * Math.cos(state.elapsed * 89.1);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shX * view.scale, view.y + shY * view.scale);
    drawBackground(state);
    for (const e of state.enemies) if (e.active) drawEnemy(e, state);
    for (const g of state.globs) {
      if (!g.active) continue;
      context.fillStyle = '#b8ff5f';
      context.beginPath();
      context.arc(g.x, g.y, GLOB.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0d1f08';
      context.beginPath();
      context.arc(g.x, g.y, GLOB.radius - 4, 0, Math.PI * 2);
      context.fill();
    }
    for (const o of state.orbs) {
      if (!o.active) continue;
      const pulse = 1 + 0.15 * Math.sin(state.elapsed * 6 + o.x);
      context.save();
      context.shadowColor = PALETTE.orb;
      context.shadowBlur = 12;
      context.fillStyle = PALETTE.orb;
      context.beginPath();
      context.arc(o.x, o.y, ORB.radius * pulse, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    drawPlayer(state);
    // Bolts glow above the dark.
    context.save();
    context.globalCompositeOperation = 'lighter';
    // Every hunter glows in the dark, so the player can always read the field.
    for (const e of state.enemies) {
      if (!e.active) continue;
      const glow = context.createRadialGradient(e.x, e.y, 2, e.x, e.y, e.radius * 2.4);
      glow.addColorStop(0, ENEMIES[e.kind].color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      context.globalAlpha = 0.28;
      context.fillStyle = glow;
      context.beginPath();
      context.arc(e.x, e.y, e.radius * 2.4, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const b of state.bolts) {
      if (!b.active) continue;
      context.strokeStyle = PALETTE.bolt;
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
      context.lineTo(b.x, b.y);
      context.stroke();
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(b.x, b.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = p.life / p.maxLife;
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    context.globalAlpha = 1;
    drawDarkness(state);
    // Floaters above the dark so the player always reads them.
    context.textBaseline = 'alphabetic';
    for (const f of state.floaters) {
      if (!f.active) continue;
      context.globalAlpha = Math.min(1, f.life / 0.4);
      text(f.text, f.x, f.y, 18, f.color, 'center', 6);
    }
    context.globalAlpha = 1;
    // Hurt flash.
    if (state.flash > 0) {
      context.fillStyle = `rgba(255, 40, 60, ${state.flash * 0.25})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (screen === SCREEN_TITLE) {
      drawPanel('LUMEN DEEP', ['The dark is hungry. Your lantern is your sight — and your weapon.', 'WASD / arrows to swim · mouse to aim · hold click to fire light.', 'Gather glow orbs to feed your light. Clear 10 waves to win.'], 'Press Space or click to dive in', PALETTE.lantern);
      if (best > 0) text(bestLabel(best), FIELD.width / 2, FIELD.height / 2 + 170, 20, PALETTE.muted, 'center');
      return;
    }
    drawHud(state, best, muted);
    if (screen === SCREEN_UPGRADE && state.upgradeChoices) {
      drawUpgradeCards(state.upgradeChoices);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The deep waits for you.'], 'Press P or Space to resume');
    } else if (screen === SCREEN_OVER) {
      const mins = Math.floor(state.elapsed / 60);
      const secs = Math.floor(state.elapsed % 60);
      drawPanel('THE DARK TAKES YOU', [`Score ${state.score} · Best ${best}`, `Reached wave ${state.wave} · ${state.kills} creatures lit · ${mins}:${String(secs).padStart(2, '0')}`], 'Press Space or click to dive again', PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      const mins = Math.floor(state.elapsed / 60);
      const secs = Math.floor(state.elapsed % 60);
      drawPanel('THE DEEP IS LIT', [`Score ${state.score} · Best ${best}`, `All 10 waves cleared · ${state.kills} creatures lit · ${mins}:${String(secs).padStart(2, '0')}`], 'Press Space or click to dive again', PALETTE.lantern);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
