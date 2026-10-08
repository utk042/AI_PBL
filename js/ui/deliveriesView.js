import { h } from './dom.js';
import { createMap, COLORS } from './mapView.js';
import { planRoutes, planBaseline, formatClock } from '../planner.js';
import { DEPOT } from '../data/network.js';

const ITEM = { perishable: 'Perishable', fragile: 'Fragile', bulk: 'Bulk', documents: 'Documents', standard: 'Parcel' };

export function renderDeliveries(root, { world }) {
  const { graph, deliveries } = world;
  const st = { weight: 'distance', focus: null };
  const body = h('div');
  const mapEl = h('div', { class: 'map' });

  const plan = { distance: null, time: null };
  const baseline = planBaseline(world, { algorithm: 'bfs' });

  const optimise = h('div', { class: 'seg', role: 'radiogroup' });
  const renderSeg = () => optimise.replaceChildren(...[['distance', 'Least driving'], ['time', 'Least time']].map(([k, label]) =>
    h('button', { type: 'button', role: 'radio', 'aria-checked': String(k === st.weight), class: k === st.weight ? 'on' : '', onclick: () => { st.weight = k; st.focus = null; renderSeg(); update(); } }, h('span', {}, label))));
  renderSeg();

  root.append(h('div', { class: 'split' },
    h('aside', { class: 'panel' },
      h('h2', { class: 'panel-title' }, "Today's deliveries"),
      h('p', { class: 'muted' }, `${deliveries.length} orders · 4 vehicles · leaving the Knowledge Park II depot at 09:00`),
      h('div', { class: 'label' }, 'Plan for'), optimise,
      body),
    h('div', { class: 'map-wrap' }, mapEl)));

  const map = createMap(mapEl, graph);
  const stopNodes = new Set(deliveries.map((d) => d.node));
  map.showPlaces({ hide: new Set([...stopNodes, DEPOT]) });

  function update() {
    plan[st.weight] ||= planRoutes(world, { weight: st.weight });
    const p = plan[st.weight];
    const sum = p.summary;
    const saved = Math.round(((baseline.summary.distance - sum.distance) / baseline.summary.distance) * 100);
    const late = sum.windowViolations;

    const vehicleCards = p.routes.map((r, i) => {
      const color = COLORS[i];
      const pct = Math.round((r.load / r.capacity) * 100);
      return h('div', { class: `vehicle ${st.focus === i ? 'sel' : ''}` },
        h('button', { type: 'button', class: 'vehicle-head', onclick: () => { st.focus = st.focus === i ? null : i; update(); } },
          h('span', { class: 'swatch', style: `background:${color}` }),
          h('span', { class: 'v-name' }, r.vehicle.label),
          h('span', { class: 'v-meta' }, `${r.stops.length} ${r.stops.length === 1 ? 'stop' : 'stops'} · ${r.distance.toFixed(1)} km · back ${formatClock(r.finish)}`)),
        h('div', { class: 'load' }, h('div', { class: 'load-bar' }, h('div', { style: `width:${pct}%;background:${color}` })), h('span', {}, `${r.load} / ${r.capacity} kg`)),
        h('ol', { class: 'stops' }, r.arrivals.map((a, k) => {
          const d = deliveries.find((x) => x.id === a.id);
          const ontime = a.late === 0;
          return h('li', {},
            h('div', { class: 'stop-row' },
              h('span', { class: 'stop-num', style: `background:${color}` }, k + 1),
              h('div', { class: 'stop-main' },
                h('div', {}, h('b', {}, d.customer), ' · ', graph.node(d.node).name.split(',')[0]),
                h('div', { class: 'muted small' }, `${ITEM[d.item]}, ${d.demand} kg · arrives ${formatClock(a.arrive)} · window ${formatClock(d.window[0])}–${formatClock(d.window[1])}`)),
              h('span', { class: `badge ${ontime ? 'ok' : 'bad'}` }, ontime ? 'On time' : `${Math.round(a.late)} min late`)),
            h('details', { class: 'why' }, h('summary', {}, 'Why this vehicle?'), h('ul', {}, p.reasons[a.id].map((t) => h('li', {}, t)))));
        })));
    });

    body.replaceChildren(
      h('div', { class: 'summary' },
        h('div', { class: 'big' }, late === 0 ? `All ${sum.served} orders on time` : `${late} orders late`),
        h('div', { class: 'facts' },
          h('div', {}, h('b', {}, `${sum.distance.toFixed(1)} km`), h('span', {}, 'total driving')),
          h('div', {}, h('b', {}, formatClock(sum.makespan)), h('span', {}, 'last vehicle back')),
          h('div', {}, h('b', {}, `${sum.fuel.toFixed(1)} L`), h('span', {}, 'fuel'))),
        h('p', { class: 'muted small' }, `${saved}% less driving than handing out orders in turn (${baseline.summary.distance.toFixed(1)} km).`)),
      ...vehicleCards,
      h('details', { class: 'orders' }, h('summary', {}, 'All orders'),
        h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, ['Order', 'Customer', 'Place', 'Goods', 'Window', 'Vehicle'].map((t) => h('th', {}, t)))),
          h('tbody', {}, deliveries.map((d) => h('tr', {},
            h('td', {}, d.id), h('td', {}, d.customer), h('td', {}, graph.node(d.node).name.split(',')[0]),
            h('td', {}, `${ITEM[d.item]}, ${d.demand} kg`), h('td', {}, `${formatClock(d.window[0])}–${formatClock(d.window[1])}`),
            h('td', {}, p.routes.find((r) => r.stops.includes(d.id))?.vehicle.label || '—'))))))),
    );

    const layers = p.routes.map((r, i) => ({
      coords: r.geometry,
      color: COLORS[i],
      weight: st.focus === i ? 7 : 5,
      opacity: st.focus === null || st.focus === i ? 0.95 : 0.15,
      casing: st.focus === null || st.focus === i,
      onClick: () => { st.focus = i; update(); },
      tooltip: r.vehicle.label,
      i,
    }));
    if (st.focus !== null) layers.push(layers.splice(st.focus, 1)[0]);
    map.setRoutes(layers);

    const pins = [{ id: DEPOT, kind: 'depot', text: 'D', title: graph.node(DEPOT).name }];
    p.routes.forEach((r, i) => {
      if (st.focus !== null && st.focus !== i) return;
      r.stops.forEach((id, k) => {
        const d = deliveries.find((x) => x.id === id);
        pins.push({ id: d.node, kind: 'stop', text: k + 1, color: COLORS[i], title: `${k + 1}. ${d.customer} (${r.vehicle.label})` });
      });
    });
    map.setPins(pins);
    map.fit(st.focus === null ? p.routes.map((r) => r.geometry) : [p.routes[st.focus].geometry]);
  }

  update();
}
