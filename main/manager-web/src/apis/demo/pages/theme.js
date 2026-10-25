// Demo fixtures of the Wake word & theme page (owner: web-theme). The robot's tools answer as a
// TinyBot on the TinyBot 4 MB layout would (assets partition 0x100000), so the page shows a
// reachable robot with its chip and screen. Synthetic values only.
//
// POST /device/tools/call/<id> is also matched by look.js, which sorts first and so answers every
// tool call. `themeTool` is exported for it: look.js can answer these tool names from here and
// keep self.screen.preview for itself (shared change request of web-theme).
const ok = (data) => ({ code: 0, msg: 'ok', data });

const SYSTEM_INFO = {
  chip_model_name: 'esp32s3',
  flash_size: 4194304,
  board: { type: 'tinybot', name: 'tinybot' },
  partition_table: [
    { label: 'nvs', size: 16384 },
    { label: 'ota_0', size: 3014656 },
    { label: 'assets', size: 1048576 },
  ],
};

const TOOLS = {
  'self.get_device_status': () => ({ audio_speaker: { volume: 60 }, network: { type: 'wifi', signal: 'strong' } }),
  'self.get_system_info': () => SYSTEM_INFO,
  'self.screen.get_info': () => '{"width":128,"height":64,"monochrome":true}',
  'self.assets.set_download_url': () => true,
  'self.reboot': () => true,
};

/** The whole reply body for one of the theme page's tool calls, or null for another tool. */
export function themeTool(name, args = {}) {
  const tool = TOOLS[name];
  return tool ? ok(tool(args)) : null;
}

export default [
  {
    method: 'POST', url: /\/device\/tools\/call\/[^/]+$/, body: (req) => {
      const name = req.data && req.data.name;
      return themeTool(name, (req.data && req.data.arguments) || {}) || ok(null);
    },
  },
  // Api.ota.uploadAssetsBin posts with fetch, outside the demo layer; kept for when it routes here.
  { method: 'POST', url: /\/otaMag\/uploadAssetsBin$/, reply: () => `/xiaozhi/otaMag/download/demo-${Date.now().toString(36)}` },
];
