// Route options between two places for one vehicle: fastest, shortest, lowest cost,
// lowest fare and balanced. Each option is an A* search with its own edge cost and
// an admissible heuristic (a lower bound for that cost), so every option is optimal
// for what it optimises. explainRoute() turns the result into plain sentences.

import { astar, ucs } from './search.js';

export const FUEL_PRICE = { petrol: 95, diesel: 88 }; // Rs per litre
export const DRIVER_RATE = 2.5; // Rs per minute of driving (Rs 150 per hour)
// Stop-and-go driving on smaller roads uses more fuel per km.
export const FUEL_FACTOR = { main: 1.0, arterial: 1.1, local: 1.25 };

export const CRITERIA = {
  fastest: { label: 'Fastest', metric: 'time' },
  shortest: { label: 'Shortest', metric: 'distance' },
  cheapest: { label: 'Lowest cost', metric: 'cost' },
  fare: { label: 'Lowest fare', metric: 'fare' },
  balanced: { label: 'Balanced', metric: null },
};

/** Cost profile of a vehicle class, read from its frame. */
export function vehicleProfile(frames, frameName) {
  const get = (slot) => frames.get(frameName, slot);
  return {
    frame: frameName,
    speedFactor: get('speedFactor'),
    fuelPerKm: get('fuelPerKm'),
    fuelPrice: FUEL_PRICE[get('fuelType')],
    baseFare: get('baseFare'),
    farePerKm: get('farePerKm'),
    farePerMin: get('farePerMin'),
  };
}

/** Distance, time, running cost and customer fare of one road for one vehicle. */
export function edgeMetrics(e, p) {
  const time = e.time / p.speedFactor;
  return {
    distance: e.distance,
    time,
    cost: e.distance * p.fuelPerKm * FUEL_FACTOR[e.type] * p.fuelPrice + time * DRIVER_RATE,
    fare: e.distance * p.farePerKm + time * p.farePerMin,
  };
}

export function routeMetrics(graph, path, p) {
  const m = { distance: 0, time: 0, cost: 0, fare: path.length > 1 ? p.baseFare : 0 };
  for (const e of graph.pathEdges(path)) {
    const x = edgeMetrics(e, p);
    m.distance += x.distance;
    m.time += x.time;
    m.cost += x.cost;
    m.fare += x.fare;
  }
  return m;
}

/** Lower bound on each metric per straight-line km (keeps A* admissible). */
function lowerBounds(graph, p) {
  const minPerKm = 1 / (graph.maxKmPerMin * p.speedFactor); // minutes per km at top speed
  return {
    distance: (km) => km,
    time: (km) => km * minPerKm,
    cost: (km) => km * (p.fuelPerKm * Math.min(...Object.values(FUEL_FACTOR)) * p.fuelPrice + minPerKm * DRIVER_RATE),
    fare: (km) => km * (p.farePerKm + minPerKm * p.farePerMin),
  };
}

/** Places a vehicle class may not enter, from the semantic network (cannot-enter links). */
export function blockedPlaces(graph, net, frameName) {
  const zones = net.lookup(frameName, 'cannot-enter').values;
  return new Set([...graph.nodes.values()].filter((n) => zones.includes(n.zone)).map((n) => n.id));
}

function costFunctions(graph, p, metric, scale) {
  const lb = lowerBounds(graph, p);
  let weight;
  let h;
  if (metric) {
    weight = (e) => edgeMetrics(e, p)[metric];
    h = lb[metric];
  } else {
    // Balanced: each metric divided by its best possible value, then added.
    const keys = ['time', 'distance', 'cost'];
    weight = (e) => {
      const m = edgeMetrics(e, p);
      return keys.reduce((s, k) => s + m[k] / scale[k], 0);
    };
    h = (km) => keys.reduce((s, k) => s + lb[k](km) / scale[k], 0);
  }
  return { weight, heuristic: h };
}

function search(graph, from, to, p, metric, blocked, scale) {
  const problem = graph.routeProblem(from, to, { ...costFunctions(graph, p, metric, scale), blocked });
  return { result: astar(problem), uninformed: ucs(problem) };
}

