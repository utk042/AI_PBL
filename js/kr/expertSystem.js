// Rule-based expert system (Module 3).
//
// Architecture (as taught in class):
//   Knowledge Base       -> the IF-THEN rules (dispatchRules.js)
//   Working Memory       -> facts about the current delivery (class WorkingMemory)
//   Inference Engine     -> match-resolve-act forward chaining + backward chaining (class InferenceEngine)
//   Explanation Facility -> HOW was a fact derived / WHY was a rule used (explain*)
//   User Interface       -> the "Expert System" tab of the web app
//
// Condition: { attr, op, value }, op in == != > >= < <= has absent
// Action:    { assert: attr, value } | { advise: text }

export class WorkingMemory {
  constructor(initial = {}) {
    this.facts = [];
    for (const [attr, value] of Object.entries(initial)) this.add(attr, value, 'user input');
  }

  add(attr, value, by) {
    if (this.has(attr, value)) return false;
    this.facts.push({ attr, value, by });
    return true;
  }

  has(attr, value) {
    return this.facts.some((f) => f.attr === attr && f.value === value);
  }

  values(attr) {
    return this.facts.filter((f) => f.attr === attr).map((f) => f.value);
  }

  first(attr) {
    return this.facts.find((f) => f.attr === attr)?.value;
  }
}

function test(wm, { attr, op, value }) {
  const v = wm.first(attr);
  switch (op) {
    case '==': return wm.has(attr, value);
    case '!=': return v !== undefined && !wm.has(attr, value);
    case '>': return v !== undefined && v > value;
    case '>=': return v !== undefined && v >= value;
    case '<': return v !== undefined && v < value;
    case '<=': return v !== undefined && v <= value;
    case 'has': return wm.has(attr, value);
    case 'absent': return wm.values(attr).length === 0;
    default: throw new Error(`Unknown operator ${op}`);
  }
}

export const showCondition = ({ attr, op, value }) => (op === 'absent' ? `no ${attr} decided` : `${attr} ${op} ${value}`);
export const showAction = (a) => (a.advise ? `advise "${a.advise}"` : `${a.assert} = ${a.value}`);

export class InferenceEngine {
  constructor(rules) {
    this.rules = rules;
  }

  /** Forward chaining with conflict resolution by salience, then rule order; each rule fires once (refractoriness). */
  forward(initialFacts) {
    const wm = initialFacts instanceof WorkingMemory ? initialFacts : new WorkingMemory(initialFacts);
    const fired = new Set();
    const cycles = [];
    const advice = [];
    for (let cycle = 1; cycle <= 100; cycle++) {
      const conflictSet = this.rules.filter((r) => !fired.has(r.id) && r.if.every((c) => test(wm, c)));
      if (!conflictSet.length) break;
      conflictSet.sort((a, b) => (b.salience ?? 0) - (a.salience ?? 0));
      const rule = conflictSet[0];
      fired.add(rule.id);
      const added = [];
      for (const act of rule.then) {
        if (act.advise) {
          advice.push({ text: act.advise, by: rule.id });
          added.push(`advice: ${act.advise}`);
        } else if (wm.add(act.assert, act.value, rule.id)) {
          added.push(`${act.assert} = ${act.value}`);
        }
      }
      cycles.push({ cycle, conflictSet: conflictSet.map((r) => r.id), fired: rule.id, added });
    }
    return { wm, cycles, advice, fired: [...fired] };
  }

  /** Backward chaining: can the goal fact be established from the initial facts? */
  backward(goal, initialFacts, depth = 0) {
    const wm = new WorkingMemory(initialFacts);
    if (wm.has(goal.attr, goal.value)) return { goal, proved: true, by: 'user input', children: [] };
    if (depth > 8) return { goal, proved: false, by: 'depth limit', children: [] };
    const candidates = this.rules.filter((r) => r.then.some((a) => a.assert === goal.attr && a.value === goal.value));
    for (const r of candidates) {
      const children = r.if.map((c) => {
        const ok = test(wm, c);
        if (ok || c.op !== 'has') return { goal: c, proved: ok, by: ok ? 'user input' : 'not in input', children: [] };
        return this.backward({ attr: c.attr, value: c.value }, initialFacts, depth + 1);
      });
      if (children.every((c) => c.proved)) return { goal, proved: true, by: r.id, children };
    }
    return { goal, proved: false, by: candidates.length ? 'conditions not met' : 'no rule concludes it', children: [] };
  }
}

/** Explanation facility: HOW was attr=value derived? Returns the rule chain. */
export function explainHow(rules, wm, attr, value) {
  const fact = wm.facts.find((f) => f.attr === attr && f.value === value);
  if (!fact) return [`${attr} = ${value} was not derived.`];
  if (fact.by === 'user input') return [`${attr} = ${value} was given as input.`];
  const rule = rules.find((r) => r.id === fact.by);
  const lines = [`${attr} = ${value} was concluded by ${rule.id} (${rule.name}) because ${rule.if.map(showCondition).join(' AND ')}.`];
  for (const c of rule.if) if (c.op === 'has') lines.push(...explainHow(rules, wm, c.attr, c.value).map((l) => `  ${l}`));
  return lines;
}

/** Explanation facility: WHY is this rule relevant? (what it is trying to conclude) */
export function explainWhy(rule) {
  return `${rule.id} is used because it can conclude ${rule.then.map(showAction).join(', ')} - ${rule.because}`;
}
