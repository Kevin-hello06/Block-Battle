// Tunable settings. Tweak numbers here to rebalance the game.
// All times are in milliseconds.

const CONFIG = {
  block: {
    das: 150,               // delay before a held left/right starts repeating
    arr: 40,                // repeat interval once auto-shift kicks in
    softDropInterval: 30,
    lockDelay: 500,
    maxLockResets: 15,
    startGravity: 800,      // ms per row at level 1
    gravityFactor: 0.82,    // multiplier per level
    gravityLevelSeconds: 30,
    minGravity: 40,
    maxGarbagePerLock: 8,   // max garbage rows inserted after one piece
  },

  puyo: {
    colors: 4,
    das: 150,
    arr: 70,
    softDropInterval: 35,
    lockDelay: 300,
    maxLockResets: 8,
    startGravity: 600,
    gravityFactor: 0.85,
    gravityLevelSeconds: 30,
    minGravity: 80,
    settleTime: 60,
    popTime: 400,
    chainPause: 120,
    garbageTime: 250,
    nuisancePerLine: 4,     // 1 "line" of attack = this many grey blobs
    maxNuisancePerDrop: 30, // 5 rows max per drop
  },

  // Attacks are measured in "lines". Block boards receive them as garbage rows,
  // blob boards receive them as grey nuisance blobs (see nuisancePerLine).
  attack: {
    blockLines: [0, 0, 1, 2, 4],          // index = lines cleared at once
    comboBonus: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5],
    backToBack: 1,
    perfectClear: 4,
    puyoSinglePop: 0.25,                   // value of a lone 1-chain pop
    puyoChainPower: [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    puyoGroupBonus: 0.5,                   // per extra blob beyond 4 in a group
    puyoColorBonus: 0.5,                   // per extra colour popped in one step
  },

  cpu: {
    easy:   { think: 550, step: 230, noise: 2.0 },
    normal: { think: 250, step: 110, noise: 0.5 },
    hard:   { think: 90,  step: 45,  noise: 0 },
  },

  // KeyboardEvent.code values
  controls: {
    p1: {
      left: ['KeyA'], right: ['KeyD'], soft: ['KeyS'], hard: ['KeyW'],
      ccw: ['KeyQ'], cw: ['KeyE'], hold: ['ShiftLeft'],
    },
    p2: {
      left: ['ArrowLeft'], right: ['ArrowRight'], soft: ['ArrowDown'], hard: ['ArrowUp'],
      ccw: ['Comma'], cw: ['Period'], hold: ['ShiftRight'],
    },
    // Used when only one human is playing (solo or vs CPU)
    solo: {
      left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
      soft: ['ArrowDown', 'KeyS'], hard: ['Space', 'KeyW'],
      ccw: ['KeyZ', 'KeyQ'], cw: ['ArrowUp', 'KeyX', 'KeyE'],
      hold: ['KeyC', 'ShiftLeft', 'ShiftRight'],
    },
  },
};
