// Binary min-heap used as the priority queue (frontier) for UCS, Greedy Best-First and A*.
export class MinHeap {
  constructor() {
    this.items = [];
    this.counter = 0; // tie-breaker keeps insertion order stable (FIFO among equal priorities)
  }

  get size() {
    return this.items.length;
  }

  push(value, priority) {
    this.items.push({ value, priority, order: this.counter++ });
    this.#up(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      this.#down(0);
    }
    return top.value;
  }

  #less(a, b) {
    const x = this.items[a];
    const y = this.items[b];
    return x.priority < y.priority || (x.priority === y.priority && x.order < y.order);
  }

  #swap(a, b) {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
  }

  #up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.#less(i, p)) break;
      this.#swap(i, p);
      i = p;
    }
  }

  #down(i) {
    const n = this.items.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < n && this.#less(l, m)) m = l;
      if (r < n && this.#less(r, m)) m = r;
      if (m === i) break;
      this.#swap(i, m);
      i = m;
    }
  }
}
