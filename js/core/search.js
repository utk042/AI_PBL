// Generic state-space search engine (Module 1).
//
// Every algorithm works on the same problem interface, so the road network,
// the Water-Jug, Missionaries-Cannibals and 8-puzzle problems all reuse it:
//
//   {
//     initial,                       // start state
//     isGoal(state) -> boolean,
//     successors(state) -> [{ state, action, cost }],
//     key(state) -> string,          // optional, used for the explored set
//     heuristic(state) -> number,    // optional, h(n) for informed search
//   }
//
// Each algorithm returns a SearchResult:
//   { algorithm, found, path, actions, cost, expanded, generated, maxFrontier, timeMs }

import { MinHeap } from './pq.js';

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const keyOf = (problem, state) => (problem.key ? problem.key(state) : JSON.stringify(state));
const hOf = (problem, state) => (problem.heuristic ? problem.heuristic(state) : 0);

function makeNode(state, parent, action, stepCost) {
  return {
    state,
    parent,
    action,
    g: parent ? parent.g + stepCost : 0,
    depth: parent ? parent.depth + 1 : 0,
  };
}

function unwind(node) {
  const path = [];
  const actions = [];
  for (let n = node; n; n = n.parent) {
    path.push(n.state);
    if (n.parent) actions.push(n.action);
  }
  return { path: path.reverse(), actions: actions.reverse() };
}

function result(algorithm, node, stats, t0) {
  const base = {
    algorithm,
    found: !!node,
    path: [],
    actions: [],
    cost: Infinity,
    expanded: stats.expanded,
    generated: stats.generated,
    maxFrontier: stats.maxFrontier,
    timeMs: clock() - t0,
  };
  if (!node) return base;
  return { ...base, ...unwind(node), cost: node.g };
}

const LIMIT = 500000; // safety cap on expansions so the browser never hangs

/** Breadth-First Search: shallowest goal first (optimal in number of steps). */
export function bfs(problem, { maxExpansions = LIMIT } = {}) {
  const t0 = clock();
  const stats = { expanded: 0, generated: 1, maxFrontier: 1 };
  const root = makeNode(problem.initial, null, null, 0);
  if (problem.isGoal(root.state)) return result('BFS', root, stats, t0);

  const frontier = [root];
  let head = 0;
  const reached = new Set([keyOf(problem, root.state)]);

  while (head < frontier.length && stats.expanded < maxExpansions) {
    const node = frontier[head++];
    stats.expanded++;
    for (const { state, action, cost } of problem.successors(node.state)) {
      const k = keyOf(problem, state);
      if (reached.has(k)) continue;
      const child = makeNode(state, node, action, cost);
      stats.generated++;
      if (problem.isGoal(state)) return result('BFS', child, stats, t0);
      reached.add(k);
      frontier.push(child);
    }
    stats.maxFrontier = Math.max(stats.maxFrontier, frontier.length - head);
  }
  return result('BFS', null, stats, t0);
}

/** Depth-First Search (graph search with an explored set and optional depth limit). */
export function dfs(problem, { depthLimit = Infinity, maxExpansions = LIMIT } = {}) {
  const t0 = clock();
  const stats = { expanded: 0, generated: 1, maxFrontier: 1 };
  const stack = [makeNode(problem.initial, null, null, 0)];
  const explored = new Set();

  while (stack.length && stats.expanded < maxExpansions) {
    const node = stack.pop();
    const k = keyOf(problem, node.state);
    if (explored.has(k)) continue;
    if (problem.isGoal(node.state)) return result('DFS', node, stats, t0);
    explored.add(k);
    stats.expanded++;
    if (node.depth >= depthLimit) continue;
    // Push in reverse so the first successor is explored first.
    const succ = problem.successors(node.state);
    for (let i = succ.length - 1; i >= 0; i--) {
      const { state, action, cost } = succ[i];
      if (explored.has(keyOf(problem, state))) continue;
      stack.push(makeNode(state, node, action, cost));
      stats.generated++;
    }
    stats.maxFrontier = Math.max(stats.maxFrontier, stack.length);
  }
  return result('DFS', null, stats, t0);
}

/** Iterative Deepening DFS: depth-limited tree search with on-path cycle checking. */
export function iddfs(problem, { maxDepth = 60, maxExpansions = LIMIT } = {}) {
  const t0 = clock();
  const stats = { expanded: 0, generated: 1, maxFrontier: 1 };

  for (let limit = 0; limit <= maxDepth; limit++) {
    const onPath = new Set();
    let cutoff = false;

    const recurse = (node) => {
      if (problem.isGoal(node.state)) return node;
      if (stats.expanded >= maxExpansions) return null;
      if (node.depth === limit) {
        cutoff = true;
        return null;
      }
      const k = keyOf(problem, node.state);
      onPath.add(k);
      stats.expanded++;
      stats.maxFrontier = Math.max(stats.maxFrontier, node.depth + 1);
      for (const { state, action, cost } of problem.successors(node.state)) {
        if (onPath.has(keyOf(problem, state))) continue;
        stats.generated++;
        const found = recurse(makeNode(state, node, action, cost));
        if (found) return found;
      }
      onPath.delete(k);
      return null;
    };

    const found = recurse(makeNode(problem.initial, null, null, 0));
    if (found) {
      const r = result('IDDFS', found, stats, t0);
      r.depthReached = limit;
      return r;
    }
    if (!cutoff) break; // whole space explored, no goal exists
  }
  return result('IDDFS', null, stats, t0);
}

