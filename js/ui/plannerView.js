import { h, card, stat, table, pill, select, field, fmt } from './dom.js';
import { drawMap, legend, VEHICLE_COLORS } from './map.js';
import { planRoutes, planBaseline, formatClock } from '../planner.js';

export function renderPlanner(root, { world }) {
  const state = { algorithm: 'astar', baseline: 'bfs', show: 'plan' };
  const mapBox = h('div');
  const out = h('div');

  const run = () => {
    const plan = planRoutes(world, { algorithm: state.algorithm });
    const base = planBaseline(world, { algorithm: state.baseline });
    const shown = state.show === 'plan' ? plan : base;

    mapBox.replaceChildren(
      drawMap(world.graph, {
        deliveries: world.deliveries,
        routes: shown.routes.map((r, i) => ({ path: r.roadPath, color: VEHICLE_COLORS[i], dashed: state.show !== 'plan' })),
      }),
      legend(shown.routes.map((r, i) => [`${r.vehicle.label} (${r.stops.length} stops)`, VEHICLE_COLORS[i]])),
    );

    const p = plan.summary;
    const b = base.summary;
    const better = (x, y) => (x < y ? pill(`-${fmt(((y - x) / y) * 100, 0)}%`, 'ok') : '');
    out.replaceChildren(
      card(plan.method, 'Expert system + FOL decide which vehicles may take each delivery; the CSP assigns them; A* distances feed the TSP sequencing.',
        h('div', { class: 'stats' },
          stat(`${p.served}/${p.total}`, 'deliveries served'),
          stat(`${fmt(p.distance)} km`, 'total fleet distance'),
          stat(formatClock(p.makespan), 'last vehicle back'),
          stat(`${fmt(p.fuel)} L`, 'estimated fuel'),
          stat(p.windowViolations + p.capacityViolations + p.ruleViolations, 'constraint violations'),
          stat(p.nodesExpanded, `nodes expanded (${p.searches} searches)`),
        ),
        h('h3', {}, 'Comparison with the uninformed baseline'),
        table(
          ['Metric', plan.method, base.method, 'Improvement'],
          [
            ['Total route distance (km)', fmt(p.distance), fmt(b.distance), better(p.distance, b.distance)],
            ['Estimated fuel (L)', fmt(p.fuel), fmt(b.fuel), better(p.fuel, b.fuel)],
            ['Nodes expanded (all route searches)', p.nodesExpanded, b.nodesExpanded, better(p.nodesExpanded, b.nodesExpanded)],
            ['Time-window violations', p.windowViolations, b.windowViolations, ''],
            ['Capacity violations', p.capacityViolations, b.capacityViolations, ''],
            ['Handling-rule violations (e.g. perishables in non-reefer)', p.ruleViolations, b.ruleViolations, ''],
            ['CSP assignments / backtracks', `${plan.csp.assignments} / ${plan.csp.backtracks}`, 'n/a', ''],
            ['Run time (ms, this browser)', fmt(p.timeMs), fmt(b.timeMs), ''],
          ],
          { numeric: [1, 2] },
        ),
      ),
      card('Vehicle schedules', `Showing: ${shown.method}. Times assume a 09:00 departure and 10 min service per stop.`,
        ...shown.routes.map((r, i) =>
          h('div', {},
            h('h3', { style: `color:${VEHICLE_COLORS[i]}` }, `${r.vehicle.label} - load ${r.load}/${r.capacity} kg, ${fmt(r.distance)} km, back ${formatClock(r.finish)} `, r.feasible ? pill('feasible', 'ok') : pill('violations', 'bad')),
            table(
              ['Stop', 'Location', 'Item', 'Arrive', 'Window', 'Status'],
              r.arrivals.map((a) => {
                const d = world.deliveries.find((x) => x.id === a.id);
                return [a.id, world.graph.node(d.node).name, `${d.item} · ${d.demand} kg`, formatClock(a.arrive), `${formatClock(d.window[0])}-${formatClock(d.window[1])}`, a.late > 0 ? pill(`late ${fmt(a.late, 0)} min`, 'bad') : pill('on time', 'ok')];
              }),
            ),
          ),
        ),
      ),
      card('Why each delivery got its vehicle options', 'Output of the expert system (Module 3) and the FOL feasibility rules.',
        table(
          ['Delivery', 'Facts', 'Allowed classes', 'Forbidden', 'Feasible vehicles (FOL)', 'Assigned'],
          world.deliveries.map((d) => {
            const a = plan.advice[d.id];
            const assigned = plan.csp.solution?.[d.id];
            return [d.id, `${d.item}, ${d.demand} kg, ${world.graph.node(d.node).zone}, ${d.priority}`, a.allowed.join(', '), a.forbidden.join(', ') || '-', plan.domains[d.id].join(', '), assigned ? pill(assigned) : pill('none', 'bad')];
          }),
        ),
      ),
    );
  };

  root.append(
    h('div', { class: 'grid two' },
      card('Route Planner', 'Multi-vehicle routing for 12 deliveries and 4 vehicles from the central depot.',
        h('div', { class: 'controls' },
          field('Route search', select([['astar', 'A* (admissible heuristic)'], ['greedy', 'Greedy Best-First'], ['ucs', 'Uniform Cost (Dijkstra)']], state.algorithm, (v) => { state.algorithm = v; run(); })),
          field('Baseline', select([['bfs', 'BFS baseline'], ['dfs', 'DFS baseline']], state.baseline, (v) => { state.baseline = v; run(); })),
          field('Show on map', select([['plan', 'Optimised plan'], ['baseline', 'Baseline plan']], state.show, (v) => { state.show = v; run(); })),
        ),
        mapBox,
      ),
      h('div', {}, out),
    ),
  );
  run();
}
