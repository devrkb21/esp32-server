-- Add chat record configuration fields
ALTER TABLE `ai_agent` 
ADD COLUMN `chat_history_conf` tinyint NOT NULL DEFAULT 0 COMMENT 'Chat record configuration (0: Do not record, 1: Text only, 2: Text and audio)' AFTER `system_prompt`;

ALTER TABLE `ai_agent_template` 
ADD COLUMN `chat_history_conf` tinyint NOT NULL DEFAULT 0 COMMENT 'Chat record configuration (0: Do not record, 1: Text only, 2: Text and audio)' AFTER `system_prompt`;