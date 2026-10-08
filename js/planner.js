// Integrated route-planning pipeline. Each stage maps to a syllabus module:
//
//   1. Road network -> weighted graph                                   (Module 1)
//   2. Vehicles & deliveries -> frames + semantic network               (Module 3)
//   3. Expert system decides permitted vehicle classes per delivery      (Module 3)
//   4. First-order logic rules derive Feasible(v, d) for every pair      (Module 3)
//   5. CSP assigns deliveries to vehicles (capacity + time windows)      (Module 1)
//   6. A* builds the stop-to-stop distance matrix                        (Module 1)
//   7. TSP with time windows orders each vehicle's stops                 (Module 2)
//
// planBaseline() is the naive comparison: round-robin assignment, stops in
// listed order, uninformed (BFS/DFS) paths, no knowledge base.

import { NODES, EDGES, DELIVERIES, VEHICLES, DEPOT, SERVICE_MINUTES } from './data/network.js';
import { RoadGraph } from './core/graph.js';
import { ALGORITHMS } from './core/search.js';
import { solveCSP } from './core/csp.js';
import { buildLogisticsFrames } from './kr/frames.js';
import { buildLogisticsNet } from './kr/semanticNet.js';
import { InferenceEngine } from './kr/expertSystem.js';
import { DISPATCH_RULES } from './kr/dispatchRules.js';
import { FolKB, atom, parseRule } from './kr/fol.js';

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const r1 = (v) => Math.round(v * 10) / 10;

export function buildWorld({ deliveries = DELIVERIES, vehicles = VEHICLES } = {}) {
  const graph = new RoadGraph(NODES, EDGES);
  const frames = buildLogisticsFrames(vehicles, deliveries);
  const net = buildLogisticsNet(vehicles, deliveries, graph.node(DEPOT).name);
  const engine = new InferenceEngine(DISPATCH_RULES);
  return { graph, frames, net, engine, deliveries, vehicles };
}

/** Facts given to the expert system for one delivery. */
export function deliveryFacts(world, d) {
  return {
    item: d.item,
    demand: d.demand,
    zone: world.graph.node(d.node).zone,
    priority: d.priority,
    windowStart: d.window[0],
    windowEnd: d.window[1],
  };
}

/** Stage 3: expert-system advice for every delivery. */
export function adviseAll(world) {
  const out = {};
  for (const d of world.deliveries) {
    const run = world.engine.forward(deliveryFacts(world, d));
    out[d.id] = {
      allowed: run.wm.values('allowed-class'),
      forbidden: run.wm.values('forbidden-class'),
      wave: run.wm.first('wave'),
      advice: run.advice,
      run,
    };
  }
  return out;
}

/** Vehicle classes permitted by the expert system, checked through the semantic network. */
export function permittedVehicles(world, delivery, advice) {
  const { net, graph } = world;
  const zone = graph.node(delivery.node).zone;
  return world.vehicles.filter((v) => {
    const allowed = advice.allowed.some((c) => net.isA(v.type, c));
    const forbidden = advice.forbidden.some((c) => net.isA(v.type, c));
    const carries = net.lookup(v.type, 'can-carry').values.includes(delivery.item);
    const blocked = net.lookup(v.type, 'cannot-enter').values.includes(zone);
    return allowed && !forbidden && carries && !blocked;
  });
}

/** Stage 6: all-pairs route costs between depot and delivery points using a search algorithm. */
export function buildMatrix(graph, points, algorithm = 'astar', weight = 'distance') {
  const algo = ALGORITHMS[algorithm];
  const n = points.length;
  const dist = Array.from({ length: n }, () => new Array(n).fill(0));
  const time = Array.from({ length: n }, () => new Array(n).fill(0));
  const paths = Array.from({ length: n }, () => new Array(n).fill(null));
  let expanded = 0;
  let searches = 0;
  const t0 = clock();
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) { paths[i][j] = [points[i]]; continue; }
      const problem = graph.routeProblem(points[i], points[j], { weight });
      const res = algo.run(problem, { goal: points[j] });
      searches++;
      expanded += res.expanded;
      paths[i][j] = res.path;
      const m = graph.pathMetrics(res.path);
      dist[i][j] = m.distance;
      time[i][j] = m.time;
    }
  }
  return { points, dist, time, paths, expanded, searches, timeMs: clock() - t0 };
}

