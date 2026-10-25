// Demo fixtures of the system pages (owner: web-system): every call of Parameters, Dictionaries,
// Features and Server. Synthetic values only: secrets are obvious placeholders, addresses come
// from the documentation range 192.0.2.0/24, and changes live in memory until the page reloads.

const MENU = {
  features: {
    voiceprintRecognition: { name: 'feature.voiceprintRecognition.name', enabled: true, description: 'feature.voiceprintRecognition.description' },
    voiceClone: { name: 'feature.voiceClone.name', enabled: false, description: 'feature.voiceClone.description' },
    knowledgeBase: { name: 'feature.knowledgeBase.name', enabled: true, description: 'feature.knowledgeBase.description' },
    mcpAccessPoint: { name: 'feature.mcpAccessPoint.name', enabled: false, description: 'feature.mcpAccessPoint.description' },
    addressBook: { name: 'feature.addressBook.name', enabled: true, description: 'feature.addressBook.description' },
    vad: { name: 'feature.vad.name', enabled: true, description: 'feature.vad.description' },
    asr: { name: 'feature.asr.name', enabled: true, description: 'feature.asr.description' },
  },
  groups: {
    featureManagement: ['voiceprintRecognition', 'voiceClone', 'knowledgeBase', 'mcpAccessPoint', 'addressBook'],
    voiceManagement: ['vad', 'asr'],
  },
};

let nextParamId = 900;
const params = [
  [101, 'server.secret', 'demo-secret-0000-0000-0000', 'string', 'Shared secret between the console and the voice server'],
  [102, 'server.websocket', 'ws://192.0.2.10:8000/xiaozhi/v1/;ws://192.0.2.11:8000/xiaozhi/v1/', 'array', 'WebSocket addresses handed to robots'],
  [103, 'server.ota', 'http://192.0.2.10:8002/xiaozhi/ota/', 'string', 'Firmware check address'],
  [104, 'server.fronted_url', 'http://192.0.2.10:8001', 'string', 'Console address'],
  [105, 'server.mqtt_gateway', '192.0.2.12:1883', 'string', 'MQTT gateway'],
  [106, 'server.mqtt_signature_key', 'demo-signature-key', 'string', 'Signs MQTT client credentials'],
  [107, 'server.udp_gateway', '192.0.2.12:8884', 'string', 'Audio relay for MQTT robots'],
  [108, 'server.allowed_devices', '', 'array', 'Devices allowed without binding (empty: none)'],
  [109, 'server.auth.enabled', 'false', 'boolean', 'Require a token from robots'],
  [110, 'server.auth.expire_seconds', '2592000', 'number', 'Token lifetime in seconds'],
  [111, 'server.connection.close_no_voice_seconds', '120', 'number', 'Close a quiet connection after this long'],
  [112, 'server.connection.max_per_device', '1', 'number', 'Connections one robot may hold'],
  [113, 'server.registry.heartbeat_seconds', '30', 'number', 'How often a server reports in'],
  [114, 'server.resilience.retry_count', '3', 'number', 'Retries for a failed provider call'],
  [115, 'server.metrics.enabled', 'true', 'boolean', 'Expose server metrics'],
  [116, 'server.tracing.sample_rate', '0.1', 'number', 'Share of requests traced'],
  [117, 'server.sms_max_send_count', '10', 'number', 'Max daily SMS messages per phone number'],
  [118, 'server.enable_mobile_register', 'true', 'boolean', 'Whether to enable mobile phone registration'],
  // SMS gateway (REVE SMS): synthetic placeholders, never real keys.
  [620, 'reve.sms.base_url', 'https://smpp.revesms.com:7790', 'string', 'REVE SMS gateway address'],
  [621, 'reve.sms.api_key', 'demo-reve-api-key-0000', 'string', 'REVE SMS API key'],
  [622, 'reve.sms.secret_key', 'demo-reve-secret-0000', 'string', 'REVE SMS secret key'],
  [623, 'reve.sms.caller_id', 'TINYBOT', 'string', 'REVE SMS sender ID (callerID)'],
  [624, 'reve.sms.code_message', 'আপনার টাইনিবট যাচাই কোড {code}। কোডটি কাউকে জানাবেন না।', 'string', 'Verification SMS text; {code} is the code'],
  [201, 'plugins.get_weather.api_key', 'demo-weather-key-0000', 'string', 'Weather service key'],
  [202, 'plugins.get_weather.default_location', 'Dhaka', 'string', 'City used when none is said'],
  [203, 'plugins.get_news.default_rss_url', 'https://example.com/rss.xml', 'string', 'News feed'],
  [204, 'plugins.home_assistant.base_url', 'http://192.0.2.20:8123', 'string', 'Home Assistant address'],
  [205, 'plugins.home_assistant.access_token', 'demo-ha-token-0000', 'string', 'Home Assistant token'],
  [206, 'plugins.home_assistant.devices', 'Living room,light,switch.demo_light;Desk,fan,switch.demo_fan', 'array', 'Devices the agent may control'],
  [301, 'log.log_level', 'INFO', 'string', 'Server log level'],
  [302, 'log.log_dir', 'tmp', 'string', 'Folder for log files'],
  [303, 'log.data_dir', 'data', 'string', 'Folder for data files'],
  [401, 'session_state.ttl_seconds', '1800', 'number', 'Keep a conversation this long after it ends'],
  [402, 'session_state.max_turns', '20', 'number', 'Turns kept per conversation'],
  [501, 'enable_greeting', 'true', 'boolean', 'Greet when a conversation starts'],
  [502, 'wakeup_words', 'hello tinybot;hey tinybot', 'array', 'Words that wake the robot'],
  [503, 'exit_commands', 'bye;goodbye;that is all', 'array', 'Phrases that end a conversation'],
  [504, 'delete_audio', 'true', 'boolean', 'Delete recordings after use'],
  [600, 'system-web.menu', JSON.stringify(MENU), 'json', 'System Feature Menu Configuration'],
].map(([id, paramCode, paramValue, valueType, remark]) => ({ id, paramCode, paramValue, valueType, remark }));

