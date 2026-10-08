// N-Queens (Module 2) formulated as a CSP and solved with the same backtracking
// solver (MRV + forward checking) used for delivery-to-vehicle assignment.

import { solveCSP } from '../core/csp.js';

export function nQueensCSP(n) {
  const variables = [...Array(n).keys()]; // column index; value = row
  const domains = Object.fromEntries(variables.map((c) => [c, [...Array(n).keys()]]));
  return {
    variables,
    domains,
    consistent(assignment, col, row) {
      for (const [c, r] of Object.entries(assignment)) {
        const cc = Number(c);
        if (cc === col) continue;
        if (r === row || Math.abs(r - row) === Math.abs(cc - col)) return false;
      }
      return true;
    },
  };
}

export function solveNQueens(n, options = {}) {
  const res = solveCSP(nQueensCSP(n), options);
  const board = res.solution ? [...Array(n).keys()].map((c) => res.solution[c]) : null;
  return { ...res, board };
}
