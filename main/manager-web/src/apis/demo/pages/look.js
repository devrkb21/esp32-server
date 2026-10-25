// Look (owner: web-look): demo fixtures for the face editor and "Live from TinyBot".
// Synthetic: the demo robot from zz-base.js. Saving a look keeps it for the session, and the live
// screen is drawn in the browser from the saved look with the same face code the preview uses
// (src/utils/faceLook.mjs), encoded as the JPEG the firmware's self.screen.preview tool returns.
import { DEMO_COMPANION } from './zz-base';
import { W, H, createCanvas, createLiveliness, normalizeLook, paintToContext, renderActivityFrame } from '@/utils/faceLook.mjs';

const state = { view: DEMO_COMPANION };

// Partial update as manager-api does it: settings merge key by key, the rest is replaced.
function applyPatch(patch) {
  const p = patch && typeof patch === 'object' ? patch : {};
  const next = { ...state.view, ...p, settings: { ...state.view.settings, ...(p.settings || {}) } };
  next.rev = (state.view.rev || 0) + 1;
  state.view = next;
  return next;
}

let live = null;
let frame = null;
let canvas = null;
const startedAt = Date.now();

function screenFrame() {
  if (typeof document === 'undefined') return null;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    frame = createCanvas();
    live = createLiveliness(Math.random, 0);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const t = Date.now() - startedAt;
  const activity = state.view.stats && state.view.stats.activity;
  renderActivityFrame(activity || 'newspaper', normalizeLook(state.view.settings.look), t, live, t, frame, 0);
  paintToContext(ctx, frame, 1, 'white', 'black');
  const jpeg = canvas.toDataURL('image/jpeg', 0.9).replace(/^data:image\/jpeg;base64,/, '');
  return { width: W, height: H, jpeg };
}

function onLookPage() {
  try { return /^#\/look(\?|$)/.test(window.location.hash); } catch (e) { return false; }
}

// A path pattern that only matches while the Look page is open.
class LookOnly extends RegExp {
  test(path) { return super.test(path) && onLookPage(); }
}

export default [
  { method: 'GET', url: new LookOnly('/device/companion/(?!geocode$)[^/]+$'), reply: () => state.view },
  { method: 'PUT', url: new LookOnly('/device/companion/[^/]+/config$'), reply: (req) => applyPatch(req.data) },
  {
    method: 'POST',
    url: /\/device\/tools\/call\/[^/]+$/,
    body: (req) => {
      const name = req.data && req.data.name;
      if (name !== 'self.screen.preview') return undefined; // other tools: the next fixture answers
      const shot = screenFrame();
      return shot ? { code: 0, msg: 'ok', data: shot } : { code: 500, msg: 'No screen', data: null };
    },
  },
];
