import { h, card, table, select, field, pill } from './dom.js';
import { DISPATCH_RULES } from '../kr/dispatchRules.js';
import { explainHow, explainWhy, showCondition, showAction } from '../kr/expertSystem.js';
import { deliveryFacts, permittedVehicles } from '../planner.js';
import { formatClock } from '../planner.js';

export function renderExpert(root, { world }) {
  const { engine, graph } = world;
  const zones = [...new Set([...graph.nodes.values()].map((n) => n.zone))];
  const st = { ...deliveryFacts(world, world.deliveries[0]), node: world.deliveries[0].node };
  const out = h('div');
  const formBox = h('div');
  const goalBox = h('div');

  const num = (key) => h('input', { type: 'number', value: st[key], style: 'width:90px', oninput: (e) => { st[key] = Number(e.target.value); run(); } });

  const buildForm = () => {
    formBox.replaceChildren(
      h('div', { class: 'controls' },
        field('Load from delivery', select([['', '- custom -'], ...world.deliveries.map((d) => [d.id, `${d.id} · ${graph.node(d.node).name}`])], '', (id) => {
          const d = world.deliveries.find((x) => x.id === id);
          if (!d) return;
          Object.assign(st, deliveryFacts(world, d), { node: d.node });
          buildForm();
          run();
        })),
        field('Item', select(['standard', 'perishable', 'fragile', 'bulk', 'documents'].map((x) => [x, x]), st.item, (v) => { st.item = v; run(); })),
        field('Demand (kg)', num('demand')),
        field('Zone', select(zones.map((z) => [z, z]), st.zone, (v) => { st.zone = v; run(); })),
        field('Priority', select(['high', 'normal', 'low'].map((x) => [x, x]), st.priority, (v) => { st.priority = v; run(); })),
        field('Window start (min after 09:00)', num('windowStart')),
        field('Window end', num('windowEnd')),
      ),
    );
  };

  const run = () => {
    const facts = { item: st.item, demand: st.demand, zone: st.zone, priority: st.priority, windowStart: st.windowStart, windowEnd: st.windowEnd };
    const res = engine.forward(facts);
    const allowed = res.wm.values('allowed-class');
    const forbidden = res.wm.values('forbidden-class');
    const fake = { node: [...graph.nodes.values()].find((n) => n.zone === st.zone).id, item: st.item };
    const vehicles = permittedVehicles(world, fake, { allowed, forbidden });

    out.replaceChildren(
      card('Recommendation', `Delivery window ${formatClock(st.windowStart)}-${formatClock(st.windowEnd)}.`,
        h('p', {}, 'Permitted vehicle classes: ', allowed.map((c) => pill(c, 'ok')), ' Forbidden: ', forbidden.length ? forbidden.map((c) => pill(c, 'bad')) : pill('none')),
        h('p', {}, 'Vehicles in the fleet that qualify: ', vehicles.length ? vehicles.map((v) => pill(v.label, 'ok')) : pill('none - order cannot be served', 'bad')),
        h('p', {}, 'Dispatch wave: ', pill(res.wm.first('wave') || '-', 'warn')),
        res.advice.length ? h('ul', { class: 'steps' }, res.advice.map((a) => h('li', {}, `${a.text} (${a.by})`))) : null,
        h('h3', {}, 'Explanation - HOW were the conclusions reached?'),
        h('div', { class: 'log' }, [...allowed.map((c) => ['allowed-class', c]), ...forbidden.map((c) => ['forbidden-class', c])].flatMap(([a, v]) => explainHow(DISPATCH_RULES, res.wm, a, v)).join('\n')),
        h('h3', {}, 'Explanation - WHY was each rule used?'),
        h('ul', { class: 'steps' }, res.fired.map((id) => h('li', {}, explainWhy(DISPATCH_RULES.find((r) => r.id === id))))),
      ),
      card('Inference engine trace (match → resolve → act)', 'Each cycle builds the conflict set of rules whose conditions match working memory, picks the highest-salience rule, and fires it once (refractoriness).',
        table(['Cycle', 'Conflict set', 'Fired', 'Added to working memory'], res.cycles.map((c) => [c.cycle, c.conflictSet.join(', '), pill(c.fired), c.added.join('; ')])),
        h('h3', {}, 'Final working memory'),
        table(['Attribute', 'Value', 'Source'], res.wm.facts.map((f) => [f.attr, String(f.value), f.by])),
      ),
    );

    // Backward chaining: can a specific goal be proved from these facts?
    const goals = [['allowed-class', 'Truck'], ['allowed-class', 'RefrigeratedVan'], ['allowed-class', 'Bike'], ['forbidden-class', 'Truck'], ['wave', 'first']];
    const tree = (n) => h('li', {}, n.goal.op ? showCondition(n.goal) : `${n.goal.attr} = ${n.goal.value}`, ' ', n.proved ? pill(n.by, 'ok') : pill(n.by, 'bad'), n.children?.length ? h('ul', {}, n.children.map(tree)) : null);
    goalBox.replaceChildren(
      table(['Goal', 'Proof (backward chaining)'], goals.map(([attr, value]) => [`${attr} = ${value}`, h('ul', { class: 'steps' }, tree(engine.backward({ attr, value }, facts)))])),
    );
  };

  buildForm();
  run();

  root.append(
    card('Expert system: Dispatch Advisor (Module 3)', 'Decides which vehicle classes may carry a delivery and when it should leave. Its output feeds the CSP domains in the Route Planner.',
      h('div', { class: 'arch' },
        h('div', {}, h('b', {}, 'User interface'), h('br'), 'This form: the dispatcher enters the order facts.'),
        h('div', {}, h('b', {}, 'Working memory'), h('br'), 'Facts about the current order plus every conclusion derived.'),
        h('div', {}, h('b', {}, 'Inference engine'), h('br'), 'Forward chaining with salience-based conflict resolution; backward chaining for goals.'),
        h('div', {}, h('b', {}, 'Knowledge base'), h('br'), `${DISPATCH_RULES.length} IF-THEN dispatch rules from domain experts.`),
        h('div', {}, h('b', {}, 'Explanation facility'), h('br'), 'HOW a conclusion was reached and WHY a rule was used.'),
        h('div', {}, h('b', {}, 'Knowledge acquisition'), h('br'), 'Rules written from courier handling policies; editable in dispatchRules.js.'),
      ),
      h('h3', {}, 'Order facts'), formBox,
    ),
    h('div', { class: 'grid halves' }, out),
    card('Goal-driven reasoning', 'Backward chaining starts from a goal and works back to the input facts.', goalBox),
    card('Knowledge base rules', null,
      table(['Rule', 'Name', 'IF', 'THEN', 'Salience'], DISPATCH_RULES.map((r) => [r.id, r.name, r.if.map(showCondition).join(' AND '), r.then.map(showAction).join('; '), r.salience]), { numeric: [4] })),
  );
}
