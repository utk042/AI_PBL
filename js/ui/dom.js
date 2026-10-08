// Small DOM helpers so views can be written declaratively without a framework.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

export const card = (title, sub, ...body) => h('div', { class: 'card' }, title && h('h2', {}, title), sub && h('p', { class: 'sub' }, sub), ...body);

export const stat = (value, label) => h('div', { class: 'stat' }, h('div', { class: 'v' }, value), h('div', { class: 'l' }, label));

export function table(headers, rows, { numeric = [], onRowClick } = {}) {
  return h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      {},
      h('thead', {}, h('tr', {}, headers.map((x, i) => h('th', { class: numeric.includes(i) ? 'num' : '' }, x)))),
      h(
        'tbody',
        {},
        rows.map((r, ri) =>
          h(
            'tr',
            { class: onRowClick ? 'click' : '', onclick: onRowClick ? (e) => onRowClick(ri, e.currentTarget) : null },
            r.map((c, i) => h('td', { class: numeric.includes(i) ? 'num' : '' }, c)),
          ),
        ),
      ),
    ),
  );
}

export const pill = (text, kind = '') => h('span', { class: `pill ${kind}` }, text);

export function select(options, value, onchange) {
  return h(
    'select',
    { onchange: (e) => onchange(e.target.value) },
    options.map(([v, label]) => h('option', { value: v, selected: v === value ? true : null }, label)),
  );
}

export const field = (label, control) => h('label', {}, label, control);

export function subtabs(items, onPick) {
  const bar = h('div', { class: 'subtabs' });
  items.forEach(([id, label], i) => {
    const b = h('button', { class: i === 0 ? 'active' : '', onclick: () => {
      bar.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      onPick(id);
    } }, label);
    bar.append(b);
  });
  return bar;
}

export const fmt = (v, d = 1) => (Number.isFinite(v) ? Number(v).toFixed(d) : '-');
