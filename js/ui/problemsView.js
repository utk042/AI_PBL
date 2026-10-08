import { h, card, table, select, field, fmt, pill, subtabs, stat } from './dom.js';
import { createMap, COLORS } from './mapView.js';
import { bfs, dfs, iddfs, astar } from '../core/search.js';
import { waterJugProblem } from '../problems/waterJug.js';
import { missionariesProblem } from '../problems/missionaries.js';
import { puzzleProblem, scramble, isSolvable, GOAL } from '../problems/puzzle8.js';
import { solveNQueens } from '../problems/nQueens.js';
import { bruteForce, heldKarp, nearestNeighbour, twoOpt } from '../core/tsp.js';
import { buildMatrix } from '../planner.js';
import { DEPOT } from '../data/network.js';

const num = (value, min, max, oninput) => h('input', { type: 'number', value, min, max, style: 'width:80px', oninput });

function waterJug() {
  const st = { a: 4, b: 3, t: 2 };
  const out = h('div');
  const run = () => {
    const p = waterJugProblem(st.a, st.b, st.t);
    const r1 = bfs(p);
    const r2 = dfs(p);
    const steps = (r) => (r.found ? h('ol', { class: 'steps' }, r.actions.map((a, i) => h('li', {}, `${a} → (${r.path[i + 1].join(', ')})`))) : h('p', { class: 'err' }, 'No solution - the target must be a multiple of gcd(A, B) and not larger than the bigger jug.'));
    out.replaceChildren(
      h('div', { class: 'grid halves' },
        h('div', {}, h('h3', {}, `BFS: ${r1.found ? r1.actions.length + ' steps' : 'no solution'}`), h('p', { class: 'muted' }, `${r1.expanded} states expanded - optimal number of moves.`), steps(r1)),
        h('div', {}, h('h3', {}, `DFS: ${r2.found ? r2.actions.length + ' steps' : 'no solution'}`), h('p', { class: 'muted' }, `${r2.expanded} states expanded - finds a solution, not necessarily the shortest.`), steps(r2)),
      ),
    );
  };
  run();
  return card('Water-Jug problem', 'Measure an exact amount of water with two jugs. The state is how much is in each jug; the moves are fill, empty and pour. Splitting a load between two vehicles is the same kind of problem.',
    h('div', { class: 'controls' },
      field('Jug A capacity', num(st.a, 1, 20, (e) => { st.a = +e.target.value || 1; run(); })),
      field('Jug B capacity', num(st.b, 1, 20, (e) => { st.b = +e.target.value || 1; run(); })),
      field('Target litres in jug A', num(st.t, 0, 20, (e) => { st.t = +e.target.value || 0; run(); })),
    ), out);
}

function missionaries() {
  const st = { n: 3, boat: 2 };
  const out = h('div');
  const run = () => {
    const p = missionariesProblem(st.n, st.boat);
    const rb = bfs(p);
    const ri = iddfs(p);
    out.replaceChildren(
      h('div', { class: 'stats' }, stat(rb.found ? rb.actions.length : '-', 'crossings (BFS, optimal)'), stat(rb.expanded, 'BFS states expanded'), stat(ri.expanded, 'IDDFS states expanded')),
      rb.found
        ? table(['#', 'Move', 'Left bank (M, C)', 'Right bank (M, C)', 'Boat'], rb.actions.map((a, i) => {
          const [m, c, b] = rb.path[i + 1];
          return [i + 1, a, `${m}, ${c}`, `${st.n - m}, ${st.n - c}`, b ? 'left' : 'right'];
        }))
        : h('p', { class: 'err' }, 'No safe sequence exists for these values.'),
    );
  };
  run();
  return card('Missionaries and Cannibals', 'Get everyone across the river without missionaries ever being outnumbered. Unsafe states are thrown away straight away, the same way the planner drops overloaded vehicles early.',
    h('div', { class: 'controls' },
      field('Missionaries = Cannibals', num(st.n, 1, 6, (e) => { st.n = +e.target.value || 3; run(); })),
      field('Boat capacity', num(st.boat, 1, 4, (e) => { st.boat = +e.target.value || 2; run(); })),
    ), out);
}

