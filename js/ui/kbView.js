import { h, s, card, table, select, field, pill, subtabs } from './dom.js';
import { truthTable, entails, forwardChain, backwardChain, parse } from '../kr/propositional.js';
import { showAtom } from '../kr/fol.js';
import { planRoutes } from '../planner.js';

// ---------------------------------------------------------------- propositional
function propositional() {
  const formula = h('input', { value: '(WithinCapacity & WithinWindow) -> Feasible', style: 'width:100%' });
  const ttOut = h('div');
  const showTT = () => {
    try {
      const t = truthTable(formula.value);
      ttOut.replaceChildren(
        h('p', {}, h('span', { class: 'mono' }, t.formula), ' ', t.tautology ? pill('tautology', 'ok') : t.contradiction ? pill('contradiction', 'bad') : pill('satisfiable', 'warn')),
        t.vars.length > 6
          ? h('p', { class: 'muted' }, `${t.rows.length} rows - showing only satisfying models count: ${t.rows.filter((r) => r.value).length}`)
          : table([...t.vars, 'Result'], t.rows.map((r) => [...t.vars.map((v) => (r.model[v] ? 'T' : 'F')), r.value ? pill('T', 'ok') : pill('F', 'bad')])),
      );
    } catch (e) {
      ttOut.replaceChildren(h('p', { class: 'err' }, e.message));
    }
  };
  formula.addEventListener('input', showTT);
  showTT();

  const kbText = h('textarea', { rows: 7 }, [
    'WithinCapacity',
    'WithinWindow',
    'Permitted',
    'WithinCapacity & WithinWindow -> Feasible',
    'Feasible & Permitted -> Assign',
    'Perishable -> NeedsReefer',
  ].join('\n'));
  const query = h('input', { value: 'Assign' });
  const chainOut = h('div');
  const runChain = () => {
    try {
      const lines = kbText.value.split('\n').map((l) => l.trim()).filter(Boolean);
      const facts = [];
      const rules = [];
      lines.forEach((l, i) => {
        if (l.includes('->')) {
          const [lhs, rhs] = l.split('->').map((x) => x.trim());
          rules.push({ id: `R${rules.length + 1}`, if: lhs.split('&').map((x) => x.trim()), then: rhs });
        } else facts.push(l);
        parse(l); // validates syntax
        return i;
      });
      const fc = forwardChain(facts, rules);
      const bc = backwardChain(query.value.trim(), facts, rules);
      const ent = entails(lines, query.value.trim());
      const tree = (n) => h('li', {}, `${n.goal} `, n.proved ? pill(n.by === 'fact' ? 'fact' : `by ${n.by}`, 'ok') : pill(n.by, 'bad'), n.children ? h('ul', {}, n.children.map(tree)) : null);
      chainOut.replaceChildren(
        h('h3', {}, 'Forward chaining (data-driven)'),
        h('ol', { class: 'steps' }, fc.trace.length ? fc.trace.map((t) => h('li', {}, `${t.rule}: ${t.from.join(' ∧ ')} ⇒ ${t.derived}`)) : h('li', {}, 'No rule fired.')),
        h('h3', {}, `Backward chaining (goal-driven) for "${query.value}"`),
        h('ul', { class: 'steps' }, tree(bc)),
        h('h3', {}, 'Model checking'),
        h('p', {}, `KB ⊨ ${query.value}: `, ent.entailed ? pill('entailed', 'ok') : pill('not entailed', 'bad'), h('span', { class: 'muted' }, ` (${ent.modelsChecked} models of the KB checked)`)),
      );
    } catch (e) {
      chainOut.replaceChildren(h('p', { class: 'err' }, e.message));
    }
  };
  kbText.addEventListener('input', runChain);
  query.addEventListener('input', runChain);
  runChain();

  return h('div', { class: 'grid halves' },
    card('Truth table', 'Operators: ! (¬) & (∧) | (∨) -> (→) <-> (↔). Try "Feasible <-> (WithinCapacity & WithinWindow)".', formula, ttOut),
    card('Propositional knowledge base', 'One fact or Horn rule per line. The dispatch decision Assign is derived from the feasibility rules.', kbText, h('div', { class: 'controls' }, field('Query', query)), chainOut),
  );
}

