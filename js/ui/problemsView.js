import { h, card, table, select, field, fmt, pill, subtabs, stat } from './dom.js';
import { drawMap, legend } from './map.js';
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
  return card('Water-Jug problem', 'State (a, b) = litres in jug A and jug B. Operators: fill, empty, pour. Project link: splitting a load between two vehicles of fixed capacity uses the same state-space formulation.',
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
  return card('Missionaries and Cannibals', 'State (M, C, boat) on the left bank. Unsafe states (missionaries outnumbered) are rejected before they enter the frontier - the same early-rejection idea the CSP uses for capacity violations.',
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
      h('p', { class: 'muted' }, 'All three return the same optimal number of moves; the better-informed admissible heuristic (Manhattan ≥ misplaced) expands far fewer states. This validated our A* before using it on the road network.'),
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
  return card('8-puzzle (tiles problem)', `Goal ${GOAL.replace('0', '_')}. Heuristics h₁ (misplaced tiles) and h₂ (Manhattan distance) are both admissible.`,
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
  return card('N-Queens as a CSP', 'Variables: columns. Domain: rows. Constraints: no two queens share a row or diagonal. Solved by the same CSP engine that assigns deliveries to vehicles.',
    h('div', { class: 'controls' }, field('N', num(st.n, 1, 30, (e) => { st.n = Math.min(30, Math.max(1, +e.target.value || 8)); run(); }))), out);
}

function tsp(world) {
  const out = h('div');
  const mapBox = h('div');
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
    const colors = ['#2357d9', '#1b8a5a', '#d9480f'];
    const drawn = solvers.slice(-3);
    mapBox.replaceChildren(
      drawMap(world.graph, { deliveries: world.deliveries.filter((d) => nodes.includes(d.node)), routes: drawn.map((x, i) => ({ path: expand(x.tour), color: colors[i], dashed: i > 0 })) }),
      legend(drawn.map((x, i) => [x.name, colors[i]])),
    );
    out.replaceChildren(
      table(['Solver', 'Tour length (km)', 'Gap to optimum', 'Evaluations', 'Time (ms)'], solvers.map((x) => [x.name, fmt(x.length), x.length - opt < 1e-6 ? pill('optimal', 'ok') : pill(`+${fmt(((x.length - opt) / opt) * 100)}%`, 'warn'), x.evaluated, fmt(x.timeMs, 2)]), { numeric: [1, 3, 4] }),
      h('p', { class: 'muted mono' }, `Optimal order: ${solvers.find((x) => x.length - opt < 1e-6).tour.map((i) => nodes[i]).join(' → ')}`),
      h('p', { class: 'muted' }, 'Distances between stops come from A* on the road network. Exact methods grow as n! (brute force) or n²·2ⁿ (Held-Karp), so the planner uses exact search for small per-vehicle stop sets and nearest neighbour + 2-opt for larger ones.'),
    );
  };
  run();
  return card('Travelling Salesperson Problem', 'Visit every delivery point once and return to the depot with minimum road distance.',
    h('div', { class: 'controls' }, field('Delivery points', select([4, 6, 8, 10, 12].map((n) => [String(n), `${n} points`]), String(st.count), (v) => { st.count = +v; run(); }))),
    h('div', { class: 'grid halves' }, mapBox, out));
}

export function renderProblems(root, { world }) {
  const panes = { jug: waterJug(), mc: missionaries(), puzzle: puzzle(), queens: queens(), tsp: tsp(world) };
  const holder = h('div', {}, panes.jug);
  root.append(
    card('Classic problems (Module 2)', 'Each problem runs on the same search / CSP engine as the route planner, which is how the engine was tested before it was applied to the road network.'),
    subtabs([['jug', 'Water-Jug'], ['queens', 'N-Queens'], ['tsp', 'Travelling Salesperson'], ['mc', 'Missionaries & Cannibals'], ['puzzle', 'Tiles (8-puzzle)']], (id) => holder.replaceChildren(panes[id])),
    holder,
  );
}
