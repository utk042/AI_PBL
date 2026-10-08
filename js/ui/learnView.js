import { h, table, select, field, fmt, subtabs } from './dom.js';
import { createMap, COLORS } from './mapView.js';
import { ALGORITHMS } from '../core/search.js';
import { renderProblems } from './problemsView.js';
import { renderKB } from './kbView.js';
import { renderExpert } from './expertView.js';

const DONE = [
  ['Road network as a weighted graph (26 real places, 49 roads)', 'Module 1'],
  ['BFS, DFS, iterative deepening, bi-directional, uniform cost, greedy best-first and A*', 'Module 1'],
  ['Constraint satisfaction for vehicle capacity and delivery time windows', 'Module 1'],
  ['Water-Jug, N-Queens, TSP, Missionaries-Cannibals and 8-puzzle on the same search engine', 'Module 2'],
  ['Propositional and first-order logic rules for vehicle feasibility', 'Module 3'],
  ['Semantic network and frames for vehicles and deliveries', 'Module 3'],
  ['Expert system that decides which vehicle can carry each order', 'Module 3'],
  ['Route options (fastest, shortest, lowest cost, lowest fare, balanced) and alternatives', 'Integration'],
  ['Multi-vehicle delivery planning on a real map', 'Integration'],
];
const TODO = [
  ['Traffic uncertainty with a Bayesian network; certainty factors in the rules', 'Module 4'],
  ['Fuzzy urgency of orders; Dempster-Shafer evidence for road conditions', 'Module 4'],
  ['Larger road network and 50+ orders', 'Final'],
  ['Re-routing when a road is closed during the day', 'Final'],
  ['User testing, final report and demo', 'Final'],
];
const TEAM = [
  ['Utkarsh Raj Shukla', '2501330100398', 'Road graph, uninformed search, Water-Jug, Missionaries-Cannibals, integration'],
  ['Vivek Kumar', '2501330100414', 'A*, greedy search, heuristics, 8-puzzle, TSP'],
  ['Vishal Gupta', '2501330100411', 'CSP solver, N-Queens, propositional and first-order logic'],
  ['Yash Srivastava', '2501330100422', 'Multi-vehicle planning, semantic network, frames, benchmarks'],
  ['Nishant Kumar Mahto', '0261DCS009', 'Interface, map, expert-system screen'],
];

function status() {
  const pct = 50;
  return h('div', { class: 'doc' },
    h('h2', {}, 'Project status'),
    h('p', {}, 'Logistics Route Optimization System · AI PBL, Group 101 · CCSAI0301'),
    h('div', { class: 'progress-row' }, h('div', { class: 'progress' }, h('div', { style: `width:${pct}%` })), h('b', {}, `${pct}%`)),
    h('div', { class: 'cols' },
      h('div', {}, h('h3', {}, 'Done'), h('ul', { class: 'check' }, DONE.map(([t, m]) => h('li', { class: 'done' }, t, h('span', { class: 'mod' }, m))))),
      h('div', {}, h('h3', {}, 'Next'), h('ul', { class: 'check' }, TODO.map(([t, m]) => h('li', {}, t, h('span', { class: 'mod' }, m)))))),
    h('h3', {}, 'Team'),
    table(['Name', 'Roll no.', 'Worked on'], TEAM),
  );
}

function searchLab(world) {
  const { graph } = world;
  const places = [...graph.nodes.values()].sort((a, b) => a.name.localeCompare(b.name)).map((n) => [n.id, n.name]);
  const st = { start: 'N21', goal: 'N15', weight: 'distance', algo: 'astar' };
  const out = h('div');
  const mapEl = h('div', { class: 'map map-small' });
  const wrap = h('div', { class: 'doc' },
    h('h2', {}, 'Search algorithms'),
    h('p', {}, 'One trip, seven search algorithms. Click a row to see its route and the places it checked.'),
    h('div', { class: 'controls' },
      field('From', select(places, st.start, (v) => { st.start = v; run(); })),
      field('To', select(places, st.goal, (v) => { st.goal = v; run(); })),
      field('Minimise', select([['distance', 'Distance'], ['time', 'Time']], st.weight, (v) => { st.weight = v; run(); }))),
    h('div', { class: 'cols' }, mapEl, out));
  let map = null;

  function run() {
    if (!map) map = createMap(mapEl, graph);
    const rows = Object.entries(ALGORITHMS).map(([key, a]) => {
      const checked = [];
      const base = graph.routeProblem(st.start, st.goal, { weight: st.weight });
      const res = a.run({ ...base, successors: (s) => { checked.push(s); return base.successors(s); } }, { goal: st.goal });
      return { key, name: a.name, res, checked: [...new Set(checked)], m: graph.pathMetrics(res.path) };
    });
    const best = Math.min(...rows.map((r) => r.m[st.weight]));
    const show = () => {
      const r = rows.find((x) => x.key === st.algo);
      map.setRoutes([{ coords: graph.pathGeometry(r.res.path), color: COLORS[1], weight: 6 }]);
      map.setPins([
        ...r.checked.filter((id) => id !== st.start && id !== st.goal).map((id) => ({ id, kind: 'explored', title: `${graph.node(id).name} (checked)` })),
        { id: st.start, kind: 'start', text: 'A' }, { id: st.goal, kind: 'end', text: 'B' },
      ]);
      map.fit([graph.pathGeometry(r.res.path)]);
    };
    out.replaceChildren(
      table(['Algorithm', st.weight === 'distance' ? 'Km' : 'Min', 'Places checked', 'Best?'],
        rows.map((r) => [r.name, fmt(r.m[st.weight]), r.res.expanded, Math.abs(r.m[st.weight] - best) < 1e-6 ? 'Yes' : 'No']),
        { numeric: [1, 2], onRowClick: (i, tr) => { st.algo = rows[i].key; tr.parentElement.querySelectorAll('tr').forEach((x) => x.classList.remove('sel')); tr.classList.add('sel'); show(); } }),
      h('p', { class: 'muted small' }, 'A* and uniform cost always find the best route. A* checks fewer places because it uses the straight-line distance to the destination as a guide.'),
    );
    show();
  }
  requestAnimationFrame(run);
  return wrap;
}

export function renderLearn(root, ctx) {
  const panes = {
    status: () => status(),
    search: () => searchLab(ctx.world),
    problems: () => { const d = h('div'); renderProblems(d, ctx); return d; },
    kb: () => { const d = h('div'); renderKB(d, ctx); return d; },
    expert: () => { const d = h('div'); renderExpert(d, ctx); return d; },
  };
  const cache = {};
  const holder = h('div');
  const show = (id) => { cache[id] ||= panes[id](); holder.replaceChildren(cache[id]); };
  root.append(h('div', { class: 'page' },
    h('p', { class: 'intro' }, 'AI techniques used in this project.'),
    subtabs([['status', 'Status'], ['search', 'Search'], ['problems', 'Classic problems'], ['kb', 'Logic & knowledge'], ['expert', 'Expert system']], show),
    holder));
  show('status');
}
