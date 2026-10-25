// Demo fixtures for the robot's connection status (owner: status; src/shell/connection.mjs).
// Sorted first, so they answer every page:
//   demo-device-4  on MQTT (devices.js map) but unknown to the companion server: every companion
//                  call answers like manager-api does when xiaozhi-server says 404, so the pages
//                  show "সার্ভারে যুক্ত হচ্ছে" (waiting_companion)
//   demo-device-5  on MQTT and known, but its last sync is 25 minutes old (not_syncing)
// Every other device passes on to the page fixtures. Synthetic sample data only.
import { DEMO_COMPANION } from './zz-base.js';

const NOT_FOUND = { code: 500, msg: 'device not found', data: null };
const staleView = () => ({
  ...DEMO_COMPANION, id: '28:84:85:00:00:05', name: 'বসার ঘরের টাইনিবট', online: false,
  last_seen: Math.floor(Date.now() / 1000) - 25 * 60,
  stats: { ...DEMO_COMPANION.stats, activity: '' },
});

export default [
  ...['GET', 'PUT', 'POST'].map((method) => ({
    method, url: /\/device\/companion\/demo-device-4(\/.*)?$/, body: () => NOT_FOUND,
  })),
  { method: 'GET', url: /\/device\/companion\/demo-device-5$/, reply: staleView },
];
