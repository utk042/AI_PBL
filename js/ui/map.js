// SVG road-network map shared by the planner, search lab and TSP views.

import { s, h } from './dom.js';

export const VEHICLE_COLORS = ['#2357d9', '#d9480f', '#1b8a5a', '#9c36b5', '#c2255c', '#0b7285'];
const SCALE = 1; // graph is already in km; viewBox handles scaling

export function drawMap(graph, { deliveries = [], routes = [], highlight = null, explored = [], labels = 'deliveries' } = {}) {
  const xs = [...graph.nodes.values()].map((n) => n.x);
  const ys = [...graph.nodes.values()].map((n) => n.y);
  const pad = 1;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - minX + pad;
  const hgt = Math.max(...ys) - minY + pad;
  const svg = s('svg', { class: 'map', viewBox: `${minX} ${minY} ${w} ${hgt}`, role: 'img', 'aria-label': 'Road network map' });

  for (const e of graph.edges) {
    const a = graph.node(e.from);
    const b = graph.node(e.to);
    svg.append(s('line', { class: `road ${e.type}`, x1: a.x * SCALE, y1: a.y, x2: b.x, y2: b.y }));
  }

  const exploredSet = new Set(explored);
  for (const id of exploredSet) {
    const n = graph.node(id);
    svg.append(s('circle', { class: 'explored', cx: n.x, cy: n.y, r: 0.42 }));
  }

  routes.forEach((r, i) => {
    const color = r.color || VEHICLE_COLORS[i % VEHICLE_COLORS.length];
    const offset = (i - (routes.length - 1) / 2) * 0.09; // keeps overlapping routes visible
    const pts = r.path.map((id) => {
      const n = graph.node(id);
      return `${n.x + offset},${n.y + offset}`;
    });
    svg.append(s('polyline', { class: 'route', points: pts.join(' '), stroke: color, 'stroke-dasharray': r.dashed ? '0.25 0.18' : null }));
  });

  const deliveryAt = new Map();
  for (const d of deliveries) deliveryAt.set(d.node, [...(deliveryAt.get(d.node) || []), d.id]);

  for (const n of graph.nodes.values()) {
    const ds = deliveryAt.get(n.id);
    const g = s('g', { class: `node ${n.depot ? 'depot' : ''} ${ds ? 'delivery' : ''}` });
    g.append(s('title', {}, `${n.id} · ${n.name} (${n.zone})${ds ? ` · ${ds.join(', ')}` : ''}`));
    if (n.depot) {
      g.append(s('rect', { x: n.x - 0.28, y: n.y - 0.28, width: 0.56, height: 0.56, rx: 0.08 }));
    } else {
      const hl = highlight && (highlight.start === n.id || highlight.goal === n.id);
      g.append(s('circle', { cx: n.x, cy: n.y, r: ds || hl ? 0.24 : 0.15, style: hl ? 'stroke: var(--bad); stroke-width: 0.1' : null }));
    }
    const text = n.depot ? 'DEPOT' : ds && labels === 'deliveries' ? ds.join('/') : labels === 'all' ? n.id : null;
    if (text) svg.append(g, s('text', { class: 'lbl', x: n.x + 0.32, y: n.y - 0.25 }, text));
    else svg.append(g);
    if (labels === 'names') svg.append(s('text', { x: n.x + 0.3, y: n.y + 0.5 }, n.name.split(' (')[0]));
  }
  return svg;
}

export function legend(items) {
  return h('div', { class: 'legend' }, items.map(([label, color]) => h('span', { style: `--c:${color}` }, label)));
}
