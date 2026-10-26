-- AI wave (LLM fallback, usage metering and quotas, kids mode).

-- 1. Fallback chains: comma lists of model ids tried in order when the agent's model fails
--    (timeout, 429, 5xx, auth). 'null' or empty: no fallback.
INSERT INTO `sys_params` (`id`, `param_code`, `param_value`, `value_type`, `param_type`, `remark`)
SELECT 110201, 'llm.fallback_chain', 'null', 'string', 1, 'LLM fallback chain: comma list of LLM model ids tried in order when the agent''s LLM fails after one retry (e.g. LLM_GeminiLLM,LLM_OpenAILLM). null: no fallback'
WHERE NOT EXISTS (SELECT 1 FROM `sys_params` WHERE `param_code` = 'llm.fallback_chain')
  AND NOT EXISTS (SELECT 1 FROM `sys_params` WHERE `id` = 110201);

INSERT INTO `sys_params` (`id`, `param_code`, `param_value`, `value_type`, `param_type`, `remark`)
SELECT 110202, 'asr.fallback_chain', 'null', 'string', 1, 'ASR fallback chain: comma list of ASR model ids (whole-utterance recognizers) tried in order when the agent''s ASR fails after one retry. null: no fallback'
WHERE NOT EXISTS (SELECT 1 FROM `sys_params` WHERE `param_code` = 'asr.fallback_chain')
  AND NOT EXISTS (SELECT 1 FROM `sys_params` WHERE `id` = 110202);

-- 2. Quota and prices
INSERT INTO `sys_params` (`id`, `param_code`, `param_value`, `value_type`, `param_type`, `remark`)
SELECT 110203, 'usage.quota.daily_llm_requests', '0', 'number', 1, 'Daily LLM request limit per user (all their robots together). 0: unlimited'
WHERE NOT EXISTS (SELECT 1 FROM `sys_params` WHERE `param_code` = 'usage.quota.daily_llm_requests')
  AND NOT EXISTS (SELECT 1 FROM `sys_params` WHERE `id` = 110203);

INSERT INTO `sys_params` (`id`, `param_code`, `param_value`, `value_type`, `param_type`, `remark`)
SELECT 110204, 'usage.price_per_1k', '{}', 'json', 1, 'Optional price per 1K tokens by LLM model id, for the cost estimate on the usage page, e.g. {"LLM_OpenAILLM": 0.0006}'
WHERE NOT EXISTS (SELECT 1 FROM `sys_params` WHERE `param_code` = 'usage.price_per_1k')
  AND NOT EXISTS (SELECT 1 FROM `sys_params` WHERE `id` = 110204);

INSERT INTO `sys_params` (`id`, `param_code`, `param_value`, `value_type`, `param_type`, `remark`)
SELECT 110205, 'usage.currency', 'USD', 'string', 1, 'Currency of usage.price_per_1k, shown with the cost estimate'
WHERE NOT EXISTS (SELECT 1 FROM `sys_params` WHERE `param_code` = 'usage.currency')
  AND NOT EXISTS (SELECT 1 FROM `sys_params` WHERE `id` = 110205);

-- 3. Daily usage rows, reported by xiaozhi-server in batches (one row per day, robot and model)
CREATE TABLE IF NOT EXISTS `ai_usage_daily` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `usage_date` date NOT NULL COMMENT 'Day in the server''s local time',
  `mac_address` varchar(64) NOT NULL COMMENT 'Robot (device MAC)',
  `user_id` bigint DEFAULT NULL COMMENT 'Owner of the robot when the usage was reported',
  `agent_id` varchar(32) DEFAULT NULL COMMENT 'Character of the robot when the usage was reported',
  `model_type` varchar(16) NOT NULL COMMENT 'LLM, ASR or TTS',
  `model_id` varchar(64) NOT NULL COMMENT 'Model config id that did the work (quota: refusals)',
  `llm_requests` int NOT NULL DEFAULT 0,
  `prompt_tokens` bigint NOT NULL DEFAULT 0,
  `completion_tokens` bigint NOT NULL DEFAULT 0,
  `asr_seconds` decimal(12,2) NOT NULL DEFAULT 0,
  `tts_chars` bigint NOT NULL DEFAULT 0,
  `quota_blocked` int NOT NULL DEFAULT 0 COMMENT 'Chats refused because the daily limit was reached',
  `update_date` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_usage_day_robot_model` (`usage_date`, `mac_address`, `model_type`, `model_id`),
  KEY `idx_usage_user_day` (`user_id`, `usage_date`),
  KEY `idx_usage_day` (`usage_date`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COMMENT='Daily AI usage per robot and model';

-- 4. Kids mode of a character (agent): one row per agent, missing row = off
CREATE TABLE IF NOT EXISTS `ai_agent_kids` (
  `agent_id` varchar(32) NOT NULL,
  `enabled` tinyint NOT NULL DEFAULT 0,
  `age` int NOT NULL DEFAULT 7 COMMENT '3 to 12',
  `blocked_topics` varchar(2000) DEFAULT NULL COMMENT 'JSON array of topics TinyBot never talks about',
  `creator` bigint DEFAULT NULL,
  `create_date` datetime DEFAULT NULL,
  `updater` bigint DEFAULT NULL,
  `update_date` datetime DEFAULT NULL,
  PRIMARY KEY (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COMMENT='Kids mode settings of a character';

-- 5. Product feature key: TinyBot can run in kids mode
UPDATE `ai_product`
SET `features` = JSON_ARRAY_APPEND(`features`, '$', 'kids_mode')
WHERE `product_key` = 'tinybot'
  AND JSON_VALID(`features`)
  AND NOT JSON_CONTAINS(`features`, '"kids_mode"');
