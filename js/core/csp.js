// Constraint Satisfaction Problem solver (Module 1).
// Backtracking search with MRV variable ordering, value ordering and forward checking.
// Used for delivery-to-vehicle assignment and for the N-Queens problem.
//
// csp = {
//   variables: [...],
//   domains: { var: [values] },
//   consistent(assignment, variable, value) -> boolean,   // checks all constraints
//   orderValues?(assignment, variable, values) -> values,  // optional value ordering
// }

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function solveCSP(csp, { forwardChecking = true, mrv = true, maxSolutions = 1, maxSteps = 2e6 } = {}) {
  const t0 = clock();
  const stats = { assignments: 0, backtracks: 0, pruned: 0 };
  const solutions = [];
  const domains = Object.fromEntries(csp.variables.map((v) => [v, [...csp.domains[v]]]));
  const assignment = {};

  const unassigned = () => csp.variables.filter((v) => !(v in assignment));

  const selectVariable = () => {
    const vars = unassigned();
    if (!mrv) return vars[0];
    // Minimum Remaining Values: choose the variable with the fewest legal values left.
    let best = vars[0];
    for (const v of vars) if (domains[v].length < domains[best].length) best = v;
    return best;
  };

  const recurse = () => {
    if (solutions.length >= maxSolutions || stats.assignments > maxSteps) return;
    if (Object.keys(assignment).length === csp.variables.length) {
      solutions.push({ ...assignment });
      return;
    }
    const v = selectVariable();
    const values = csp.orderValues ? csp.orderValues(assignment, v, domains[v]) : domains[v];

    for (const value of values) {
      if (!csp.consistent(assignment, v, value)) continue;
      assignment[v] = value;
      stats.assignments++;

      let saved = null;
      let wipeout = false;
      if (forwardChecking) {
        // Remove values from neighbouring domains that are no longer consistent.
        saved = {};
        for (const u of unassigned()) {
          const keep = domains[u].filter((w) => csp.consistent(assignment, u, w));
          if (keep.length !== domains[u].length) {
            saved[u] = domains[u];
            stats.pruned += domains[u].length - keep.length;
            domains[u] = keep;
          }
          if (keep.length === 0) {
            wipeout = true;
            break;
          }
        }
      }

      if (!wipeout) recurse();
      if (saved) Object.assign(domains, saved);
      delete assignment[v];
      if (solutions.length >= maxSolutions) return;
      stats.backtracks++;
    }
  };

  recurse();
  return { solution: solutions[0] || null, solutions, ...stats, timeMs: clock() - t0 };
}