let nextTypeId = 20;
let nextDataId = 500;
const types = [
  { id: 1, dictName: 'Firmware type', dictType: 'FIRMWARE_TYPE' },
  { id: 2, dictName: 'Model type', dictType: 'MODEL_TYPE' },
  { id: 3, dictName: 'Mobile area code', dictType: 'MOBILE_AREA' },
  { id: 4, dictName: 'Reminder kind', dictType: 'REMINDER_KIND' },
];
const data = [
  [1, 'TinyBot', 'tinybot', 1], [1, 'ESP32-S3 DevKit', 'esp32-s3-devkitc', 2], [1, 'Generic Wi-Fi board', 'bread-compact-wifi', 3],
  [2, 'Language model (LLM)', 'LLM', 1], [2, 'Text to speech (TTS)', 'TTS', 2], [2, 'Speech recognition (ASR)', 'ASR', 3],
  [2, 'Voice activity (VAD)', 'VAD', 4], [2, 'Intent', 'Intent', 5], [2, 'Memory', 'Memory', 6],
  [3, 'Bangladesh', '+880', 1], [3, 'India', '+91', 2], [3, 'United Kingdom', '+44', 3], [3, 'United States', '+1', 4],
  [3, 'Saudi Arabia', '+966', 5], [3, 'UAE', '+971', 6], [3, 'Malaysia', '+60', 7], [3, 'Singapore', '+65', 8],
  [3, 'Qatar', '+974', 9], [3, 'Kuwait', '+965', 10], [3, 'Oman', '+968', 11], [3, 'Italy', '+39', 12],
  [4, 'Water', 'water', 1], [4, 'Medicine', 'medicine', 2], [4, 'Custom', 'custom', 3],
].map(([dictTypeId, dictLabel, dictValue, sort], i) => ({ id: 300 + i, dictTypeId, dictLabel, dictValue, sort }));

const servers = ['ws://192.0.2.10:8000/xiaozhi/v1/', 'ws://192.0.2.11:8000/xiaozhi/v1/'];