// ---------------------------------------------------------------- first-order logic
function firstOrder(plan) {
  const { kb } = plan;
  const q = h('input', { value: 'Feasible(?v, D3)', style: 'width:220px' });
  const out = h('div');
  const run = () => {
    try {
      const res = kb.query(q.value);
      out.replaceChildren(res.length ? h('div', {}, res.map((a) => pill(showAtom(a)))) : h('p', { class: 'muted' }, 'No matching facts (query is false under the KB).'));
    } catch (e) {
      out.replaceChildren(h('p', { class: 'err' }, e.message));
    }
  };
  q.addEventListener('input', run);
  run();
  const derived = plan.folTrace.filter((t) => t.fact.startsWith('Feasible') || t.fact.startsWith('Unservable'));
  return h('div', { class: 'grid halves' },
    card('First-order rules', 'Variables (?v vehicle, ?d delivery) range over all vehicles and deliveries; built-ins le(x, y) compare numbers; ! is negation as failure.',
      h('ul', { class: 'steps' }, kb.rules.map((r) => h('li', { class: 'mono' }, `${r.name}: ${showAtom(r.head)} ⇐ ${r.body.map(showAtom).join(' ∧ ')}`))),
      h('h3', {}, 'Universal check: ∀d ∃v Feasible(v, d)'),
      h('p', {}, plan.coverage.holds ? pill('holds - every delivery has at least one feasible vehicle', 'ok') : pill(`fails for ${plan.coverage.failing.join(', ')}`, 'bad')),
      h('h3', {}, 'Ask the knowledge base'),
      h('div', { class: 'controls' }, field('Query (e.g. CanCarry(BK-1, ?d), Permitted(TR-1, ?d))', q)), out,
    ),
    card('Derivation trace', `${kb.facts.length} facts after forward chaining; ${derived.length} Feasible facts derived.`,
      h('div', { class: 'log' }, plan.folTrace.map((t) => `[${t.rule}] ${t.fact}`).join('\n')),
    ),
  );
}

// ---------------------------------------------------------------- semantic network
const POS = {
  Vehicle: [450, 50], Road: [835, 50], Van: [250, 165], Truck: [410, 165], Bike: [620, 165], RefrigeratedVan: [110, 280],
  'RV-1': [110, 400], 'VN-2': [270, 290], 'TR-1': [410, 290], 'BK-1': [620, 290], Depot: [760, 165], Junction: [820, 290],
  DeliveryPoint: [820, 410], Delivery: [580, 410],
};