/**
 * Stage 7: order one vehicle's stops (TSP with time windows).
 * Exact branch-and-bound over permutations for up to 8 stops, otherwise
 * nearest-feasible-neighbour. Minimises distance among time-feasible orders;
 * if none is feasible, returns the order with the least total lateness.
 */
export function sequenceStops(matrix, stops, speedFactor = 1, { exact = true } = {}) {
  const idx = (node) => matrix.points.indexOf(node);
  const n = stops.length;
  if (!n) return { order: [], distance: 0, finish: 0, arrivals: [], feasible: true, lateness: 0 };
  const travel = (a, b) => matrix.time[a][b] / speedFactor;

  const simulate = (order) => {
    let t = 0;
    let at = 0;
    let distance = 0;
    let lateness = 0;
    const arrivals = [];
    for (const s of order) {
      const k = idx(s.node);
      t += travel(at, k);
      distance += matrix.dist[at][k];
      const arrive = t;
      t = Math.max(t, s.window[0]); // wait if early
      lateness += Math.max(0, arrive - s.window[1]);
      arrivals.push({ id: s.id, arrive: r1(arrive), start: r1(t), late: r1(Math.max(0, arrive - s.window[1])) });
      t += SERVICE_MINUTES;
      at = k;
    }
    t += travel(at, 0);
    distance += matrix.dist[at][0];
    return { order, distance: r1(distance), finish: r1(t), arrivals, feasible: lateness === 0, lateness: r1(lateness) };
  };

  if (exact && n <= 8) {
    let best = null;
    const better = (a, b) =>
      !b || (a.feasible && !b.feasible) || (a.feasible === b.feasible && (a.feasible ? a.distance < b.distance : a.lateness < b.lateness));
    const recurse = (prefix, rest) => {
      if (!rest.length) {
        const s = simulate(prefix);
        if (better(s, best)) best = s;
        return;
      }
      // Bound: a feasible best already beats this partial route on distance.
      if (best?.feasible) {
        const partial = simulate(prefix);
        if (!partial.feasible || partial.distance - matrix.dist[idx(prefix.at(-1).node)][0] >= best.distance) return;
      }
      rest.forEach((s, i) => recurse([...prefix, s], rest.filter((_, j) => j !== i)));
    };
    recurse([], stops);
    return best;
  }

  // Nearest feasible neighbour, earliest deadline as tie-breaker.
  const order = [];
  const left = [...stops];
  let at = 0;
  while (left.length) {
    left.sort((a, b) => matrix.dist[at][idx(a.node)] - matrix.dist[at][idx(b.node)] || a.window[1] - b.window[1]);
    const next = left.shift();
    order.push(next);
    at = idx(next.node);
  }
  return simulate(order);
}

