import { buildWorld } from '../planner.js';
import { renderOverview } from './overview.js';
import { renderPlanner } from './plannerView.js';
import { renderSearch } from './searchView.js';
import { renderProblems } from './problemsView.js';
import { renderKB } from './kbView.js';
import { renderExpert } from './expertView.js';

const VIEWS = {
  overview: renderOverview,
  planner: renderPlanner,
  search: renderSearch,
  problems: renderProblems,
  kb: renderKB,
  expert: renderExpert,
};

const world = buildWorld();
const rendered = new Set();

function go(view) {
  if (!VIEWS[view]) view = 'overview';
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('section.view').forEach((s) => s.classList.toggle('active', s.id === `view-${view}`));
  if (!rendered.has(view)) {
    rendered.add(view);
    const root = document.getElementById(`view-${view}`);
    try {
      VIEWS[view](root, { world, go });
    } catch (e) {
      root.textContent = `Failed to render: ${e.message}`;
      console.error(e);
    }
  }
  if (location.hash.slice(1) !== view) history.replaceState(null, '', `#${view}`);
  window.scrollTo({ top: 0 });
}

document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-view]');
  if (b) go(b.dataset.view);
});

document.getElementById('theme-toggle').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch { /* storage unavailable */ }
});

try {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.dataset.theme = saved;
} catch { /* storage unavailable */ }

window.addEventListener('hashchange', () => go(location.hash.slice(1)));
go(location.hash.slice(1) || 'overview');
