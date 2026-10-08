// First-order logic (Module 3): terms, unification and forward chaining over
// definite clauses with variables (written ?x). Includes comparison built-ins and
// negation-as-failure, enough to express the dispatch rules over all vehicles and
// deliveries, e.g.  Feasible(?v,?d) <= CanCarry(?v,?d) & Reachable(?v,?d).

export const isVar = (t) => typeof t === 'string' && t.startsWith('?');

export function atom(pred, ...args) {
  return { pred, args };
}

/** Parses "Pred(a, ?x, 300)" into an atom. Numbers become numbers. */
export function parseAtom(src) {
  const m = /^\s*(!?)\s*([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*$/.exec(src);
  if (!m) throw new Error(`Cannot parse atom: ${src}`);
  const args = m[3].trim() === '' ? [] : m[3].split(',').map((a) => {
    const t = a.trim();
    return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
  });
  const a = atom(m[2], ...args);
  if (m[1]) a.negated = true;
  return a;
}

/** Parses "Head(?x) <= A(?x) & B(?x, 3)" into a rule. */
export function parseRule(src, name) {
  const [head, body] = src.split('<=').map((s) => s.trim());
  return { name, head: parseAtom(head), body: body.split('&').map(parseAtom) };
}

export const showAtom = (a) => `${a.negated ? '¬' : ''}${a.pred}(${a.args.join(', ')})`;

function walk(t, theta) {
  while (isVar(t) && t in theta) t = theta[t];
  return t;
}

/** Unification of two atoms (or terms). Returns substitution or null. */
export function unify(x, y, theta = {}) {
  if (theta === null) return null;
  if (x && typeof x === 'object' && 'pred' in x) {
    if (!y || x.pred !== y.pred || x.args.length !== y.args.length) return null;
    let s = theta;
    for (let i = 0; i < x.args.length && s; i++) s = unify(x.args[i], y.args[i], s);
    return s;
  }
  const a = walk(x, theta);
  const b = walk(y, theta);
  if (a === b) return theta;
  if (isVar(a)) return { ...theta, [a]: b };
  if (isVar(b)) return { ...theta, [b]: a };
  return null;
}

export const substitute = (a, theta) => ({ ...a, args: a.args.map((t) => walk(t, theta)) });

const BUILTINS = {
  le: (a, b) => a <= b,
  lt: (a, b) => a < b,
  ge: (a, b) => a >= b,
  gt: (a, b) => a > b,
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
};

export class FolKB {
  constructor() {
    this.facts = [];
    this.index = new Set();
    this.rules = [];
    this.derivations = new Map();
  }

  tell(a, by = 'given') {
    const key = showAtom(a);
    if (this.index.has(key)) return false;
    this.index.add(key);
    this.facts.push(a);
    this.derivations.set(key, by);
    return true;
  }

  addRule(rule) {
    this.rules.push(rule);
  }

  /** All substitutions that satisfy a conjunction of literals. */
  match(body, theta = {}) {
    if (!body.length) return [theta];
    const [first, ...rest] = body;
    const out = [];
    if (first.pred in BUILTINS) {
      const [a, b] = first.args.map((t) => walk(t, theta));
      if (!isVar(a) && !isVar(b) && BUILTINS[first.pred](a, b) !== !!first.negated) out.push(...this.match(rest, theta));
      return out;
    }
    if (first.negated) {
      // Negation as failure: succeeds when no fact unifies.
      const positive = { pred: first.pred, args: first.args };
      const any = this.facts.some((f) => unify(substitute(positive, theta), f, {}) !== null);
      return any ? [] : this.match(rest, theta);
    }
    for (const f of this.facts) {
      const s = unify(first, f, theta);
      if (s) out.push(...this.match(rest, s));
    }
    return out;
  }

  /** Forward chaining to a fixed point. Rules with negation run after positive saturation. */
  forwardChain() {
    const trace = [];
    const strata = [this.rules.filter((r) => !r.body.some((b) => b.negated)), this.rules.filter((r) => r.body.some((b) => b.negated))];
    for (const rules of strata) {
      let added = true;
      while (added) {
        added = false;
        for (const r of rules) {
          for (const theta of this.match(r.body)) {
            const fact = substitute(r.head, theta);
            if (this.tell(fact, r.name)) {
              trace.push({ rule: r.name, fact: showAtom(fact) });
              added = true;
            }
          }
        }
      }
    }
    return trace;
  }

  query(src) {
    const q = typeof src === 'string' ? parseAtom(src) : src;
    return this.match([q]).map((theta) => substitute(q, theta));
  }

  /** ∀x∈xs ∃y : pred(y, x) — e.g. every delivery has at least one feasible vehicle. */
  forAllExists(xs, pred) {
    const failing = xs.filter((x) => this.query(atom(pred, '?y', x)).length === 0);
    return { holds: failing.length === 0, failing };
  }
}