const has = (v, q) => String(v || '').toLowerCase().includes(String(q || '').trim().toLowerCase());
const page = (list, req) => {
  const p = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Number(req.query.limit) || 10);
  return { total: list.length, list: list.slice((p - 1) * limit, p * limit).map((x) => ({ ...x })) };
};
const ids = (req) => (Array.isArray(req.data) ? req.data.map(Number) : []);
const remove = (list, gone) => { for (let i = list.length - 1; i >= 0; i -= 1) if (gone.includes(Number(list[i].id))) list.splice(i, 1); };

export default [
  // Parameters
  {
    method: 'GET',
    url: /\/admin\/params\/page$/,
    reply: (req) => page(params.filter((p) => has(p.paramCode, req.query.paramCode)), req),
  },
  {
    method: 'POST',
    url: /\/admin\/params$/,
    body: (req) => {
      const d = req.data || {};
      if (params.some((p) => p.paramCode === d.paramCode)) return { code: 10000, msg: 'This parameter code already exists', data: null };
      params.push({ ...d, id: (nextParamId += 1) });
      return { code: 0, msg: 'ok', data: null };
    },
  },
  {
    method: 'PUT',
    url: /\/admin\/params$/,
    body: (req) => {
      const d = req.data || {};
      // The server's guard: mobile sign-up stays off while the SMS gateway is incomplete.
      if (d.paramCode === 'server.enable_mobile_register' && String(d.paramValue).toLowerCase() !== 'false') {
        const need = ['server.sms_max_send_count', 'reve.sms.base_url', 'reve.sms.api_key', 'reve.sms.secret_key', 'reve.sms.caller_id'];
        const empty = need.filter((c) => !String((params.find((x) => x.paramCode === c) || {}).paramValue || '').trim());
        if (empty.length) return { code: 10000, msg: `${empty.join(',')}These parameters cannot be empty`, data: null };
      }
      const p = params.find((x) => Number(x.id) === Number(d.id));
      if (p) Object.assign(p, d);
      return { code: 0, msg: 'ok', data: null };
    },
  },
  { method: 'POST', url: /\/admin\/params\/delete$/, reply: (req) => { remove(params, ids(req)); return null; } },

  // Server
  { method: 'GET', url: /\/admin\/server\/server-list$/, reply: () => servers.slice() },
  { method: 'POST', url: /\/admin\/server\/emit-action$/, reply: () => true },

  // Dictionaries
  {
    method: 'GET',
    url: /\/admin\/dict\/type\/page$/,
    reply: (req) => page(types.filter((t) => has(t.dictName, req.query.dictName) && has(t.dictType, req.query.dictType)), req),
  },
  { method: 'POST', url: /\/admin\/dict\/type\/save$/, reply: (req) => { types.push({ ...req.data, id: (nextTypeId += 1) }); return null; } },
  {
    method: 'PUT',
    url: /\/admin\/dict\/type\/update$/,
    reply: (req) => { const t = types.find((x) => Number(x.id) === Number(req.data?.id)); if (t) Object.assign(t, req.data); return null; },
  },
  {
    method: 'POST',
    url: /\/admin\/dict\/type\/delete$/,
    reply: (req) => {
      const gone = ids(req);
      remove(types, gone);
      for (let i = data.length - 1; i >= 0; i -= 1) if (gone.includes(Number(data[i].dictTypeId))) data.splice(i, 1);
      return null;
    },
  },
  {
    method: 'GET',
    url: /\/admin\/dict\/data\/page$/,
    reply: (req) => page(data
      .filter((d) => Number(d.dictTypeId) === Number(req.query.dictTypeId) && has(d.dictLabel, req.query.dictLabel) && has(d.dictValue, req.query.dictValue))
      .sort((a, b) => a.sort - b.sort), req),
  },
  { method: 'POST', url: /\/admin\/dict\/data\/save$/, reply: (req) => { data.push({ ...req.data, id: (nextDataId += 1) }); return null; } },
  {
    method: 'PUT',
    url: /\/admin\/dict\/data\/update$/,
    reply: (req) => { const d = data.find((x) => Number(x.id) === Number(req.data?.id)); if (d) Object.assign(d, req.data); return null; },
  },
  { method: 'POST', url: /\/admin\/dict\/data\/delete$/, reply: (req) => { remove(data, ids(req)); return null; } },
];
