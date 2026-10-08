// Missionaries and Cannibals (Module 2).
// State: [m, c, boat] = missionaries and cannibals on the LEFT bank, boat 1 = left.
// A state is safe if missionaries are never outnumbered on either bank - the same
// "reject unsafe states early" idea used for capacity constraints in routing.

export function missionariesProblem(n = 3, boat = 2) {
  const safe = (m, c) =>
    m >= 0 && c >= 0 && m <= n && c <= n && (m === 0 || m >= c) && (n - m === 0 || n - m >= n - c);
  const loads = [];
  for (let m = 0; m <= boat; m++) for (let c = 0; c <= boat - m; c++) if (m + c > 0) loads.push([m, c]);

  return {
    initial: [n, n, 1],
    key: (s) => s.join(','),
    isGoal: ([m, c, b]) => m === 0 && c === 0 && b === 0,
    isSafe: ([m, c]) => safe(m, c),
    successors([m, c, b]) {
      const dir = b === 1 ? -1 : 1;
      const out = [];
      for (const [dm, dc] of loads) {
        const nm = m + dir * dm;
        const nc = c + dir * dc;
        if (!safe(nm, nc)) continue;
        const side = b === 1 ? 'left -> right' : 'right -> left';
        out.push({ state: [nm, nc, 1 - b], action: `Move ${dm}M ${dc}C ${side}`, cost: 1 });
      }
      return out;
    },
  };
}
