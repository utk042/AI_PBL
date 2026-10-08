import { h, card, table, select, field, fmt, pill } from './dom.js';
import { drawMap, legend } from './map.js';
import { ALGORITHMS } from '../core/search.js';

export function renderSearch(root, { world }) {
  const { graph } = world;
  const nodes = [...graph.nodes.values()];
  const state = { start: 'N0', goal: 'N19', weight: 'distance', selected: 'astar' };
  const mapBox = h('div');
  const out = h('div');

  const run = () => {
    const results = Object.entries(ALGORITHMS).map(([key, a]) => {
      const res = a.run(graph.routeProblem(state.start, state.goal, { weight: state.weight }), { goal: state.goal });
      return { key, ...res, metrics: graph.pathMetrics(res.path) };
    });
    const optimal = Math.min(...results.map((r) => r.metrics[state.weight]));

    const showMap = () => {
      const sel = results.find((r) => r.key === state.selected);
      // Explored region approximation: nodes on any path generated - re-run with a tracking problem.
      const explored = new Set();
      const base = graph.routeProblem(state.start, state.goal, { weight: state.weight });
      const tracking = { ...base, successors: (s) => { explored.add(s); return base.successors(s); } };
      ALGORITHMS[state.selected].run(tracking, { goal: state.goal });
      mapBox.replaceChildren(
        drawMap(graph, { routes: [{ path: sel.path, color: '#d9480f' }], highlight: { start: state.start, goal: state.goal }, explored: [...explored], labels: 'all' }),
        legend([[`${sel.algorithm} path`, '#d9480f'], ['expanded junctions', 'var(--warn)']]),
      );
    };

    out.replaceChildren(
      table(
        ['Algorithm', 'Path', `Cost (${state.weight === 'distance' ? 'km' : 'min'})`, 'Expanded', 'Generated', 'Time (ms)', 'Optimal?'],
        results.map((r) => [
          r.algorithm,
          h('span', { class: 'mono', style: 'white-space:nowrap' }, r.path.join('→')),
          fmt(r.metrics[state.weight]),
          r.expanded,
          r.generated,
          fmt(r.timeMs, 2),
          Math.abs(r.metrics[state.weight] - optimal) < 1e-6 ? pill('yes', 'ok') : pill('no', 'warn'),
        ]),
        {
          numeric: [2, 3, 4, 5],
          onRowClick: (i, tr) => {
            state.selected = results[i].key;
            tr.parentElement.querySelectorAll('tr').forEach((x) => x.classList.remove('sel'));
            tr.classList.add('sel');
            showMap();
          },
        },
      ),
      h('p', { class: 'muted' }, 'Click a row to draw that algorithm\'s path and the junctions it expanded. A* expands fewer junctions than Uniform Cost and still returns the optimal route because h(n) = straight-line distance never overestimates the road distance.'),
    );
    showMap();
  };

  const nodeOptions = nodes.map((n) => [n.id, `${n.id} · ${n.name}`]);
  root.append(
    h('div', { class: 'grid two' },
      card('Search Lab', 'Compare uninformed and informed search on the road network (Module 1).',
        h('div', { class: 'controls' },
          field('Start', select(nodeOptions, state.start, (v) => { state.start = v; run(); })),
          field('Goal', select(nodeOptions, state.goal, (v) => { state.goal = v; run(); })),
          field('Optimise', select([['distance', 'Distance (km)'], ['time', 'Travel time (min)']], state.weight, (v) => { state.weight = v; run(); })),
        ),
        mapBox,
      ),
      card('Results', 'f(n) = g(n) + h(n) for A*, f(n) = h(n) for Greedy, f(n) = g(n) for Uniform Cost.', out),
    ),
  );
  run();
}
