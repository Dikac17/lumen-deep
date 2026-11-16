# lumen-deep

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Dikac17/lumen-deep/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Dikac17/lumen-deep/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

LUMEN DEEP — a bioluminescent deep-sea arena survival game, an entry for
make.fun's best-game-01 ("Make the best game").

You are Lumen, a small lanternfish. The deep is dark and hungry: your lantern is
your sight **and** your weapon. Swim with WASD or the arrow keys, aim with the
mouse, hold click to fire bolts of light. Kills drop glow orbs — gather them to
feed your lantern, or it dims and you cannot shoot. Clear 10 waves, choose a gift
of the deep between waves, and beat the Gloomwhale to light the deep.

- Original idea, art and sound: everything is drawn and synthesized in code.
- No network request, no build step: `game/` is plain static files.
- Keyboard + mouse, start / pause / game over / victory / restart, HUD with
  score, wave, lives, lantern energy and boss bar.
- Procedural Web Audio sound (no audio files) and a mute key (M).

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored make.fun library.

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=1xzg4p72&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
