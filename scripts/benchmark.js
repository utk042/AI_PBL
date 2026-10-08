// Benchmark used for the Review 2 results table: node scripts/benchmark.js
import { buildWorld, planRoutes, planBaseline } from '../js/planner.js';
import { NODES } from '../js/data/network.js';
import { bfs, dfs, iddfs, bidirectional, ucs, greedy, astar } from '../js/core/search.js';

const world = buildWorld();
const runs = 20;
const avg = (fn) => {
  let last;
  let t = 0;
  for (let i = 0; i < runs; i++) {
    last = fn();
    t += last.summary.timeMs;
  }
  return { ...last.summary, timeMs: Math.round((t / runs) * 10) / 10, method: last.method, csp: last.csp };
};

const rows = [
  avg(() => planBaseline(world, { algorithm: 'dfs' })),
  avg(() => planBaseline(world, { algorithm: 'bfs' })),
  avg(() => planRoutes(world, { algorithm: 'ucs' })),
  avg(() => planRoutes(world, { algorithm: 'greedy' })),
  avg(() => planRoutes(world, { algorithm: 'astar' })),
];

console.log('\nFleet plan (12 deliveries, 4 vehicles, 22 junctions, 37 roads)\n');
console.table(rows.map((r) => ({
  method: r.method,
  'distance km': r.distance,
  'fuel L': r.fuel,
  'return time': r.makespan,
  'nodes expanded': r.nodesExpanded,
  'window viol.': r.windowViolations,
  'capacity viol.': r.capacityViolations,
  'rule viol.': r.ruleViolations,
  'ms (avg)': r.timeMs,
  'csp assign/backtrack': r.csp ? `${r.csp.assignments}/${r.csp.backtracks}` : '-',
})));

// Single-route comparison over every ordered pair of junctions.
const algos = { BFS: bfs, DFS: dfs, IDDFS: iddfs, 'Bi-directional': bidirectional, 'Uniform Cost': ucs, 'Greedy Best-First': greedy, 'A*': astar };
const stats = Object.fromEntries(Object.keys(algos).map((k) => [k, { expanded: 0, optimal: 0, cost: 0 }]));
let pairs = 0;
for (const a of NODES) for (const b of NODES) {
  if (a.id === b.id) continue;
  pairs++;
  const p = world.graph.routeProblem(a.id, b.id);
  const best = ucs(p).cost;
  for (const [k, fn] of Object.entries(algos)) {
    const r = fn(p, { goal: b.id });
    const c = world.graph.pathMetrics(r.path).distance;
    stats[k].expanded += r.expanded;
    stats[k].cost += c;
    if (Math.abs(c - best) < 1e-6) stats[k].optimal++;
  }
}
console.log(`\nSingle-route search over all ${pairs} junction pairs\n`);
console.table(Object.entries(stats).map(([k, s]) => ({
  algorithm: k,
  'avg nodes expanded': Math.round((s.expanded / pairs) * 10) / 10,
  'avg route km': Math.round((s.cost / pairs) * 10) / 10,
  'optimal routes': `${s.optimal}/${pairs}`,
})));
