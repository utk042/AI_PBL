import { h, card } from './dom.js';

const DONE = [
  ['Weighted road-network graph (adjacency list), 22 junctions, 37 roads', 'Module 1'],
  ['Uninformed search: BFS, DFS, Iterative Deepening, Bi-directional, Uniform Cost', 'Module 1'],
  ['Informed search: Greedy Best-First and A* with admissible straight-line heuristic', 'Module 1'],
  ['CSP solver (MRV + forward checking) for capacity and time-window constraints', 'Module 1'],
  ['Classic problems on the same search engine: Water-Jug, N-Queens, Missionaries-Cannibals, 8-puzzle', 'Module 2'],
  ['TSP stop sequencing: brute force, Held-Karp DP, nearest neighbour, 2-opt', 'Module 2'],
  ['Propositional logic: truth tables, entailment, forward/backward chaining', 'Module 3'],
  ['First-order logic: unification and forward chaining for Feasible(v, d)', 'Module 3'],
  ['Semantic network with is-a inheritance and frames with defaults/demons', 'Module 3'],
  ['Expert system dispatch advisor (KB, working memory, inference engine, explanation)', 'Module 3'],
  ['Multi-vehicle prototype with benchmark against BFS/DFS baseline', 'Integration'],
];

const TODO = [
  ['Statistical reasoning: Bayesian network for traffic delay, certainty factors in dispatch rules', 'Module 4'],
  ['Fuzzy-logic delivery urgency and Dempster-Shafer evidence for road conditions', 'Module 4'],
  ['Larger real-world dataset (OpenStreetMap extract) and scalability benchmarks', 'Final'],
  ['Dynamic re-routing when a road is blocked during the day', 'Final'],
  ['Decision on Minimax / Alpha-Beta for competing delivery agents', 'Final'],
  ['Final UI polish, user testing and final report', 'Final'],
];

export function renderOverview(root, ctx) {
  const progress = 50;
  root.append(
    h('div', { class: 'grid two' },
      card('Project at a glance', 'An AI system that plans delivery routes for a mixed fleet across a city road network, minimising distance and time while respecting vehicle capacity, delivery time windows and handling rules.',
        h('h3', {}, `Overall progress: ${progress}%`),
        h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': progress, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('div', { style: `width:${progress}%` })),
        h('p', { class: 'muted' }, 'Review 1 (30%): problem understanding and concept study. Review 2 (50%): working prototype with search, CSP, TSP and the Module 3 knowledge base. Final review: Module 4 statistical reasoning, real data and final integration.'),
        h('h3', {}, 'Planning pipeline'),
        h('div', { class: 'pipeline' },
          [
            ['1. Road graph', 'Weighted adjacency list', 'Module 1'],
            ['2. Frames + semantic net', 'Vehicle & delivery knowledge', 'Module 3'],
            ['3. Expert system', 'Permitted vehicle classes', 'Module 3'],
            ['4. FOL rules', 'Feasible(v, d) for all pairs', 'Module 3'],
            ['5. CSP', 'Capacity + time windows', 'Module 1'],
            ['6. A* matrix', 'Shortest stop-to-stop roads', 'Module 1'],
            ['7. TSP-TW', 'Order each vehicle\'s stops', 'Module 2'],
          ].map(([t, d, m]) => h('div', { class: 'step' }, h('b', {}, t), d, h('br'), h('small', {}, m))),
        ),
        h('p', {}, h('button', { class: 'btn', onclick: () => ctx.go('planner') }, 'Open the Route Planner →')),
      ),
      card('Team - Group 101', 'BTech CSE-F · Course CCSAI0301 · Faculty: Dr. Mohd. Nazim',
        h('ul', { class: 'checklist' },
          [
            ['Utkarsh Raj Shukla', 'Road graph, uninformed search, Water-Jug & M-C, integration'],
            ['Vivek Kumar', 'A* / Greedy, heuristics, 8-puzzle, TSP solvers'],
            ['Vishal Gupta', 'CSP solver, N-Queens, propositional & FOL knowledge base'],
            ['Yash Srivastava', 'Multi-vehicle extension, semantic net & frames, benchmarking'],
            ['Nishant Kumar Mahto', 'UI & route visualisation, expert-system interface'],
          ].map(([n, r]) => h('li', {}, h('span', { class: 'mark' }, '•'), h('div', {}, h('b', {}, n), h('br'), h('span', { class: 'muted' }, r)))),
        ),
      ),
    ),
    h('div', { class: 'grid halves' },
      card('Completed (Review 2)', null,
        h('ul', { class: 'checklist' }, DONE.map(([t, m]) => h('li', { class: 'done' }, h('span', { class: 'mark' }, '✓'), h('div', {}, t, ' ', h('span', { class: 'pill ok' }, m))))),
      ),
      card('Planned for the final review', null,
        h('ul', { class: 'checklist' }, TODO.map(([t, m]) => h('li', { class: 'todo' }, h('span', { class: 'mark' }, '○'), h('div', {}, t, ' ', h('span', { class: 'pill warn' }, m))))),
      ),
    ),
  );
}
