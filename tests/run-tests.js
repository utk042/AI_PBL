// Dependency-free test runner: node tests/run-tests.js
import assert from 'node:assert/strict';
import { NODES, EDGES, DELIVERIES } from '../js/data/network.js';
import { RoadGraph } from '../js/core/graph.js';
import { bfs, dfs, iddfs, bidirectional, ucs, greedy, astar } from '../js/core/search.js';
import { tourLength, bruteForce, heldKarp, nearestNeighbour, twoOpt } from '../js/core/tsp.js';
import { waterJugProblem } from '../js/problems/waterJug.js';
import { missionariesProblem } from '../js/problems/missionaries.js';
import { puzzleProblem, scramble, isSolvable } from '../js/problems/puzzle8.js';
import { solveNQueens } from '../js/problems/nQueens.js';
import { truthTable, entails, forwardChain, backwardChain } from '../js/kr/propositional.js';
import { FolKB, parseAtom, parseRule, unify } from '../js/kr/fol.js';
import { buildLogisticsNet } from '../js/kr/semanticNet.js';
import { buildLogisticsFrames } from '../js/kr/frames.js';
import { InferenceEngine } from '../js/kr/expertSystem.js';
import { DISPATCH_RULES } from '../js/kr/dispatchRules.js';
import { buildWorld, planRoutes, planBaseline } from '../js/planner.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
}

const graph = new RoadGraph(NODES, EDGES);

console.log('Module 1 - search');
test('graph is connected', () => {
  const r = bfs({ ...graph.routeProblem('N0', 'none'), isGoal: () => false });
  assert.equal(r.expanded, NODES.length);
});
test('straight-line heuristic is admissible for every pair', () => {
  for (const a of NODES) for (const b of NODES) {
    if (a.id === b.id) continue;
    const opt = ucs(graph.routeProblem(a.id, b.id)).cost;
    assert.ok(graph.straightLine(a.id, b.id) <= opt + 1e-9, `${a.id}-${b.id}`);
  }
});
test('A* matches Uniform Cost (optimal) on every pair and expands no more nodes', () => {
  let ea = 0;
  let eu = 0;
  for (const a of NODES) for (const b of NODES) {
    if (a.id === b.id) continue;
    const p = graph.routeProblem(a.id, b.id);
    const ra = astar(p);
    const ru = ucs(p);
    assert.ok(Math.abs(ra.cost - ru.cost) < 1e-9, `${a.id}-${b.id}`);
    ea += ra.expanded;
    eu += ru.expanded;
  }
  assert.ok(ea < eu);
});
test('BFS, DFS, IDDFS, bi-directional and greedy all reach the goal', () => {
  const p = graph.routeProblem('N17', 'N19');
  for (const r of [bfs(p), dfs(p), iddfs(p), bidirectional(p, { goal: 'N19' }), greedy(p)]) {
    assert.ok(r.found, r.algorithm);
    assert.equal(r.path[0], 'N17');
    assert.equal(r.path.at(-1), 'N19');
  }
});
test('BFS returns the fewest-edges path and IDDFS the same depth', () => {
  const p = graph.routeProblem('N0', 'N19');
  assert.equal(bfs(p).path.length, iddfs(p).path.length);
  assert.equal(bfs(p).path.length, bidirectional(p, { goal: 'N19' }).path.length);
});

console.log('Module 2 - classic problems');
test('Water-Jug 4/3 -> 2 needs 6 moves (BFS)', () => {
  assert.equal(bfs(waterJugProblem(4, 3, 2)).actions.length, 6);
});
test('Water-Jug with impossible target has no solution', () => {
  assert.equal(bfs(waterJugProblem(6, 4, 3)).found, false);
});
test('Missionaries & Cannibals 3/3 needs 11 crossings and stays safe', () => {
  const p = missionariesProblem(3, 2);
  const r = bfs(p);
  assert.equal(r.actions.length, 11);
  assert.ok(r.path.every((s) => p.isSafe(s)));
});
test('8-puzzle: A* (both heuristics) and BFS agree on optimal length', () => {
  const s = scramble(22, 3);
  assert.ok(isSolvable(s));
  const b = bfs(puzzleProblem(s));
  const m = astar(puzzleProblem(s, 'misplaced'));
  const h = astar(puzzleProblem(s, 'manhattan'));
  assert.equal(m.actions.length, b.actions.length);
  assert.equal(h.actions.length, b.actions.length);
  assert.ok(h.expanded <= m.expanded && m.expanded < b.expanded);
});
test('N-Queens: valid boards for N = 1, 4, 8, 20 and none for N = 3', () => {
  for (const n of [1, 4, 8, 20]) {
    const { board } = solveNQueens(n);
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      assert.notEqual(board[a], board[b]);
      assert.notEqual(Math.abs(board[a] - board[b]), b - a);
    }
  }
  assert.equal(solveNQueens(3).board, null);
});
test('TSP: Held-Karp equals brute force; 2-opt never worse than nearest neighbour', () => {
  const pts = ['N0', ...new Set(DELIVERIES.map((d) => d.node))].slice(0, 9);
  const dist = pts.map((a) => pts.map((b) => (a === b ? 0 : astar(graph.routeProblem(a, b)).cost)));
  const bf = bruteForce(dist);
  const hk = heldKarp(dist);
  assert.ok(Math.abs(bf.length - hk.length) < 1e-9);
  assert.ok(Math.abs(tourLength(hk.tour, dist) - hk.length) < 1e-9);
  assert.ok(twoOpt(dist).length <= nearestNeighbour(dist).length + 1e-9);
});

