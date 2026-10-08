// Weighted road-network graph stored as an adjacency list (Module 1 representation).

export class RoadGraph {
  constructor(nodes, edges) {
    this.nodes = new Map(nodes.map((n) => [n.id, n]));
    this.edges = edges;
    this.adj = new Map(nodes.map((n) => [n.id, []]));
    for (const e of edges) {
      this.adj.get(e.from).push({ ...e, to: e.to, reversed: false });
      this.adj.get(e.to).push({ ...e, from: e.to, to: e.from, reversed: true });
    }
    // Fastest speed on any road (km per minute) - used for admissible time heuristics.
    this.maxKmPerMin = Math.max(...edges.map((e) => e.distance / e.time));
  }

  node(id) {
    return this.nodes.get(id);
  }

  neighbors(id) {
    return this.adj.get(id) || [];
  }

  edgeBetween(a, b) {
    return this.neighbors(a).find((e) => e.to === b);
  }

  /** Straight-line distance in km: a road between two points is never shorter. */
  straightLine(a, b) {
    const p = this.nodes.get(a);
    const q = this.nodes.get(b);
    return Math.hypot(p.x - q.x, p.y - q.y);
  }

  /**
   * Builds a search problem between two places.
   *   weight:    'distance' (km), 'time' (min), or a function edge -> cost
   *   heuristic: optional function km -> lower bound on cost for that straight-line distance
   *   blocked:   set of place ids the vehicle may not pass through
   */
  routeProblem(start, goal, { weight = 'distance', heuristic, blocked } = {}) {
    const g = this;
    const w = typeof weight === 'function' ? weight : (e) => e[weight];
    const h = heuristic || (weight === 'time' ? (km) => km / g.maxKmPerMin : weight === 'distance' ? (km) => km : () => 0);
    return {
      initial: start,
      goal,
      isGoal: (s) => s === goal,
      key: (s) => s,
      successors: (s) =>
        g.neighbors(s)
          .filter((e) => !blocked || !blocked.has(e.to) || e.to === goal)
          .map((e) => ({ state: e.to, action: `${s}->${e.to}`, cost: w(e) })),
      heuristic: (s) => h(g.straightLine(s, goal)),
    };
  }

  /** Total distance and time of a path of place ids. */
  pathMetrics(path) {
    let distance = 0;
    let time = 0;
    for (let i = 1; i < path.length; i++) {
      const e = this.edgeBetween(path[i - 1], path[i]);
      distance += e.distance;
      time += e.time;
    }
    return { distance, time };
  }

  /** Road edges along a path, in travel direction. */
  pathEdges(path) {
    const out = [];
    for (let i = 1; i < path.length; i++) out.push(this.edgeBetween(path[i - 1], path[i]));
    return out;
  }

  /** [lat, lng] points along a path, following the real road shapes. */
  pathGeometry(path) {
    if (path.length === 1) {
      const n = this.node(path[0]);
      return [[n.lat, n.lng]];
    }
    const pts = [];
    for (const e of this.pathEdges(path)) {
      const seg = e.reversed ? [...e.geometry].reverse() : e.geometry;
      pts.push(...(pts.length ? seg.slice(1) : seg));
    }
    return pts;
  }
}
