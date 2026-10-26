-- TinyBot's own voice tools as plugins, so manager-api agents get them: with manager-api the
-- server takes an agent's function list from its plugin mappings only.
--   companion_robot: alarms, reminders, voice timers, routines, library, special days, commands
--   tinybot_home:    smart-home control and robot-to-robot messages
-- provider_code is the plugin module name; the server expands it to the module's functions.

INSERT IGNORE INTO ai_model_provider (id, model_type, provider_code, name, fields,
sort, creator, create_date, updater, update_date)
VALUES ('SYSTEM_PLUGIN_COMPANION', 'Plugin', 'companion_robot', 'TinyBot companion (alarms, reminders, routines)',
JSON_ARRAY(), 5, 0, NOW(), 0, NOW());

INSERT IGNORE INTO ai_model_provider (id, model_type, provider_code, name, fields,
sort, creator, create_date, updater, update_date)
VALUES ('SYSTEM_PLUGIN_TINYBOT_HOME', 'Plugin', 'tinybot_home', 'Smart home and robot messages',
JSON_ARRAY(), 6, 0, NOW(), 0, NOW());

-- every agent that exists now gets both
INSERT IGNORE INTO ai_agent_plugin_mapping (agent_id, plugin_id, param_info)
SELECT id, 'SYSTEM_PLUGIN_COMPANION', '{}' FROM ai_agent;

INSERT IGNORE INTO ai_agent_plugin_mapping (agent_id, plugin_id, param_info)
SELECT id, 'SYSTEM_PLUGIN_TINYBOT_HOME', '{}' FROM ai_agent;