/**
 * Yen's k-shortest loopless paths, using A* for every spur search.
 * Gives genuinely different alternatives, ranked by the chosen cost.
 */
export function kShortestPaths(graph, from, to, { weight, heuristic, blocked }, k = 3) {
  const cost = (path) => graph.pathEdges(path).reduce((s, e) => s + weight(e), 0);
  const first = astar(graph.routeProblem(from, to, { weight, heuristic, blocked }));
  if (!first.found) return [];
  const A = [first.path];
  const B = [];
  for (let n = 1; n < k; n++) {
    const prev = A[n - 1];
    for (let i = 0; i < prev.length - 1; i++) {
      const spur = prev[i];
      const root = prev.slice(0, i + 1);
      const bannedEdges = new Set();
      for (const p of A) {
        if (p.length > i && p.slice(0, i + 1).join() === root.join()) bannedEdges.add(`${p[i]}>${p[i + 1]}`);
      }
      const bannedNodes = new Set([...(blocked || []), ...root.slice(0, -1)]);
      const base = graph.routeProblem(spur, to, { weight, heuristic, blocked: bannedNodes });
      const problem = { ...base, successors: (s) => base.successors(s).filter((x) => !bannedEdges.has(`${s}>${x.state}`)) };
      const r = astar(problem);
      if (!r.found) continue;
      const total = [...root.slice(0, -1), ...r.path];
      if (![...A, ...B.map((b) => b.path)].some((p) => p.join() === total.join())) B.push({ path: total, cost: cost(total) });
    }
    if (!B.length) break;
    B.sort((a, b) => a.cost - b.cost);
    A.push(B.shift().path);
  }
  return A;
}

/**
 * All five options plus the distinct routes they produce.
 * Returns { error } when the vehicle may not enter the destination.
 */
export function findRouteOptions(graph, net, frames, { from, to, vehicle }) {
  const p = vehicleProfile(frames, vehicle);
  const blocked = blockedPlaces(graph, net, vehicle);
  for (const id of [from, to]) {
    if (blocked.has(id)) {
      return { error: `${label(vehicle)[0].toUpperCase()}${label(vehicle).slice(1)}s can't enter ${graph.node(id).name} (narrow lanes). Pick a smaller vehicle.` };
    }
  }

  const options = {};
  for (const [key, c] of Object.entries(CRITERIA)) {
    if (!c.metric) continue;
    const { result, uninformed } = search(graph, from, to, p, c.metric, blocked);
    options[key] = { key, path: result.path, metrics: routeMetrics(graph, result.path, p), expanded: result.expanded, uninformedExpanded: uninformed.expanded };
  }
  const scale = {
    time: Math.max(options.fastest.metrics.time, 1e-9),
    distance: Math.max(options.shortest.metrics.distance, 1e-9),
    cost: Math.max(options.cheapest.metrics.cost, 1e-9),
  };
  const bal = search(graph, from, to, p, null, blocked, scale);
  options.balanced = { key: 'balanced', path: bal.result.path, metrics: routeMetrics(graph, bal.result.path, p), expanded: bal.result.expanded, uninformedExpanded: bal.uninformed.expanded };

  // Group identical paths so the user sees each different route once.
  const routes = [];
  for (const [key, o] of Object.entries(options)) {
    const sig = o.path.join('>');
    let r = routes.find((x) => x.sig === sig);
    if (!r) {
      r = { sig, path: o.path, metrics: o.metrics, best: [], geometry: graph.pathGeometry(o.path) };
      routes.push(r);
    }
    r.best.push(key);
  }

  // Fill up to three routes with the next-best alternatives by travel time.
  if (routes.length < 3) {
    for (const path of kShortestPaths(graph, from, to, { ...costFunctions(graph, p, 'time'), blocked }, 6)) {
      if (routes.length >= 3) break;
      const sig = path.join('>');
      if (routes.some((x) => x.sig === sig)) continue;
      const metrics = routeMetrics(graph, path, p);
      // Skip alternatives that are much slower, or that mostly drive along an existing route.
      if (metrics.time > options.fastest.metrics.time * 1.5) continue;
      const geometry = graph.pathGeometry(path);
      if (routes.some((x) => overlap(geometry, x.geometry) > 0.75)) continue;
      routes.push({ sig, path, metrics, best: [], geometry });
    }
  }

  // Would the route differ without the vehicle's access rules?
  const free = {};
  if (blocked.size) {
    for (const [key, c] of Object.entries(CRITERIA)) {
      if (!c.metric) continue;
      free[key] = search(graph, from, to, p, c.metric, null).result.path;
    }
  }

  return { profile: p, vehicle, blocked, options, routes, free, totalPlaces: graph.nodes.size };
}

