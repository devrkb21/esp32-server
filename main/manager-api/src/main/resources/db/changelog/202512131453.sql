-- Delete server module token auth parameter
delete from `sys_params` where param_code = 'server.auth.enabled';

-- Add parameter for whether server module enables token authentication
INSERT INTO `sys_params` (id, param_code, param_value, value_type, param_type, remark) VALUES 
(122, 'server.auth.enabled', 'true', 'boolean', 1, 'Whether server module enables token authentication');