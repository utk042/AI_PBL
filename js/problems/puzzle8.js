// 8-puzzle / tiles problem (Module 2). Used to validate the admissible heuristics
// (misplaced tiles, Manhattan distance) of our A* implementation.
// State: string of 9 chars, '0' = blank, read row by row.

export const GOAL = '123456780';

const goalPos = {};
for (let i = 0; i < 9; i++) goalPos[GOAL[i]] = i;

export const heuristics = {
  zero: () => 0,
  misplaced: (s) => {
    let h = 0;
    for (let i = 0; i < 9; i++) if (s[i] !== '0' && s[i] !== GOAL[i]) h++;
    return h;
  },
  manhattan: (s) => {
    let h = 0;
    for (let i = 0; i < 9; i++) {
      if (s[i] === '0') continue;
      const g = goalPos[s[i]];
      h += Math.abs((i % 3) - (g % 3)) + Math.abs(Math.floor(i / 3) - Math.floor(g / 3));
    }
    return h;
  },
};

/** Only half of all permutations can reach the goal; check inversion parity. */
export function isSolvable(s) {
  const tiles = s.replace('0', '').split('');
  let inv = 0;
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) if (tiles[i] > tiles[j]) inv++;
  return inv % 2 === 0;
}

export function puzzleProblem(start, heuristic = 'manhattan') {
  const moves = [
    ['Up', -3],
    ['Down', 3],
    ['Left', -1],
    ['Right', 1],
  ];
  return {
    initial: start,
    key: (s) => s,
    isGoal: (s) => s === GOAL,
    heuristic: heuristics[heuristic],
    successors(s) {
      const z = s.indexOf('0');
      const out = [];
      for (const [name, d] of moves) {
        const t = z + d;
        if (t < 0 || t > 8) continue;
        if ((d === -1 || d === 1) && Math.floor(t / 3) !== Math.floor(z / 3)) continue;
        const arr = s.split('');
        [arr[z], arr[t]] = [arr[t], arr[z]];
        out.push({ state: arr.join(''), action: name, cost: 1 });
      }
      return out;
    },
  };
}

/** Deterministic scramble so the same puzzle can be reproduced in the report. */
export function scramble(steps = 20, seed = 7) {
  let s = GOAL;
  let rnd = seed;
  let prev = null;
  const p = puzzleProblem(GOAL);
  for (let i = 0; i < steps; i++) {
    rnd = (rnd * 1103515245 + 12345) & 0x7fffffff;
    const opts = p.successors(s).filter((m) => m.state !== prev);
    prev = s;
    s = opts[rnd % opts.length].state;
  }
  return s;
}