const LABELS = { RefrigeratedVan: 'refrigerated van', Van: 'van', Truck: 'truck', Bike: 'bike' };
const label = (frame) => LABELS[frame] || frame;

export const fmtMin = (m) => (m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`);
export const fmtKm = (k) => `${k.toFixed(1)} km`;
export const fmtRs = (r) => `₹${Math.round(r)}`;

/** Plain-language reasons for choosing the route for a criterion. */
export function explainRoute(graph, found, criterion) {
  const o = found.options[criterion];
  const m = o.metrics;
  const lines = [];
  const others = Object.values(found.options).filter((x) => x.path.join() !== o.path.join());
  const crit = CRITERIA[criterion];

  // 1. What it is best at.
  if (criterion === 'balanced') {
    const f = found.options.fastest.metrics;
    const s = found.options.shortest.metrics;
    const c = found.options.cheapest.metrics;
    lines.push(`A mix of time, distance and cost: ${pct(m.time, f.time)} slower than the fastest, ${pct(m.distance, s.distance)} longer than the shortest, ${pct(m.cost, c.cost)} costlier than the cheapest.`);
  } else if (!others.length) {
    lines.push('Fastest, shortest and cheapest at the same time.');
  } else {
    lines.push({ time: 'Quickest route.', distance: 'Shortest route.', cost: 'Cheapest to run.', fare: 'Lowest fare for the customer.' }[crit.metric]);
  }

  // 2. Trade-off against the other options.
  if (criterion !== 'balanced') {
    const cmp = { fastest: 'shortest', shortest: 'fastest', cheapest: 'fastest', fare: 'cheapest' }[criterion];
    const alt = found.options[cmp];
    if (alt && alt.path.join() !== o.path.join()) {
      const a = alt.metrics;
      const parts = [];
      if (Math.abs(a.time - m.time) >= 0.5) parts.push(`${fmtMin(Math.abs(a.time - m.time))} ${a.time < m.time ? 'faster' : 'slower'}`);
      if (Math.abs(a.distance - m.distance) >= 0.05) parts.push(`${fmtKm(Math.abs(a.distance - m.distance))} ${a.distance < m.distance ? 'shorter' : 'longer'}`);
      if (Math.abs(a.cost - m.cost) >= 1) parts.push(`${fmtRs(Math.abs(a.cost - m.cost))} ${a.cost < m.cost ? 'cheaper to run' : 'more expensive to run'}`);
      if (parts.length) lines.push(`The ${CRITERIA[cmp].label.toLowerCase()} route is ${parts.join(', ')}.`);
    }
  }

  // 3. Road mix.
  const byType = {};
  for (const e of graph.pathEdges(o.path)) byType[e.type] = (byType[e.type] || 0) + e.distance;
  const total = m.distance || 1;
  const mix = Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, d]) => `${Math.round((d / total) * 100)}% ${t === 'main' ? 'main roads' : t === 'arterial' ? 'city roads' : 'local roads'}`);
  if (mix.length) lines.push(`Roads: ${mix.join(', ')}. Average speed ${Math.round((m.distance / m.time) * 60)} km/h at peak time.`);

  // 4. Cost structure for this vehicle (why cheapest differs from fastest/shortest).
  if (criterion === 'cheapest') {
    const fuel = m.cost - m.time * DRIVER_RATE;
    lines.push(`Running cost: fuel ${fmtRs(fuel)} + driver ${fmtRs(m.time * DRIVER_RATE)}.`);
  }
  if (criterion === 'fare') {
    const p = found.profile;
    lines.push(`Fare: ₹${p.baseFare} + ₹${p.farePerKm} per km + ₹${p.farePerMin} per min.`);
  }

  // 5. Access rules from the knowledge base.
  const freePath = found.free[criterion];
  if (freePath && freePath.join() !== o.path.join()) {
    const avoided = freePath.filter((id) => found.blocked.has(id)).map((id) => graph.node(id).name);
    if (avoided.length) {
      lines.push(`Goes around ${avoided.join(' and ')}: ${label(found.vehicle)}s are not allowed in the narrow lanes there.`);
    }
  }

  // 6. How it was found.
  lines.push(`A* search checked ${o.expanded} of ${found.totalPlaces} places (uniform cost search would check ${o.uninformedExpanded}).`);
  return lines;
}

/** Share of route a's points that lie within ~60 m of route b. */
function overlap(a, b) {
  const kx = 111.32 * Math.cos((28.47 * Math.PI) / 180);
  const ky = 110.57;
  const near = (p) => {
    for (let i = 1; i < b.length; i++) {
      const ax = b[i - 1][1] * kx, ay = b[i - 1][0] * ky, bx = b[i][1] * kx, by = b[i][0] * ky;
      const px = p[1] * kx, py = p[0] * ky;
      const dx = bx - ax, dy = by - ay;
      const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
      if (Math.hypot(px - ax - t * dx, py - ay - t * dy) < 0.06) return true;
    }
    return false;
  };
  return a.filter(near).length / a.length;
}

function pct(a, b) {
  if (b <= 0) return '0%';
  return `${Math.max(0, Math.round(((a - b) / b) * 100))}%`;
}

/** Explanation for a route that is not the best for the chosen goal. */
export function explainAlternative(graph, found, route, criterion) {
  const best = found.options[criterion];
  const a = route.metrics;
  const b = best.metrics;
  const diff = (x, y, unit, more, less) => (Math.abs(x - y) < unit ? null : `${unit === 1 ? fmtRs(Math.abs(x - y)) : unit === 0.5 ? fmtMin(Math.abs(x - y)) : fmtKm(Math.abs(x - y))} ${x > y ? more : less}`);
  const parts = [diff(a.time, b.time, 0.5, 'slower', 'faster'), diff(a.distance, b.distance, 0.05, 'longer', 'shorter'), diff(a.cost, b.cost, 1, 'more to run', 'cheaper to run')].filter(Boolean);
  const lines = [];
  if (route.best.length) {
    lines.push(`This is the ${route.best.map((k) => CRITERIA[k].label.toLowerCase()).join(' and ')} route.`);
  } else {
    lines.push('Another way to go.');
  }
  if (parts.length) lines.push(`Compared with the ${CRITERIA[criterion].label.toLowerCase()} route it is ${parts.join(', ')}.`);
  const viaA = new Set(route.path.slice(1, -1));
  const different = best.path.slice(1, -1).filter((id) => !viaA.has(id)).map((id) => graph.node(id).name);
  const own = route.path.slice(1, -1).filter((id) => !best.path.includes(id)).map((id) => graph.node(id).name);
  if (own.length) lines.push(`It goes through ${own.join(', ')}${different.length ? ` instead of ${different.join(', ')}` : ''}.`);
  return lines;
}

/** Up to three place names the route passes through. */
export function viaText(graph, path) {
  const mid = path.slice(1, -1).map((id) => graph.node(id).name.split(',')[0]);
  if (!mid.length) return 'direct road';
  if (mid.length <= 3) return `via ${mid.join(', ')}`;
  return `via ${mid[0]}, ${mid[Math.floor(mid.length / 2)]}, ${mid.at(-1)}`;
}

/** Turn-by-turn style directions. */
export function directions(graph, path, profile) {
  return graph.pathEdges(path).map((e) => {
    const m = edgeMetrics(e, profile);
    return { to: graph.node(e.to).name, distance: m.distance, time: m.time, road: e.type };
  });
}