/** Full knowledge-based plan (stages 1-7). */
export function planRoutes(world = buildWorld(), { algorithm = 'astar', weight = 'distance', exact = true } = {}) {
  const t0 = clock();
  const { graph, frames, deliveries, vehicles } = world;
  const byId = Object.fromEntries(deliveries.map((d) => [d.id, d]));

  // Stage 3: expert system.
  const advice = adviseAll(world);

  // Stage 6 (computed early - the CSP needs travel times).
  const points = [DEPOT, ...new Set(deliveries.map((d) => d.node))];
  const matrix = buildMatrix(graph, points, algorithm, weight);

  // Stage 4: first-order logic feasibility over all vehicle/delivery pairs.
  const kb = new FolKB();
  for (const v of vehicles) {
    kb.tell(atom('Vehicle', v.id));
    kb.tell(atom('Capacity', v.id, frames.get(v.id, 'capacity')));
  }
  for (const d of deliveries) {
    kb.tell(atom('Delivery', d.id));
    kb.tell(atom('Demand', d.id, d.demand));
    kb.tell(atom('WindowEnd', d.id, d.window[1]));
    for (const v of permittedVehicles(world, d, advice[d.id])) kb.tell(atom('Permitted', v.id, d.id));
    for (const v of vehicles) {
      const direct = matrix.time[0][points.indexOf(d.node)] / frames.get(v.id, 'speedFactor');
      kb.tell(atom('DirectTime', v.id, d.id, r1(direct)));
    }
  }
  kb.addRule(parseRule('CanCarry(?v, ?d) <= Capacity(?v, ?c) & Demand(?d, ?w) & le(?w, ?c)', 'FOL-1 capacity'));
  kb.addRule(parseRule('Reachable(?v, ?d) <= DirectTime(?v, ?d, ?t) & WindowEnd(?d, ?e) & le(?t, ?e)', 'FOL-2 reachability'));
  kb.addRule(parseRule('Feasible(?v, ?d) <= Permitted(?v, ?d) & CanCarry(?v, ?d) & Reachable(?v, ?d)', 'FOL-3 feasibility'));
  kb.addRule(parseRule('HasOption(?d) <= Feasible(?v, ?d)', 'FOL-4 option'));
  kb.addRule(parseRule('Unservable(?d) <= Delivery(?d) & !HasOption(?d)', 'FOL-5 unservable'));
  const folTrace = kb.forwardChain();
  const coverage = kb.forAllExists(deliveries.map((d) => d.id), 'Feasible');

  // Stage 5: CSP assignment.
  const domains = {};
  for (const d of deliveries) domains[d.id] = kb.query(`Feasible(?v, ${d.id})`).map((a) => a.args[0]);

  const routeCache = new Map();
  const routeFor = (vehId, ids) => {
    const key = `${vehId}|${[...ids].sort().join(',')}`;
    if (!routeCache.has(key)) {
      routeCache.set(key, sequenceStops(matrix, ids.map((i) => byId[i]), frames.get(vehId, 'speedFactor'), { exact }));
    }
    return routeCache.get(key);
  };
  const assignedTo = (assignment, vehId) => Object.keys(assignment).filter((k) => assignment[k] === vehId);

  const csp = {
    variables: deliveries.map((d) => d.id),
    domains,
    consistent(assignment, dId, vehId) {
      const ids = [...assignedTo(assignment, vehId).filter((k) => k !== dId), dId];
      const load = ids.reduce((s, k) => s + byId[k].demand, 0);
      if (load > frames.get(vehId, 'capacity')) return false; // capacity constraint
      return routeFor(vehId, ids).feasible; // time-window constraint
    },
    orderValues(assignment, dId, values) {
      // Least added distance first (cheapest insertion), so the first solution is already a good one.
      const cost = (vehId) => {
        const ids = assignedTo(assignment, vehId);
        return routeFor(vehId, [...ids, dId]).distance - routeFor(vehId, ids).distance;
      };
      return [...values].sort((a, b) => cost(a) - cost(b));
    },
  };
  const cspResult = solveCSP(csp, { forwardChecking: true, mrv: true });

  // Stage 7: sequence each vehicle's stops and expand to full road paths.
  const routes = [];
  if (cspResult.solution) {
    for (const v of vehicles) {
      const ids = assignedTo(cspResult.solution, v.id);
      if (!ids.length) continue;
      const seq = routeFor(v.id, ids);
      const nodes = [DEPOT, ...seq.order.map((s) => s.node), DEPOT];
      const roadPath = [DEPOT];
      for (let i = 1; i < nodes.length; i++) {
        roadPath.push(...matrix.paths[points.indexOf(nodes[i - 1])][points.indexOf(nodes[i])].slice(1));
      }
      const load = ids.reduce((s, k) => s + byId[k].demand, 0);
      routes.push({
        vehicle: v,
        stops: seq.order.map((s) => s.id),
        arrivals: seq.arrivals,
        roadPath,
        distance: seq.distance,
        finish: seq.finish,
        load,
        capacity: frames.get(v.id, 'capacity'),
        fuel: r1(seq.distance * frames.get(v.id, 'fuelPerKm')),
        feasible: seq.feasible,
      });
    }
  }

  return {
    method: `${ALGORITHMS[algorithm].name} + KB + CSP + TSP`,
    advice,
    domains,
    kb,
    folTrace,
    coverage,
    csp: cspResult,
    matrix,
    routes,
    summary: summarise(routes, matrix, deliveries, clock() - t0, world, advice),
  };
}

