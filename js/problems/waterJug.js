// Water-Jug problem (Module 2) as a state-space search problem.
// State: [a, b] litres in jug A (capacity capA) and jug B (capacity capB).
// Analogy in the project: splitting a load between two vehicles of fixed capacity.

export function waterJugProblem(capA = 4, capB = 3, target = 2) {
  return {
    initial: [0, 0],
    key: ([a, b]) => `${a},${b}`,
    isGoal: ([a]) => a === target, // classic form: measure the target in jug A
    successors([a, b]) {
      const pourAB = Math.min(a, capB - b);
      const pourBA = Math.min(b, capA - a);
      const moves = [
        [`Fill A (${capA}L)`, [capA, b]],
        [`Fill B (${capB}L)`, [a, capB]],
        ['Empty A', [0, b]],
        ['Empty B', [a, 0]],
        ['Pour A -> B', [a - pourAB, b + pourAB]],
        ['Pour B -> A', [a + pourBA, b - pourBA]],
      ];
      return moves
        .filter(([, s]) => s[0] !== a || s[1] !== b)
        .map(([action, state]) => ({ state, action, cost: 1 }));
    },
  };
}
