-- Modify memory model name

UPDATE `ai_model_config` SET `model_name` = 'Local Short-term Memory (Summary memory) ' WHERE `id` = 'Memory_mem_local_short';
UPDATE `ai_model_provider` SET `name` = 'Local Short-term Memory (Summary memory) ' WHERE `id` = 'SYSTEM_Memory_mem_local_short';

UPDATE `ai_model_config` SET `model_name` = 'Only report chat history (notSummary memory) ' WHERE `id` = 'Memory_mem_report_only';
UPDATE `ai_model_provider` SET `name` = 'Only report chat history (notSummary memory) ' WHERE `id` = 'SYSTEM_Memory_mem_report_only';