function summarise(routes, matrix, deliveries, timeMs, world, advice) {
  const served = new Set(routes.flatMap((r) => r.stops));
  let windowViolations = 0;
  let capacityViolations = 0;
  let ruleViolations = 0;
  for (const r of routes) {
    windowViolations += r.arrivals.filter((a) => a.late > 0).length;
    if (r.load > r.capacity) capacityViolations++;
    if (advice) {
      for (const id of r.stops) {
        const d = deliveries.find((x) => x.id === id);
        if (!permittedVehicles(world, d, advice[id]).some((v) => v.id === r.vehicle.id)) ruleViolations++;
      }
    }
  }
  return {
    vehiclesUsed: routes.length,
    served: served.size,
    total: deliveries.length,
    distance: r1(routes.reduce((s, r) => s + r.distance, 0)),
    makespan: r1(Math.max(0, ...routes.map((r) => r.finish))),
    fuel: r1(routes.reduce((s, r) => s + r.fuel, 0)),
    nodesExpanded: matrix.expanded,
    searches: matrix.searches,
    windowViolations,
    capacityViolations,
    ruleViolations,
    timeMs: r1(timeMs),
  };
}

/** Naive baseline: round-robin assignment, listed order, uninformed paths, no knowledge base. */
export function planBaseline(world = buildWorld(), { algorithm = 'bfs' } = {}) {
  const t0 = clock();
  const { graph, frames, deliveries, vehicles } = world;
  const points = [DEPOT, ...new Set(deliveries.map((d) => d.node))];
  const matrix = buildMatrix(graph, points, algorithm, 'distance');
  const advice = adviseAll(world);
  const routes = vehicles.map((v, i) => {
    const mine = deliveries.filter((_, k) => k % vehicles.length === i);
    const speed = frames.get(v.id, 'speedFactor');
    let t = 0;
    let at = 0;
    let distance = 0;
    const arrivals = [];
    const roadPath = [DEPOT];
    for (const d of mine) {
      const k = points.indexOf(d.node);
      t += matrix.time[at][k] / speed;
      distance += matrix.dist[at][k];
      roadPath.push(...matrix.paths[at][k].slice(1));
      arrivals.push({ id: d.id, arrive: r1(t), start: r1(Math.max(t, d.window[0])), late: r1(Math.max(0, t - d.window[1])) });
      t = Math.max(t, d.window[0]) + SERVICE_MINUTES;
      at = k;
    }
    t += matrix.time[at][0] / speed;
    distance += matrix.dist[at][0];
    roadPath.push(...matrix.paths[at][0].slice(1));
    const load = mine.reduce((s, d) => s + d.demand, 0);
    return {
      vehicle: v,
      stops: mine.map((d) => d.id),
      arrivals,
      roadPath,
      distance: r1(distance),
      finish: r1(t),
      load,
      capacity: frames.get(v.id, 'capacity'),
      fuel: r1(distance * frames.get(v.id, 'fuelPerKm')),
      feasible: arrivals.every((a) => a.late === 0) && load <= frames.get(v.id, 'capacity'),
    };
  });
  return {
    method: `${ALGORITHMS[algorithm].name} baseline (no KB / CSP)`,
    routes,
    matrix,
    summary: summarise(routes, matrix, deliveries, clock() - t0, world, advice),
  };
}

export const formatClock = (minutes) => {
  const total = Math.round(minutes) + 9 * 60;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