function puzzle() {
  const st = { start: scramble(24, 11), step: 0 };
  const out = h('div');
  const boardBox = h('div');
  const tiles = (s) => h('div', { class: 'tiles' }, s.split('').map((c) => h('div', { class: c === '0' ? 'blank' : '' }, c === '0' ? '' : c)));
  let best = null;

  const run = () => {
    if (!isSolvable(st.start)) {
      out.replaceChildren(h('p', { class: 'err' }, 'This arrangement is unsolvable (odd number of inversions).'));
      boardBox.replaceChildren(tiles(st.start));
      return;
    }
    const rows = [
      ['BFS (uninformed)', bfs(puzzleProblem(st.start))],
      ['A* - misplaced tiles h₁', astar(puzzleProblem(st.start, 'misplaced'))],
      ['A* - Manhattan distance h₂', astar(puzzleProblem(st.start, 'manhattan'))],
    ];
    best = rows[2][1];
    st.step = 0;
    out.replaceChildren(
      table(['Algorithm', 'Moves', 'Expanded', 'Generated', 'Time (ms)'], rows.map(([n, r]) => [n, r.actions.length, r.expanded, r.generated, fmt(r.timeMs, 1)]), { numeric: [1, 2, 3, 4] }),
      h('p', { class: 'muted' }, 'All three find the shortest solution. Manhattan distance is the better guess, so A* checks far fewer states with it.'),
    );
    showStep();
  };

  const showStep = () => {
    boardBox.replaceChildren(
      tiles(best.path[st.step]),
      h('p', {}, `Step ${st.step} / ${best.actions.length}${st.step ? ` - ${best.actions[st.step - 1]}` : ''}`),
      h('div', { class: 'controls' },
        h('button', { class: 'btn ghost', onclick: () => { st.step = Math.max(0, st.step - 1); showStep(); } }, '◀ Prev'),
        h('button', { class: 'btn ghost', onclick: () => { st.step = Math.min(best.actions.length, st.step + 1); showStep(); } }, 'Next ▶'),
        h('button', { class: 'btn ghost', onclick: () => {
          const timer = setInterval(() => {
            if (st.step >= best.actions.length) return clearInterval(timer);
            st.step++;
            showStep();
          }, 350);
        } }, 'Play'),
      ),
    );
  };

  run();
  return card('8-puzzle (tiles problem)', 'Slide the tiles back into order. We used this to test A* before using it on roads: the better the guess (heuristic), the fewer states A* has to check.',
    h('div', { class: 'controls' },
      h('button', { class: 'btn', onclick: () => { st.start = scramble(10 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 1e6)); run(); } }, 'New scramble'),
    ),
    h('div', { class: 'grid halves' }, boardBox, out));
}

function queens() {
  const st = { n: 8 };
  const out = h('div');
  const run = () => {
    const withFC = solveNQueens(st.n, { forwardChecking: true, mrv: true });
    const plain = solveNQueens(st.n, { forwardChecking: false, mrv: false });
    const size = Math.max(22, Math.min(44, Math.floor(360 / st.n)));
    const board = withFC.board
      ? h('div', { class: 'board', style: `grid-template-columns: repeat(${st.n}, ${size}px)` },
        Array.from({ length: st.n * st.n }, (_, i) => {
          const r = Math.floor(i / st.n);
          const c = i % st.n;
          return h('div', { class: (r + c) % 2 ? 'dark' : 'light', style: `height:${size}px; font-size:${size * 0.6}px` }, withFC.board[c] === r ? '♛' : '');
        }))
      : h('p', { class: 'err' }, 'No solution (N = 2 or 3).');
    out.replaceChildren(
      h('div', { class: 'grid halves' },
        board,
        table(['Solver', 'Assignments', 'Backtracks', 'Time (ms)'], [
          ['Backtracking + MRV + forward checking', withFC.assignments, withFC.backtracks, fmt(withFC.timeMs, 2)],
          ['Plain backtracking', plain.assignments, plain.backtracks, fmt(plain.timeMs, 2)],
        ], { numeric: [1, 2, 3] }),
      ),
    );
  };
  run();
  return card('N-Queens as a CSP', 'Place N queens so that none can attack another. It is solved by the same constraint solver that assigns orders to vehicles.',
    h('div', { class: 'controls' }, field('N', num(st.n, 1, 30, (e) => { st.n = Math.min(30, Math.max(1, +e.target.value || 8)); run(); }))), out);
}

