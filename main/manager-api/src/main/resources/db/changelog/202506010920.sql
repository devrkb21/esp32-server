-- VLLM model provider
delete from `ai_model_provider` where id = 'SYSTEM_VLLM_openai';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_VLLM_openai', 'VLLM', 'openai', 'OpenAI API', '[{"key":"base_url","label":"Base URL","type":"string"},{"key":"model_name","label":"Model name","type":"string"},{"key":"api_key","label":"API Key","type":"string"}]', 9, 1, NOW(), 1, NOW());

-- VLLM model configuration
delete from `ai_model_config` where id = 'VLLM_ChatGLMVLLM';
INSERT INTO `ai_model_config` VALUES ('VLLM_ChatGLMVLLM', 'VLLM', 'ChatGLMVLLM', 'Zhipu VisionAI', 1, 1, '{\"type\": \"openai\", \"model_name\": \"glm-4v-flash\", \"base_url\": \"https://open.bigmodel.cn/api/paas/v4/\", \"api_key\": \"Yourapi_key\"}', NULL, NULL, 1, NULL, NULL, NULL, NULL);

-- Update documentation
UPDATE `ai_model_config` SET 
`doc_link` = 'https://bigmodel.cn/usercenter/proj-mgmt/apikeys',
`remark` = 'Zhipu VisionAIConfiguration Instructions:
1. Visit https://bigmodel.cn/usercenter/proj-mgmt/apikeys
2. Register andObtain API Key
3. Fill into the configuration file' WHERE `id` = 'VLLM_ChatGLMVLLM';


-- Add parameters
INSERT INTO `sys_params` (id, param_code, param_value, value_type, param_type, remark) VALUES (113, 'server.http_port', '8003', 'number', 1, 'HTTP service port for vision analysis interface');
INSERT INTO `sys_params` (id, param_code, param_value, value_type, param_type, remark) VALUES (114, 'server.vision_explain', 'null', 'string', 1, 'Vision analysis interface URL sent to device, separated by semicolon');

-- Add VLLM model configuration to agent table
ALTER TABLE `ai_agent` 
ADD COLUMN `vllm_model_id` varchar(32) NULL DEFAULT 'VLLM_ChatGLMVLLM' COMMENT 'Vision model identifier' AFTER `llm_model_id`;

-- Add VLLM model configuration to agent template table
ALTER TABLE `ai_agent_template` 
ADD COLUMN `vllm_model_id` varchar(32) NULL DEFAULT 'VLLM_ChatGLMVLLM' COMMENT 'Vision model identifier' AFTER `llm_model_id`;