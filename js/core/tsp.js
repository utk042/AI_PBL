// Travelling Salesperson Problem solvers (Module 2).
// Used to order each vehicle's stops. `dist` is a square matrix; index 0 is the depot.
// Every tour starts and ends at index 0.

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function tourLength(tour, dist) {
  let total = 0;
  for (let i = 1; i < tour.length; i++) total += dist[tour[i - 1]][tour[i]];
  return total;
}

/** Exhaustive permutation search: exact, O(n!) - only for very small inputs. */
export function bruteForce(dist) {
  const t0 = clock();
  const n = dist.length;
  const rest = [...Array(n).keys()].slice(1);
  let best = null;
  let bestLen = Infinity;
  let evaluated = 0;
  const permute = (prefix, remaining, len) => {
    if (len >= bestLen) return;
    if (!remaining.length) {
      evaluated++;
      const total = len + dist[prefix[prefix.length - 1]][0];
      if (total < bestLen) {
        bestLen = total;
        best = [...prefix, 0];
      }
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      const next = remaining[i];
      permute([...prefix, next], remaining.filter((_, j) => j !== i), len + dist[prefix[prefix.length - 1]][next]);
    }
  };
  permute([0], rest, 0);
  return { name: 'Brute force (exact)', tour: best || [0, 0], length: n > 1 ? bestLen : 0, evaluated, timeMs: clock() - t0 };
}

/** Held-Karp dynamic programming: exact, O(n^2 * 2^n). */
export function heldKarp(dist) {
  const t0 = clock();
  const n = dist.length;
  if (n <= 1) return { name: 'Held-Karp DP (exact)', tour: [0, 0], length: 0, evaluated: 0, timeMs: 0 };
  const m = n - 1; // cities 1..n-1 mapped to bits 0..m-1
  const FULL = 1 << m;
  const dp = Array.from({ length: FULL }, () => new Float64Array(m).fill(Infinity));
  const parent = Array.from({ length: FULL }, () => new Int16Array(m).fill(-1));
  for (let j = 0; j < m; j++) dp[1 << j][j] = dist[0][j + 1];
  let evaluated = 0;
  for (let mask = 1; mask < FULL; mask++) {
    for (let j = 0; j < m; j++) {
      if (!(mask & (1 << j)) || dp[mask][j] === Infinity) continue;
      for (let k = 0; k < m; k++) {
        if (mask & (1 << k)) continue;
        const nm = mask | (1 << k);
        const cand = dp[mask][j] + dist[j + 1][k + 1];
        evaluated++;
        if (cand < dp[nm][k]) {
          dp[nm][k] = cand;
          parent[nm][k] = j;
        }
      }
    }
  }
  let bestLen = Infinity;
  let last = -1;
  for (let j = 0; j < m; j++) {
    const c = dp[FULL - 1][j] + dist[j + 1][0];
    if (c < bestLen) {
      bestLen = c;
      last = j;
    }
  }
  const tour = [0];
  let mask = FULL - 1;
  const rev = [];
  while (last !== -1) {
    rev.push(last + 1);
    const p = parent[mask][last];
    mask &= ~(1 << last);
    last = p;
  }
  tour.push(...rev.reverse(), 0);
  return { name: 'Held-Karp DP (exact)', tour, length: bestLen, evaluated, timeMs: clock() - t0 };
}

/** Nearest-neighbour greedy construction. */
export function nearestNeighbour(dist) {
  const t0 = clock();
  const n = dist.length;
  const visited = new Set([0]);
  const tour = [0];
  while (visited.size < n) {
    const cur = tour[tour.length - 1];
    let best = -1;
    for (let j = 0; j < n; j++) if (!visited.has(j) && (best < 0 || dist[cur][j] < dist[cur][best])) best = j;
    visited.add(best);
    tour.push(best);
  }
  tour.push(0);
  return { name: 'Nearest neighbour', tour, length: tourLength(tour, dist), evaluated: n * n, timeMs: clock() - t0 };
}

/** 2-opt local search: repeatedly reverses segments while the tour gets shorter. */
export function twoOpt(dist, start = nearestNeighbour(dist).tour) {
  const t0 = clock();
  let tour = [...start];
  let improved = true;
  let evaluated = 0;
  while (improved) {
    improved = false;
    for (let i = 1; i < tour.length - 2; i++) {
      for (let k = i + 1; k < tour.length - 1; k++) {
        evaluated++;
        const a = tour[i - 1], b = tour[i], c = tour[k], d = tour[k + 1];
        const delta = dist[a][c] + dist[b][d] - dist[a][b] - dist[c][d];
        if (delta < -1e-9) {
          tour = [...tour.slice(0, i), ...tour.slice(i, k + 1).reverse(), ...tour.slice(k + 1)];
          improved = true;
        }
      }
    }
  }
  return { name: 'Nearest neighbour + 2-opt', tour, length: tourLength(tour, dist), evaluated, timeMs: clock() - t0 };
}

export const TSP_SOLVERS = { bruteForce, heldKarp, nearestNeighbour, twoOpt };