/**
 * Bi-directional BFS. Needs an explicit goal state; `predecessors` defaults to
 * `successors`, which is correct for undirected graphs such as the road network.
 */
export function bidirectional(problem, { goal, predecessors, maxExpansions = LIMIT } = {}) {
  const t0 = clock();
  const stats = { expanded: 0, generated: 2, maxFrontier: 2 };
  const pred = predecessors || problem.successors.bind(problem);
  const startKey = keyOf(problem, problem.initial);
  const goalKey = keyOf(problem, goal);

  const fwd = new Map([[startKey, makeNode(problem.initial, null, null, 0)]]);
  const bwd = new Map([[goalKey, makeNode(goal, null, null, 0)]]);
  let fwdLayer = [problem.initial];
  let bwdLayer = [goal];

  const join = (meetKey) => {
    // Forward half: start .. meet, then walk the backward tree from meet to goal.
    const f = fwd.get(meetKey);
    let node = f;
    for (let b = bwd.get(meetKey); b.parent; b = b.parent) {
      node = makeNode(b.parent.state, node, b.action, b.g - b.parent.g);
    }
    return node;
  };

  if (startKey === goalKey) return result('Bi-directional', fwd.get(startKey), stats, t0);

  const expandLayer = (layer, mine, other) => {
    const next = [];
    for (const state of layer) {
      const node = mine.get(keyOf(problem, state));
      stats.expanded++;
      const succ = mine === fwd ? problem.successors(state) : pred(state);
      for (const { state: s, action, cost } of succ) {
        const k = keyOf(problem, s);
        if (mine.has(k)) continue;
        mine.set(k, makeNode(s, node, action, cost));
        stats.generated++;
        if (other.has(k)) return { meet: k };
        next.push(s);
      }
    }
    return { next };
  };

  while (fwdLayer.length && bwdLayer.length && stats.expanded < maxExpansions) {
    // Expand the smaller frontier first: this is what keeps bi-directional search cheap.
    const forward = fwdLayer.length <= bwdLayer.length;
    const out = forward ? expandLayer(fwdLayer, fwd, bwd) : expandLayer(bwdLayer, bwd, fwd);
    if (out.meet) return result('Bi-directional', join(out.meet), stats, t0);
    if (forward) fwdLayer = out.next;
    else bwdLayer = out.next;
    stats.maxFrontier = Math.max(stats.maxFrontier, fwdLayer.length + bwdLayer.length);
  }
  return result('Bi-directional', null, stats, t0);
}

function bestFirst(name, problem, f, { maxExpansions = LIMIT } = {}) {
  const t0 = clock();
  const stats = { expanded: 0, generated: 1, maxFrontier: 1 };
  const root = makeNode(problem.initial, null, null, 0);
  const frontier = new MinHeap();
  frontier.push(root, f(root));
  const bestG = new Map([[keyOf(problem, root.state), 0]]);
  const closed = new Set();

  while (frontier.size && stats.expanded < maxExpansions) {
    const node = frontier.pop();
    const k = keyOf(problem, node.state);
    if (closed.has(k)) continue; // stale queue entry
    if (problem.isGoal(node.state)) return result(name, node, stats, t0);
    closed.add(k);
    stats.expanded++;
    for (const { state, action, cost } of problem.successors(node.state)) {
      const ck = keyOf(problem, state);
      if (closed.has(ck)) continue;
      const child = makeNode(state, node, action, cost);
      if (bestG.has(ck) && bestG.get(ck) <= child.g) continue;
      bestG.set(ck, child.g);
      frontier.push(child, f(child));
      stats.generated++;
    }
    stats.maxFrontier = Math.max(stats.maxFrontier, frontier.size);
  }
  return result(name, null, stats, t0);
}

/** Uniform-Cost Search (Dijkstra): f(n) = g(n). */
export const ucs = (problem, opts) => bestFirst('Uniform Cost', problem, (n) => n.g, opts);

/** Greedy Best-First Search: f(n) = h(n). Fast, not guaranteed optimal. */
export const greedy = (problem, opts) =>
  bestFirst('Greedy Best-First', problem, (n) => hOf(problem, n.state), opts);

/** A* Search: f(n) = g(n) + h(n). Optimal when h is admissible. */
export const astar = (problem, opts) =>
  bestFirst('A*', problem, (n) => n.g + hOf(problem, n.state), opts);

export const ALGORITHMS = {
  bfs: { name: 'BFS', run: bfs, informed: false },
  dfs: { name: 'DFS', run: dfs, informed: false },
  iddfs: { name: 'Iterative Deepening', run: iddfs, informed: false },
  bidirectional: { name: 'Bi-directional', run: bidirectional, informed: false },
  ucs: { name: 'Uniform Cost', run: ucs, informed: false },
  greedy: { name: 'Greedy Best-First', run: greedy, informed: true },
  astar: { name: 'A*', run: astar, informed: true },
};
