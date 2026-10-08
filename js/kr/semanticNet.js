// Semantic network (Module 3): concepts as nodes, labelled relations as edges.
// Supports is-a / instance-of inheritance, so a property stored once on "Van"
// is inherited by every refrigerated van instance.

const INHERIT = new Set(['is-a', 'instance-of']);

export class SemanticNet {
  constructor() {
    this.nodes = new Map(); // id -> { id, kind }
    this.links = []; // { from, rel, to }
  }

  addNode(id, kind = 'concept') {
    if (!this.nodes.has(id)) this.nodes.set(id, { id, kind });
    return this;
  }

  link(from, rel, to) {
    this.addNode(from);
    this.addNode(to);
    this.links.push({ from, rel, to });
    return this;
  }

  out(id, rel) {
    return this.links.filter((l) => l.from === id && (!rel || l.rel === rel));
  }

  /** Chain of ancestors through is-a / instance-of links, nearest first. */
  ancestors(id) {
    const seen = [];
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      for (const l of this.links) {
        if (l.from === cur && INHERIT.has(l.rel) && !seen.includes(l.to)) {
          seen.push(l.to);
          queue.push(l.to);
        }
      }
    }
    return seen;
  }

  isA(id, concept) {
    return id === concept || this.ancestors(id).includes(concept);
  }

  /**
   * Value of a relation for a node, inherited if not stored locally.
   * Returns { values, source, path } - path explains the inheritance chain.
   */
  lookup(id, rel) {
    const chain = [id, ...this.ancestors(id)];
    for (let i = 0; i < chain.length; i++) {
      const found = this.out(chain[i], rel);
      if (found.length) return { values: found.map((l) => l.to), source: chain[i], path: chain.slice(0, i + 1) };
    }
    return { values: [], source: null, path: chain };
  }

  /** Every relation a node has, own and inherited (own values override inherited ones). */
  describe(id) {
    const result = {};
    for (const n of [id, ...this.ancestors(id)]) {
      for (const l of this.out(n)) {
        if (INHERIT.has(l.rel)) continue;
        if (!(l.rel in result)) result[l.rel] = { values: [], source: n };
        if (result[l.rel].source === n) result[l.rel].values.push(l.to);
      }
    }
    return result;
  }
}

/** The domain semantic network for the logistics system. */
export function buildLogisticsNet(vehicles, deliveries, depotName) {
  const net = new SemanticNet();
  net.link('Van', 'is-a', 'Vehicle')
    .link('RefrigeratedVan', 'is-a', 'Van')
    .link('Truck', 'is-a', 'Vehicle')
    .link('Bike', 'is-a', 'Vehicle')
    .link('Vehicle', 'starts-at', 'Depot')
    .link('Vehicle', 'travels-on', 'Road')
    .link('Road', 'connects', 'Junction')
    .link('Depot', 'is-a', 'Junction')
    .link('DeliveryPoint', 'is-a', 'Junction')
    .link('Delivery', 'located-at', 'DeliveryPoint')
    .link('Delivery', 'served-by', 'Vehicle')
    .link('Van', 'can-carry', 'standard')
    .link('Van', 'can-carry', 'fragile')
    .link('Van', 'can-carry', 'documents')
    .link('RefrigeratedVan', 'can-carry', 'perishable')
    .link('RefrigeratedVan', 'can-carry', 'standard')
    .link('RefrigeratedVan', 'can-carry', 'fragile')
    .link('Truck', 'can-carry', 'bulk')
    .link('Truck', 'can-carry', 'standard')
    .link('Bike', 'can-carry', 'documents')
    .link('Truck', 'cannot-enter', 'narrow-lane market')
    .link('Vehicle', 'cannot-enter', 'none');
  for (const v of vehicles) net.addNode(v.id, 'instance').link(v.id, 'instance-of', v.type);
  net.addNode(depotName, 'instance').link(depotName, 'instance-of', 'Depot');
  for (const d of deliveries) net.addNode(d.id, 'instance').link(d.id, 'instance-of', 'Delivery');
  for (const kind of ['Vehicle', 'Van', 'RefrigeratedVan', 'Truck', 'Bike', 'Depot', 'Junction', 'Road', 'Delivery', 'DeliveryPoint']) {
    net.nodes.get(kind).kind = 'class';
  }
  return net;
}
