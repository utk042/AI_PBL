// Propositional logic (Module 3): parser, evaluation, truth tables, model-checking
// entailment, and forward / backward chaining over Horn-clause rules.
//
// Syntax: identifiers, ! or ~ (NOT), & (AND), | (OR), -> (IMPLIES), <-> (IFF), parentheses.
// Unicode ¬ ∧ ∨ → ↔ are accepted too.

const SYMBOLS = { '¬': '!', '~': '!', '∧': '&', '∨': '|', '→': '->', '↔': '<->' };

function tokenize(src) {
  const s = src.replace(/[¬~∧∨→↔]/g, (c) => SYMBOLS[c]);
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (s.startsWith('<->', i)) { tokens.push('<->'); i += 3; continue; }
    if (s.startsWith('->', i)) { tokens.push('->'); i += 2; continue; }
    if ('!&|()'.includes(ch)) { tokens.push(ch); i++; continue; }
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (!m) throw new Error(`Unexpected character '${ch}' at position ${i}`);
    tokens.push(m[0]);
    i += m[0].length;
  }
  return tokens;
}

/** Recursive-descent parser. Precedence: ! > & > | > -> > <-> ; -> is right-associative. */
export function parse(src) {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (t) => {
    if (tokens[pos] !== t) throw new Error(`Expected '${t}' but found '${tokens[pos] ?? 'end'}'`);
    pos++;
  };

  const iff = () => {
    let left = implies();
    while (peek() === '<->') { pos++; left = { op: '<->', left, right: implies() }; }
    return left;
  };
  const implies = () => {
    const left = or();
    if (peek() === '->') { pos++; return { op: '->', left, right: implies() }; }
    return left;
  };
  const or = () => {
    let left = and();
    while (peek() === '|') { pos++; left = { op: '|', left, right: and() }; }
    return left;
  };
  const and = () => {
    let left = not();
    while (peek() === '&') { pos++; left = { op: '&', left, right: not() }; }
    return left;
  };
  const not = () => {
    if (peek() === '!') { pos++; return { op: '!', arg: not() }; }
    if (peek() === '(') { pos++; const e = iff(); eat(')'); return e; }
    const t = peek();
    if (!t || !/^[A-Za-z_]/.test(t)) throw new Error(`Expected a proposition but found '${t ?? 'end'}'`);
    pos++;
    if (t === 'T' || t === 'true') return { const: true };
    if (t === 'F' || t === 'false') return { const: false };
    return { atom: t };
  };

  if (!tokens.length) throw new Error('Empty formula');
  const ast = iff();
  if (pos !== tokens.length) throw new Error(`Unexpected '${tokens[pos]}'`);
  return ast;
}

export function evaluate(ast, model) {
  if ('const' in ast) return ast.const;
  if (ast.atom) return !!model[ast.atom];
  switch (ast.op) {
    case '!': return !evaluate(ast.arg, model);
    case '&': return evaluate(ast.left, model) && evaluate(ast.right, model);
    case '|': return evaluate(ast.left, model) || evaluate(ast.right, model);
    case '->': return !evaluate(ast.left, model) || evaluate(ast.right, model);
    case '<->': return evaluate(ast.left, model) === evaluate(ast.right, model);
    default: throw new Error(`Unknown operator ${ast.op}`);
  }
}

export function atoms(ast, out = new Set()) {
  if (ast.atom) out.add(ast.atom);
  if (ast.arg) atoms(ast.arg, out);
  if (ast.left) { atoms(ast.left, out); atoms(ast.right, out); }
  return out;
}

const OP_TEXT = { '!': '¬', '&': '∧', '|': '∨', '->': '→', '<->': '↔' };
export function show(ast) {
  if ('const' in ast) return ast.const ? 'T' : 'F';
  if (ast.atom) return ast.atom;
  if (ast.op === '!') return `¬${ast.arg.atom ? show(ast.arg) : `(${show(ast.arg)})`}`;
  return `(${show(ast.left)} ${OP_TEXT[ast.op]} ${show(ast.right)})`;
}

function* models(vars) {
  const n = vars.length;
  for (let i = 0; i < 1 << n; i++) {
    const m = {};
    vars.forEach((v, j) => (m[v] = !!(i & (1 << (n - 1 - j)))));
    yield m;
  }
}

/** Full truth table for a formula. */
export function truthTable(src) {
  const ast = parse(src);
  const vars = [...atoms(ast)].sort();
  const rows = [];
  for (const m of models(vars)) rows.push({ model: m, value: evaluate(ast, m) });
  const trues = rows.filter((r) => r.value).length;
  return {
    formula: show(ast),
    vars,
    rows,
    tautology: trues === rows.length,
    satisfiable: trues > 0,
    contradiction: trues === 0,
  };
}

/** KB |= query by model checking (TT-Entails). */
export function entails(kbSources, querySource) {
  const kb = kbSources.map(parse);
  const q = parse(querySource);
  const vars = new Set();
  kb.forEach((f) => atoms(f, vars));
  atoms(q, vars);
  let checked = 0;
  for (const m of models([...vars].sort())) {
    if (kb.every((f) => evaluate(f, m))) {
      checked++;
      if (!evaluate(q, m)) return { entailed: false, counterExample: m, modelsChecked: checked };
    }
  }
  return { entailed: true, modelsChecked: checked };
}

/**
 * Forward chaining over Horn rules { if: [atoms], then: atom } (data-driven).
 * Returns every derived fact with the rule that produced it.
 */
export function forwardChain(facts, rules) {
  const known = new Map(facts.map((f) => [f, { by: 'given' }]));
  const trace = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of rules) {
      if (known.has(r.then)) continue;
      if (r.if.every((p) => known.has(p))) {
        known.set(r.then, { by: r.id });
        trace.push({ rule: r.id, from: r.if, derived: r.then });
        changed = true;
      }
    }
  }
  return { facts: [...known.keys()], trace, known };
}

/** Backward chaining (goal-driven) returning a proof tree. */
export function backwardChain(goal, facts, rules, seen = new Set()) {
  if (facts.includes(goal)) return { goal, proved: true, by: 'fact' };
  if (seen.has(goal)) return { goal, proved: false, by: 'cycle' };
  seen.add(goal);
  for (const r of rules.filter((x) => x.then === goal)) {
    const children = r.if.map((p) => backwardChain(p, facts, rules, new Set(seen)));
    if (children.every((c) => c.proved)) return { goal, proved: true, by: r.id, children };
  }
  return { goal, proved: false, by: 'no rule' };
}
