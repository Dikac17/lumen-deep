// Procedural sound only: every effect is synthesized with the Web Audio API, so
// the game ships no audio files at all. Nothing starts until the player first
// interacts (the browser's autoplay rule), and M mutes everything.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let drone = null;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!context || muted) return;
    try {
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise(dur, vol, filterFreq) {
    if (!context || muted) return;
    try {
      const now = context.currentTime;
      const length = Math.max(1, Math.floor(context.sampleRate * dur));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = context.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(now);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    /** Call on the first user gesture; also (re)starts the ambient drone. */
    unlock() {
      if (!ensure()) return;
      if (context.state === 'suspended') context.resume().catch(() => {});
      if (!drone) {
        try {
          const gain = context.createGain();
          gain.gain.value = 0.05;
          gain.connect(master);
          const oscA = context.createOscillator();
          oscA.type = 'sine';
          oscA.frequency.value = 55;
          const oscB = context.createOscillator();
          oscB.type = 'sine';
          oscB.frequency.value = 55.7;
          const lfo = context.createOscillator();
          lfo.type = 'sine';
          lfo.frequency.value = 0.07;
          const lfoGain = context.createGain();
          lfoGain.gain.value = 0.025;
          lfo.connect(lfoGain);
          lfoGain.connect(gain.gain);
          oscA.connect(gain);
          oscB.connect(gain);
          oscA.start();
          oscB.start();
          lfo.start();
          drone = { gain };
        } catch {
          drone = null;
        }
      }
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(880 + Math.random() * 120, 0.08, 'square', 0.10, 220);
      noise(0.05, 0.05, 3200);
    },
    kill() {
      noise(0.16, 0.22, 900);
      tone(320, 0.14, 'triangle', 0.16, 60);
    },
    pickup(streak) {
      const base = 660 * Math.pow(1.059, Math.min(streak, 12));
      tone(base, 0.09, 'sine', 0.14);
      tone(base * 1.5, 0.12, 'sine', 0.10);
    },
    hurt() {
      noise(0.25, 0.3, 500);
      tone(140, 0.3, 'sawtooth', 0.2, 50);
    },
    waveHorn() {
      tone(220, 0.5, 'triangle', 0.18, 330);
      tone(330, 0.5, 'triangle', 0.12, 440);
    },
    bossRoar() {
      tone(90, 0.9, 'sawtooth', 0.25, 45);
      noise(0.7, 0.18, 300);
    },
    upgrade() {
      tone(523, 0.12, 'sine', 0.14);
      tone(659, 0.12, 'sine', 0.14);
      tone(784, 0.2, 'sine', 0.14);
    },
    victory() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.35, 'sine', 0.16), i * 130);
      });
    },
    gameOver() {
      [392, 330, 262, 196].forEach((freq, i) => {
        setTimeout(() => tone(freq, 0.4, 'triangle', 0.15), i * 160);
      });
    },
    click() {
      tone(1200, 0.05, 'sine', 0.08);
    },
  };
}
