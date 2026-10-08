// Frame-based knowledge representation (Module 3).
// A frame has slots; each slot may hold a value, a default, an if-needed procedure
// (computed on demand) or an if-added demon (fires when a value is stored).
// Frames inherit slots from their parent through the is-a link.

export class FrameSystem {
  constructor() {
    this.frames = new Map();
    this.log = [];
  }

  define(name, { isA = null, slots = {} } = {}) {
    this.frames.set(name, { name, isA, slots: { ...slots }, values: {}, instance: false });
    return this;
  }

  instance(name, isA, values = {}) {
    this.frames.set(name, { name, isA, slots: {}, values: {}, instance: true });
    for (const [k, v] of Object.entries(values)) this.set(name, k, v);
    return this;
  }

  chain(name) {
    const out = [];
    for (let f = this.frames.get(name); f; f = this.frames.get(f.isA)) out.push(f);
    return out;
  }

  /** Slot facet lookup: own value -> if-needed -> inherited value -> default. */
  get(name, slot) {
    return this.resolve(name, slot).value;
  }

  resolve(name, slot) {
    const chain = this.chain(name);
    if (!chain.length) throw new Error(`Unknown frame ${name}`);
    if (slot in chain[0].values) return { value: chain[0].values[slot], source: name, facet: 'value' };
    for (const f of chain) {
      const def = f.slots[slot];
      if (def?.ifNeeded) return { value: def.ifNeeded(this, name), source: f.name, facet: 'if-needed' };
      if (f !== chain[0] && slot in f.values) return { value: f.values[slot], source: f.name, facet: 'inherited value' };
      if (def && 'default' in def) return { value: def.default, source: f.name, facet: 'default' };
    }
    return { value: undefined, source: null, facet: 'missing' };
  }

  set(name, slot, value) {
    const f = this.frames.get(name);
    f.values[slot] = value;
    for (const fr of this.chain(name)) {
      const demon = fr.slots[slot]?.ifAdded;
      if (demon) {
        const msg = demon(this, name, value);
        if (msg) this.log.push(msg);
        break;
      }
    }
  }

  /** All slots visible on a frame with the facet that supplied each value. */
  describe(name) {
    const slots = new Set();
    for (const f of this.chain(name)) {
      Object.keys(f.slots).forEach((s) => slots.add(s));
      Object.keys(f.values).forEach((s) => slots.add(s));
    }
    return [...slots].map((slot) => ({ slot, ...this.resolve(name, slot) }));
  }

  instancesOf(cls) {
    return [...this.frames.values()].filter((f) => f.instance && this.chain(f.name).some((c) => c.name === cls)).map((f) => f.name);
  }
}

/** Builds the vehicle and delivery frames used by the planner. */
export function buildLogisticsFrames(vehicles, deliveries) {
  const fs = new FrameSystem();
  fs.define('Vehicle', {
    slots: {
      capacity: { default: 300 },
      speedFactor: { default: 1.0 },
      refrigerated: { default: false },
      fuelType: { default: 'diesel' },
      fuelPerKm: { default: 0.1 },
      baseFare: { default: 80 },
      farePerKm: { default: 16 },
      farePerMin: { default: 1.5 },
      currentLoad: {
        default: 0,
        ifAdded: (sys, name, value) =>
          value > sys.get(name, 'capacity') ? `${name}: load ${value} kg exceeds capacity ${sys.get(name, 'capacity')} kg` : null,
      },
      remainingCapacity: { ifNeeded: (sys, name) => sys.get(name, 'capacity') - sys.get(name, 'currentLoad') },
    },
  });
  fs.define('Van', { isA: 'Vehicle', slots: { capacity: { default: 300 }, fuelPerKm: { default: 0.09 } } });
  fs.define('RefrigeratedVan', {
    isA: 'Van',
    slots: { capacity: { default: 250 }, refrigerated: { default: true }, fuelPerKm: { default: 0.11 }, baseFare: { default: 120 }, farePerKm: { default: 20 }, farePerMin: { default: 2 } },
  });
  fs.define('Truck', {
    isA: 'Vehicle',
    slots: { capacity: { default: 800 }, speedFactor: { default: 0.8 }, fuelPerKm: { default: 0.2 }, baseFare: { default: 250 }, farePerKm: { default: 28 }, farePerMin: { default: 2.5 } },
  });
  fs.define('Bike', {
    isA: 'Vehicle',
    slots: { capacity: { default: 20 }, speedFactor: { default: 1.2 }, fuelType: { default: 'petrol' }, fuelPerKm: { default: 0.025 }, baseFare: { default: 20 }, farePerKm: { default: 8 }, farePerMin: { default: 0.5 } },
  });

  fs.define('Delivery', {
    slots: {
      priority: { default: 'normal' },
      window: { default: [0, 540] },
      item: { default: 'standard' },
      demand: { default: 10 },
    },
  });

  for (const v of vehicles) fs.instance(v.id, v.type, v.overrides || {});
  for (const d of deliveries) {
    const { id, ...slots } = d;
    fs.instance(id, 'Delivery', slots);
  }
  return fs;
}