function tsp(world) {
  const out = h('div');
  const mapBox = h('div', { class: 'map map-small' });
  let tspMap = null;
  const st = { count: 8 };
  const run = () => {
    const nodes = [DEPOT, ...new Set(world.deliveries.map((d) => d.node))].slice(0, st.count + 1);
    const m = buildMatrix(world.graph, nodes, 'astar');
    const solvers = [
      ...(nodes.length <= 10 ? [bruteForce(m.dist)] : []),
      heldKarp(m.dist),
      nearestNeighbour(m.dist),
      twoOpt(m.dist),
    ];
    const opt = Math.min(...solvers.map((x) => x.length));
    const expand = (tour) => tour.slice(1).reduce((acc, j, k) => [...acc, ...m.paths[tour[k]][j].slice(1)], [nodes[tour[0]]]);
    const shown = [solvers.find((x) => x.name.startsWith('Held')), solvers.find((x) => x.name === 'Nearest neighbour')];
    requestAnimationFrame(() => {
      tspMap ||= createMap(mapBox, world.graph);
      tspMap.setRoutes([
        { coords: world.graph.pathGeometry(expand(shown[1].tour)), color: COLORS[1], weight: 5, dashed: true },
        { coords: world.graph.pathGeometry(expand(shown[0].tour)), color: COLORS[0], weight: 5 },
      ]);
      tspMap.setPins([{ id: DEPOT, kind: 'depot', text: 'D' }, ...shown[0].tour.slice(1, -1).map((i, k) => ({ id: nodes[i], kind: 'stop', text: k + 1, color: COLORS[0] }))]);
      tspMap.fit([world.graph.pathGeometry(expand(shown[0].tour))]);
    });
    out.replaceChildren(
      table(['Solver', 'Tour length (km)', 'Gap to optimum', 'Evaluations', 'Time (ms)'], solvers.map((x) => [x.name, fmt(x.length), x.length - opt < 1e-6 ? pill('optimal', 'ok') : pill(`+${fmt(((x.length - opt) / opt) * 100)}%`, 'warn'), x.evaluated, fmt(x.timeMs, 2)]), { numeric: [1, 3, 4] }),
      h('p', { class: 'muted' }, `Best order: ${solvers.find((x) => x.name.startsWith('Held')).tour.map((i) => world.graph.node(nodes[i]).name.split(',')[0]).join(' → ')}`),
      h('p', { class: 'muted' }, 'Road distances between stops come from A*. Exact methods get slow very quickly as stops are added (n! for brute force), so for many stops the planner uses nearest neighbour + 2-opt.'),
    );
  };
  run();
  return card('Travelling Salesperson Problem', 'Visit every delivery point once and come back to the depot, driving as little as possible. The planner uses this to order each vehicle\'s stops.',
    h('div', { class: 'controls' }, field('Delivery points', select([4, 6, 8, 10, 12].map((n) => [String(n), `${n} points`]), String(st.count), (v) => { st.count = +v; run(); }))),
    h('div', { class: 'grid halves' }, h('div', {}, mapBox, h('p', { class: 'muted small' }, 'Blue: best tour (Held-Karp). Orange dashed: nearest neighbour.')), out));
}

export function renderProblems(root, { world }) {
  const make = { jug: waterJug, mc: missionaries, puzzle, queens, tsp: () => tsp(world) };
  const panes = {};
  const holder = h('div');
  const show = (id) => { panes[id] ||= make[id](); holder.replaceChildren(panes[id]); };
  root.append(
    subtabs([['jug', 'Water-Jug'], ['queens', 'N-Queens'], ['tsp', 'Travelling Salesperson'], ['mc', 'Missionaries & Cannibals'], ['puzzle', 'Tiles (8-puzzle)']], show),
    holder,
  );
  show('jug');
}
