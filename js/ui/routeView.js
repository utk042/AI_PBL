import { h } from './dom.js';
import { createMap, COLORS } from './mapView.js';
import { findRouteOptions, explainRoute, explainAlternative, directions, viaText, CRITERIA, fmtMin, fmtKm, fmtRs } from '../core/routeOptions.js';

const VEHICLES = [
  ['Bike', 'Bike', 'up to 20 kg'],
  ['Van', 'Van', 'up to 300 kg'],
  ['RefrigeratedVan', 'Cold van', 'up to 250 kg'],
  ['Truck', 'Truck', 'up to 800 kg'],
];

const ROAD = { main: 'main road', arterial: 'city road', local: 'local road' };

function segmented(items, value, onPick, cls = '') {
  const wrap = h('div', { class: `seg ${cls}`, role: 'radiogroup' });
  const render = (v) => {
    wrap.replaceChildren(...items.map(([id, label, sub]) =>
      h('button', { type: 'button', role: 'radio', 'aria-checked': String(id === v), class: id === v ? 'on' : '', onclick: () => { render(id); onPick(id); } },
        h('span', {}, label), sub ? h('small', {}, sub) : null)));
  };
  render(value);
  return { el: wrap, set: render };
}

export function renderRoute(root, { world }) {
  const { graph, net, frames } = world;
  const places = [...graph.nodes.values()].sort((a, b) => a.name.localeCompare(b.name));
  const st = { from: 'N0', to: 'N24', vehicle: 'Van', goal: 'fastest', selected: 0 };

  const placeSelect = (key) => {
    const el = h('select', { 'aria-label': key === 'from' ? 'Start' : 'Destination', onchange: (e) => { st[key] = e.target.value; update(); } },
      places.map((n) => h('option', { value: n.id }, n.name)));
    el.value = st[key];
    return el;
  };
  const fromSel = placeSelect('from');
  const toSel = placeSelect('to');
  const swap = h('button', { class: 'icon-btn', type: 'button', title: 'Swap start and destination', 'aria-label': 'Swap start and destination', onclick: () => {
    [st.from, st.to] = [st.to, st.from];
    fromSel.value = st.from;
    toSel.value = st.to;
    update();
  } }, '⇅');

  const vehicleSeg = segmented(VEHICLES, st.vehicle, (v) => { st.vehicle = v; update(); }, 'seg-vehicle');
  const goalSeg = segmented(Object.entries(CRITERIA).map(([k, c]) => [k, c.label]), st.goal, (g) => { st.goal = g; st.selected = null; update(); }, 'seg-goal');

  const list = h('div', { class: 'route-list' });
  const why = h('div');
  const steps = h('div');
  const mapEl = h('div', { class: 'map' });

  const panel = h('aside', { class: 'panel' },
    h('div', { class: 'field-row' },
      h('div', { class: 'stack' },
        h('label', { class: 'field' }, h('span', { class: 'dot start' }), fromSel),
        h('label', { class: 'field' }, h('span', { class: 'dot end' }), toSel)),
      swap),
    h('div', { class: 'label' }, 'Vehicle'), vehicleSeg.el,
    h('div', { class: 'label' }, 'Best for'), goalSeg.el,
    list, why, steps,
  );
  root.append(h('div', { class: 'split' }, panel, h('div', { class: 'map-wrap' }, mapEl)));

  const map = createMap(mapEl, graph);
  map.showPlaces({
    actions: [
      ['Start here', (id) => { st.from = id; fromSel.value = id; update(); }],
      ['Go here', (id) => { st.to = id; toSel.value = id; update(); }],
    ],
  });

  let found = null;

  function update() {
    if (st.from === st.to) {
      list.replaceChildren(h('p', { class: 'note' }, 'Start and destination are the same place.'));
      why.replaceChildren();
      steps.replaceChildren();
      map.setRoutes([]);
      map.setPins([{ id: st.from, kind: 'start', text: 'A' }]);
      return;
    }
    found = findRouteOptions(graph, net, frames, st);
    if (found.error) {
      list.replaceChildren(h('p', { class: 'note warn' }, found.error));
      why.replaceChildren();
      steps.replaceChildren();
      map.setRoutes([]);
      map.setPins([{ id: st.from, kind: 'start', text: 'A' }, { id: st.to, kind: 'end', text: 'B' }]);
      return;
    }
    if (st.selected === null || st.selected >= found.routes.length) {
      st.selected = Math.max(0, found.routes.findIndex((r) => r.best.includes(st.goal)));
    }
    draw(true);
  }

  function draw(refit) {
    const routes = found.routes;
    const sel = routes[st.selected];
    const goalIdx = routes.findIndex((r) => r.best.includes(st.goal));

    list.replaceChildren(...routes.map((r, i) => {
      const m = r.metrics;
      const tags = r.best.map((k) => h('span', { class: `tag ${k === st.goal ? 'tag-on' : ''}` }, CRITERIA[k].label));
      const base = routes[goalIdx].metrics;
      const delta = i === goalIdx ? null : [
        Math.abs(m.time - base.time) >= 0.5 ? `${m.time > base.time ? '+' : '−'}${fmtMin(Math.abs(m.time - base.time))}` : null,
        Math.abs(m.distance - base.distance) >= 0.05 ? `${m.distance > base.distance ? '+' : '−'}${fmtKm(Math.abs(m.distance - base.distance))}` : null,
      ].filter(Boolean).join(' · ');
      return h('button', { type: 'button', class: `route-card ${i === st.selected ? 'sel' : ''}`, onclick: () => { st.selected = i; draw(false); } },
        h('div', { class: 'rc-top' }, h('span', { class: 'rc-time' }, fmtMin(m.time)), h('span', { class: 'rc-dist' }, fmtKm(m.distance)), delta ? h('span', { class: 'rc-delta' }, delta) : null),
        h('div', { class: 'rc-via' }, viaText(graph, r.path)),
        h('div', { class: 'rc-money' }, `Running cost ${fmtRs(m.cost)} · Fare ${fmtRs(m.fare)}`),
        tags.length ? h('div', { class: 'rc-tags' }, tags) : h('div', { class: 'rc-tags' }, h('span', { class: 'tag muted' }, 'Alternative')));
    }));

    const reasons = sel.best.includes(st.goal) ? explainRoute(graph, found, st.goal) : explainAlternative(graph, found, sel, st.goal);
    why.replaceChildren(h('h3', {}, 'Why this route'), h('ul', { class: 'reasons' }, reasons.map((t) => h('li', {}, t))));

    const dir = directions(graph, sel.path, found.profile);
    steps.replaceChildren(h('details', {},
      h('summary', {}, `Directions · ${dir.length} ${dir.length === 1 ? 'step' : 'steps'}`),
      h('ol', { class: 'directions' },
        h('li', {}, h('b', {}, graph.node(st.from).name), h('span', { class: 'muted' }, ' start')),
        dir.map((d) => h('li', {}, `Take the ${ROAD[d.road]} to `, h('b', {}, d.to), h('span', { class: 'muted' }, ` · ${fmtKm(d.distance)} · ${fmtMin(d.time)}`))))));

    // Unselected routes in grey underneath, the selected one on top in blue.
    const layers = routes.map((r, i) => ({ r, i })).filter(({ i }) => i !== st.selected).map(({ r, i }) => ({
      coords: r.geometry, color: '#9aa0a6', weight: 5, opacity: 0.9, onClick: () => { st.selected = i; draw(false); }, tooltip: `${fmtMin(r.metrics.time)} · ${fmtKm(r.metrics.distance)}`,
    }));
    layers.push({ coords: sel.geometry, color: COLORS[0], weight: 6 });
    map.setRoutes(layers);
    map.setPins([{ id: st.from, kind: 'start', text: 'A' }, { id: st.to, kind: 'end', text: 'B' }]);
    if (refit) map.fit(routes.map((r) => r.geometry));
  }

  update();
}
