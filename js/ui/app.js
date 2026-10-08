import { buildWorld } from '../planner.js';
import { renderRoute } from './routeView.js';
import { renderDeliveries } from './deliveriesView.js';
import { renderLearn } from './learnView.js';

const VIEWS = { route: renderRoute, deliveries: renderDeliveries, how: renderLearn };

const world = buildWorld();
const rendered = new Set();

function go(view) {
  if (!VIEWS[view]) view = 'route';
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
  document.querySelectorAll('section.view').forEach((s) => s.classList.toggle('active', s.id === `view-${view}`));
  document.body.dataset.view = view;
  if (!rendered.has(view)) {
    rendered.add(view);
    const root = document.getElementById(`view-${view}`);
    try {
      VIEWS[view](root, { world, go });
    } catch (e) {
      root.textContent = `Something went wrong: ${e.message}`;
      console.error(e);
    }
  }
}

window.addEventListener('hashchange', () => go(location.hash.slice(1)));
go(location.hash.slice(1));