console.log('Module 3 - knowledge representation');
test('propositional: modus ponens is a tautology', () => {
  assert.ok(truthTable('(P & (P -> Q)) -> Q').tautology);
  assert.ok(truthTable('P & !P').contradiction);
});
test('propositional: entailment, forward and backward chaining agree', () => {
  const kb = ['WithinCapacity', 'WithinWindow', 'WithinCapacity & WithinWindow -> Feasible'];
  assert.ok(entails(kb, 'Feasible').entailed);
  assert.equal(entails(['WithinCapacity'], 'Feasible').entailed, false);
  const rules = [{ id: 'R1', if: ['WithinCapacity', 'WithinWindow'], then: 'Feasible' }];
  assert.ok(forwardChain(['WithinCapacity', 'WithinWindow'], rules).facts.includes('Feasible'));
  assert.ok(backwardChain('Feasible', ['WithinCapacity', 'WithinWindow'], rules).proved);
});
test('FOL: unification and rule chaining with built-ins', () => {
  assert.deepEqual(unify(parseAtom('P(?x, 3)'), parseAtom('P(A, ?y)')), { '?x': 'A', '?y': 3 });
  assert.equal(unify(parseAtom('P(A)'), parseAtom('P(B)')), null);
  const kb = new FolKB();
  ['Capacity(V1, 300)', 'Capacity(B1, 20)', 'Demand(D1, 40)'].forEach((f) => kb.tell(parseAtom(f)));
  kb.addRule(parseRule('CanCarry(?v, ?d) <= Capacity(?v, ?c) & Demand(?d, ?w) & le(?w, ?c)', 'r'));
  kb.forwardChain();
  assert.deepEqual(kb.query('CanCarry(?v, D1)').map((a) => a.args[0]), ['V1']);
});
test('semantic network inheritance', () => {
  const net = buildLogisticsNet([{ id: 'RV-1', type: 'RefrigeratedVan' }], [], 'Depot X');
  assert.ok(net.isA('RV-1', 'Vehicle'));
  assert.deepEqual(net.lookup('RV-1', 'starts-at').values, ['Depot']);
  assert.ok(net.lookup('RV-1', 'can-carry').values.includes('perishable'));
  assert.equal(net.isA('RV-1', 'Truck'), false);
});
test('frames: defaults, inheritance, if-needed and if-added demons', () => {
  const fs = buildLogisticsFrames([{ id: 'RV-1', type: 'RefrigeratedVan' }], []);
  assert.equal(fs.get('RV-1', 'capacity'), 250);
  assert.equal(fs.get('RV-1', 'speedFactor'), 1.0);
  fs.set('RV-1', 'currentLoad', 100);
  assert.equal(fs.get('RV-1', 'remainingCapacity'), 150);
  fs.set('RV-1', 'currentLoad', 300);
  assert.equal(fs.log.length, 1);
});
test('expert system: perishable order -> refrigerated van, with explanation', () => {
  const es = new InferenceEngine(DISPATCH_RULES);
  const r = es.forward({ item: 'perishable', demand: 40, zone: 'residential', priority: 'high', windowStart: 0, windowEnd: 120 });
  assert.deepEqual(r.wm.values('allowed-class'), ['RefrigeratedVan']);
  assert.ok(r.fired.includes('R1') && r.fired.includes('R2'));
  assert.equal(r.wm.first('wave'), 'first');
  assert.ok(es.backward({ attr: 'allowed-class', value: 'RefrigeratedVan' }, { item: 'perishable' }).proved);
});
test('expert system: default rule fires only when nothing else decides the class', () => {
  const es = new InferenceEngine(DISPATCH_RULES);
  assert.deepEqual(es.forward({ item: 'standard', demand: 50, zone: 'residential' }).wm.values('allowed-class'), ['Vehicle']);
  assert.deepEqual(es.forward({ item: 'bulk', demand: 400, zone: 'industrial' }).wm.values('allowed-class'), ['Truck']);
});

console.log('Integration - multi-vehicle planner');
test('knowledge-based plan serves every delivery with zero violations', () => {
  const plan = planRoutes(buildWorld());
  assert.equal(plan.summary.served, DELIVERIES.length);
  assert.equal(plan.summary.windowViolations, 0);
  assert.equal(plan.summary.capacityViolations, 0);
  assert.equal(plan.summary.ruleViolations, 0);
  assert.ok(plan.coverage.holds);
});
test('plan beats the BFS and DFS baselines on distance', () => {
  const w = buildWorld();
  const p = planRoutes(w).summary;
  assert.ok(p.distance < planBaseline(w, { algorithm: 'bfs' }).summary.distance);
  assert.ok(p.distance < planBaseline(w, { algorithm: 'dfs' }).summary.distance);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