function semanticNet(world) {
  const { net } = world;
  const drawn = net.links.filter((l) => POS[l.from] && POS[l.to]);
  const svg = s('svg', { viewBox: '0 0 900 450', style: 'width:100%;height:auto', role: 'img', 'aria-label': 'Semantic network' },
    s('defs', {}, s('marker', { id: 'arr', viewBox: '0 0 10 10', refX: 10, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--muted)' }))),
    drawn.map((l) => {
      const [x1, y1] = POS[l.from];
      const [x2, y2] = POS[l.to];
      const len = Math.hypot(x2 - x1, y2 - y1);
      const ex = x2 - ((x2 - x1) / len) * 40;
      const ey = y2 - ((y2 - y1) / len) * 22;
      return s('g', {},
        s('line', { x1, y1, x2: ex, y2: ey, stroke: 'var(--muted)', 'stroke-width': 1.4, 'marker-end': 'url(#arr)', 'stroke-dasharray': l.rel === 'instance-of' ? '5 4' : null }),
        s('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 5, 'text-anchor': 'middle', 'font-size': 12, 'paint-order': 'stroke', stroke: 'var(--panel)', 'stroke-width': 4, fill: 'var(--accent)' }, l.rel));
    }),
    Object.entries(POS).map(([id, [x, y]]) => {
      const inst = net.nodes.get(id)?.kind === 'instance';
      return s('g', {},
        s('rect', { x: x - 58, y: y - 17, width: 116, height: 34, rx: inst ? 17 : 6, fill: 'var(--panel)', stroke: inst ? 'var(--ok)' : 'var(--accent)', 'stroke-width': 1.6 }),
        s('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600, fill: 'var(--ink)' }, id));
    }),
  );

  const st = { node: 'RV-1', rel: 'can-carry' };
  const out = h('div');
  const run = () => {
    const r = net.lookup(st.node, st.rel);
    const all = net.describe(st.node);
    out.replaceChildren(
      h('p', {}, `${st.node} ${st.rel}: `, r.values.length ? r.values.map((v) => pill(v)) : pill('nothing', 'warn')),
      h('p', { class: 'muted' }, r.source ? `Found on "${r.source}" via inheritance chain ${r.path.join(' → ')}` : `Searched ${r.path.join(' → ')}`),
      h('h3', {}, `Everything known about ${st.node}`),
      table(['Relation', 'Values', 'Stored on'], Object.entries(all).map(([rel, v]) => [rel, v.values.join(', '), v.source === st.node ? 'own' : `inherited from ${v.source}`])),
      h('p', {}, `Ancestors: ${net.ancestors(st.node).join(' → ') || '(none)'}`),
    );
  };
  run();
  const nodes = [...net.nodes.keys()].filter((k) => !k.startsWith('D') || k.startsWith('Deliver') || k === 'Depot');
  return h('div', {},
    card('Semantic network', 'Boxes are classes, rounded boxes are instances; dashed arrows are instance-of links. can-carry and cannot-enter links are omitted from the drawing for clarity but are used in queries.', svg),
    card('Inheritance query', 'A value not stored on a node is inherited through is-a / instance-of links.',
      h('div', { class: 'controls' },
        field('Node', select(nodes.map((n) => [n, n]), st.node, (v) => { st.node = v; run(); })),
        field('Relation', select(['can-carry', 'cannot-enter', 'starts-at', 'travels-on', 'served-by', 'located-at', 'connects'].map((r) => [r, r]), st.rel, (v) => { st.rel = v; run(); })),
      ), out),
  );
}

// ---------------------------------------------------------------- frames
function frames(world) {
  const fs = world.frames;
  const st = { frame: 'RV-1' };
  const out = h('div');
  const load = h('input', { type: 'number', value: 120, style: 'width:90px' });
  const log = h('div', { class: 'log' });
  const run = () => {
    const rows = fs.describe(st.frame);
    out.replaceChildren(
      h('p', {}, 'Inheritance: ', fs.chain(st.frame).map((f) => f.name).join(' → ')),
      table(['Slot', 'Value', 'Facet', 'Supplied by'], rows.map((r) => [r.slot, Array.isArray(r.value) ? `[${r.value.join(', ')}]` : String(r.value), pill(r.facet, r.facet === 'value' ? 'ok' : r.facet === 'if-needed' ? 'warn' : ''), r.source])),
    );
    log.textContent = fs.log.length ? fs.log.join('\n') : 'No demon has fired yet.';
  };
  run();
  const vehicles = fs.instancesOf('Vehicle');
  return h('div', { class: 'grid halves' },
    card('Frames', 'Each slot is filled by its own value, an if-needed procedure, an inherited value or a class default.',
      h('div', { class: 'controls' }, field('Frame', select([...fs.frames.keys()].map((k) => [k, k]), st.frame, (v) => { st.frame = v; run(); }))), out),
    card('Demons (if-added / if-needed)', 'Setting currentLoad triggers the if-added demon; remainingCapacity is computed on demand by an if-needed procedure.',
      h('div', { class: 'controls' },
        field('Vehicle', select(vehicles.map((v) => [v, v]), vehicles[0], (v) => { st.frame = v; run(); })),
        field('currentLoad (kg)', load),
        h('button', { class: 'btn', onclick: () => { fs.set(st.frame, 'currentLoad', Number(load.value)); run(); } }, 'Set load'),
        h('button', { class: 'btn ghost', onclick: () => { fs.set(st.frame, 'currentLoad', 0); fs.log.length = 0; run(); } }, 'Reset'),
      ),
      h('h3', {}, 'Demon log'), log),
  );
}

export function renderKB(root, { world }) {
  const plan = planRoutes(world);
  const panes = { prop: propositional(), fol: firstOrder(plan), net: semanticNet(world), frames: frames(world) };
  const holder = h('div', {}, panes.prop);
  root.append(
    card('Knowledge representation (Module 3)', 'How the system stores what it knows about vehicles, deliveries and dispatch rules.'),
    subtabs([['prop', 'Propositional logic'], ['fol', 'First-order logic'], ['net', 'Semantic network'], ['frames', 'Frames']], (id) => holder.replaceChildren(panes[id])),
    holder,
  );
}
