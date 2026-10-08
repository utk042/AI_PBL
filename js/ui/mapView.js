// Map component. Uses Leaflet with OpenStreetMap tiles when available and falls back
// to a plain SVG drawing of the road network when the map library cannot load (offline).

import { s, h } from './dom.js';

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const COLORS = ['#1a73e8', '#e8710a', '#188038', '#a142f4', '#d93025', '#12b5cb'];

export function createMap(container, graph) {
  return typeof window !== 'undefined' && window.L ? new LeafletMap(container, graph) : new SvgMap(container, graph);
}

function pinHtml(p) {
  return `<div class="pin pin-${p.kind}" style="${p.color ? `--pin:${p.color}` : ''}">${p.text ?? ''}</div>`;
}

class LeafletMap {
  constructor(container, graph) {
    const L = window.L;
    this.graph = graph;
    this.map = L.map(container, { zoomControl: true, attributionControl: true });
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19, className: 'base-tiles' }).addTo(this.map);
    this.routeLayer = L.layerGroup().addTo(this.map);
    this.placeLayer = L.layerGroup().addTo(this.map);
    this.pinLayer = L.layerGroup().addTo(this.map);
    this.fitPlaces();
    // The container may be hidden or resized when the view is first shown.
    this.container = container;
    new ResizeObserver(() => {
      this.map.invalidateSize();
      if (this.pendingFit && container.clientWidth) {
        this.fit(this.pendingFit);
      }
    }).observe(container);
  }

  fitPlaces() {
    this.map.fitBounds([...this.graph.nodes.values()].map((n) => [n.lat, n.lng]), { padding: [20, 20] });
  }

  /** Small markers for every place. actions = [[label, fn(id)]] shown in the popup. */
  showPlaces({ actions = [], hide = new Set() } = {}) {
    const L = window.L;
    this.placeLayer.clearLayers();
    for (const n of this.graph.nodes.values()) {
      if (hide.has(n.id)) continue;
      const m = L.circleMarker([n.lat, n.lng], { radius: 5, weight: 2, color: '#5f6368', fillColor: '#fff', fillOpacity: 1 });
      m.bindTooltip(n.name, { direction: 'top', offset: [0, -4] });
      if (actions.length) {
        const box = h('div', { class: 'popup' }, h('b', {}, n.name), h('div', { class: 'popup-zone' }, n.zone),
          h('div', { class: 'popup-actions' }, actions.map(([label, fn]) => h('button', { class: 'btn small', onclick: () => { this.map.closePopup(); fn(n.id); } }, label))));
        m.bindPopup(box);
      }
      m.addTo(this.placeLayer);
    }
  }

  /** routes = [{ coords, color, weight, opacity, dashed, onClick, tooltip }] drawn in order (last on top). */
  setRoutes(routes) {
    const L = window.L;
    this.routeLayer.clearLayers();
    for (const r of routes) {
      if (r.casing !== false) {
        L.polyline(r.coords, { color: '#ffffff', weight: (r.weight || 5) + 3, opacity: r.opacity ?? 0.9, interactive: false }).addTo(this.routeLayer);
      }
      const line = L.polyline(r.coords, { color: r.color, weight: r.weight || 5, opacity: r.opacity ?? 0.95, dashArray: r.dashed ? '6 8' : null, lineJoin: 'round' });
      if (r.tooltip) line.bindTooltip(r.tooltip, { sticky: true });
      if (r.onClick) line.on('click', r.onClick);
      line.addTo(this.routeLayer);
    }
  }

  /** pins = [{ id, kind: 'start'|'end'|'depot'|'stop'|'explored', text, color, title }] */
  setPins(pins) {
    const L = window.L;
    this.pinLayer.clearLayers();
    for (const p of pins) {
      const n = this.graph.node(p.id);
      const icon = L.divIcon({ className: '', html: pinHtml(p), iconSize: null });
      const m = L.marker([n.lat, n.lng], { icon, title: p.title || n.name, zIndexOffset: p.kind === 'explored' ? 0 : 500 });
      m.bindTooltip(p.title || n.name, { direction: 'top', offset: [0, -10] });
      m.addTo(this.pinLayer);
    }
  }

  fit(coordLists) {
    const pts = coordLists.flat();
    if (!pts.length) return;
    if (!this.container.clientWidth) {
      this.pendingFit = coordLists; // not visible yet; fit once it has a size
      return;
    }
    this.pendingFit = null;
    this.map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
  }

  focus(id) {
    const n = this.graph.node(id);
    this.map.setView([n.lat, n.lng], Math.max(this.map.getZoom(), 15));
  }
}

// ------------------------------------------------------------------ SVG fallback
class SvgMap {
  constructor(container, graph) {
    this.graph = graph;
    const lats = [...graph.nodes.values()].map((n) => n.lat);
    const lngs = [...graph.nodes.values()].map((n) => n.lng);
    this.box = { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) };
    this.k = Math.cos((this.box.minLat * Math.PI) / 180);
    const w = (this.box.maxLng - this.box.minLng) * this.k;
    const hh = this.box.maxLat - this.box.minLat;
    const pad = 0.004;
    this.svg = s('svg', { class: 'svg-map', viewBox: `${-pad} ${-pad} ${w + 2 * pad} ${hh + 2 * pad}`, preserveAspectRatio: 'xMidYMid meet' });
    this.roads = s('g');
    this.routes = s('g');
    this.places = s('g');
    this.pins = s('g');
    this.svg.append(this.roads, this.routes, this.places, this.pins);
    container.append(this.svg, h('div', { class: 'map-note' }, 'Map tiles could not load. Showing a simple drawing of the roads.'));
    for (const e of graph.edges) this.roads.append(s('polyline', { points: this.pts(e.geometry), class: 'svg-road' }));
  }

  xy([lat, lng]) {
    return [(lng - this.box.minLng) * this.k, this.box.maxLat - lat];
  }

  pts(coords) {
    return coords.map((c) => this.xy(c).join(',')).join(' ');
  }

  showPlaces() {
    this.places.replaceChildren(...[...this.graph.nodes.values()].map((n) => {
      const [x, y] = this.xy([n.lat, n.lng]);
      return s('circle', { cx: x, cy: y, r: 0.0009, class: 'svg-place' }, s('title', {}, n.name));
    }));
  }

  setRoutes(routes) {
    this.routes.replaceChildren(...routes.map((r) => {
      const line = s('polyline', { points: this.pts(r.coords), stroke: r.color, 'stroke-width': (r.weight || 5) * 0.00018, opacity: r.opacity ?? 0.95, fill: 'none', 'stroke-linejoin': 'round', 'stroke-dasharray': r.dashed ? '0.001 0.0012' : null });
      if (r.onClick) line.addEventListener('click', r.onClick);
      return line;
    }));
  }

  setPins(pins) {
    this.pins.replaceChildren(...pins.map((p) => {
      const n = this.graph.node(p.id);
      const [x, y] = this.xy([n.lat, n.lng]);
      return s('g', {},
        s('circle', { cx: x, cy: y, r: p.kind === 'explored' ? 0.0012 : 0.0018, fill: p.color || (p.kind === 'start' ? '#188038' : p.kind === 'end' ? '#d93025' : '#202124'), opacity: p.kind === 'explored' ? 0.4 : 1 }),
        p.text ? s('text', { x, y: y + 0.0006, 'text-anchor': 'middle', 'font-size': 0.0016, fill: '#fff', 'font-weight': 700 }, p.text) : null,
        s('title', {}, p.title || n.name));
    }));
  }

  fit() {}
  focus() {}
}
