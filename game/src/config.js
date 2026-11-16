// LUMEN DEEP — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Waves: clear wave 10's boss to win. */
export const WIN_WAVE = 10;

export const PLAYER = {
  radius: 16,
  speed: 330,
  lives: 3,
  invulnerable: 1.2,
  fireInterval: 0.25,
  boltSpeed: 760,
  boltDamage: 1,
  boltCost: 2,
  boltRadius: 5,
  /** Lantern light radius at full energy, before upgrades. */
  lightBase: 190,
  lightFull: 360,
  magnetRadius: 70,
};

export const ENERGY = {
  max: 100,
  drainPerSecond: 1.5,
  orbGain: 14,
  /** Below this energy the lantern cannot fire. */
  fireFloor: 4,
};

export const ENEMIES = {
  mote:    { hp: 1, speed: 70,  radius: 14, score: 10, touch: 1, color: '#7a5cff' },
  darter:  { hp: 1, speed: 165, radius: 12, score: 15, touch: 1, color: '#ff5fa2' },
  spitter: { hp: 2, speed: 55,  radius: 16, score: 25, touch: 1, color: '#b8ff5f' },
  bulwark: { hp: 8, speed: 38,  radius: 30, score: 60, touch: 1, color: '#ff8a3c' },
  boss:    { hp: 60, speed: 46, radius: 64, score: 500, touch: 1, color: '#ff3d5e' },
};

export const GLOB = { speed: 170, radius: 8 };

export const ORB = { radius: 7, score: 5, life: 14 };

/** How many live things can exist at once; pools are allocated once, at boot. */
export const POOL = { enemy: 96, bolt: 128, orb: 96, glob: 64, particle: 512, floater: 48 };

export const LEVEL = { seconds: 12, max: 12 };

export const PALETTE = {
  backdrop: '#010409',
  deepTop: '#04101f',
  deepBottom: '#010409',
  plankton: '#2e6f8e',
  player: '#7df9ff',
  playerCore: '#e8feff',
  lantern: '#ffd76a',
  bolt: '#aef3ff',
  orb: '#ffd76a',
  panel: '#06121f',
  panelEdge: '#1d4e6b',
  text: '#e8f6ff',
  muted: '#7fa8c4',
  danger: '#ff5f6d',
  heal: '#7dffb0',
  boss: '#ff3d5e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumen-deep.best';
