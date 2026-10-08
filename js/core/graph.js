// Weighted road-network graph stored as an adjacency list (Module 1 representation).

import { ROAD_TYPES } from '../data/network.js';

const MAX_SPEED = Math.max(...Object.values(ROAD_TYPES).map((r) => r.speed));

export class RoadGraph {
  constructor(nodes, edges) {
    this.nodes = new Map(nodes.map((n) => [n.id, n]));
    this.edges = edges;
    this.adj = new Map(nodes.map((n) => [n.id, []]));
    for (const e of edges) {
      this.adj.get(e.from).push({ to: e.to, distance: e.distance, time: e.time, type: e.type });
      this.adj.get(e.to).push({ to: e.from, distance: e.distance, time: e.time, type: e.type });
    }
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

  /** Straight-line (Euclidean) distance in km: never exceeds road distance. */
  straightLine(a, b) {
    const p = this.nodes.get(a);
    const q = this.nodes.get(b);
    return Math.hypot(p.x - q.x, p.y - q.y);
  }

  /**
   * Builds a search problem between two junctions.
   * weight = 'distance' (km) or 'time' (minutes).
   * For time, h = straight-line / max speed, which is still admissible.
   */
  routeProblem(start, goal, { weight = 'distance' } = {}) {
    const g = this;
    return {
      initial: start,
      goal,
      isGoal: (s) => s === goal,
      key: (s) => s,
      successors: (s) =>
        g.neighbors(s).map((e) => ({ state: e.to, action: `${s}->${e.to}`, cost: e[weight] })),
      heuristic: (s) =>
        weight === 'distance' ? g.straightLine(s, goal) : (g.straightLine(s, goal) / MAX_SPEED) * 60,
    };
  }

  /** Total distance and time of a path of node ids. */
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

  /** Verifies that h(n) <= true cost for every node pair (admissibility check). */
  checkAdmissible(costTable) {
    const violations = [];
    for (const [a, row] of costTable) {
      for (const [b, cost] of row) {
        if (this.straightLine(a, b) > cost + 1e-9) violations.push([a, b]);
      }
    }
    return violations;
  }
}
