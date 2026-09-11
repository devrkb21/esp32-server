-- Update fields in ai_model_provider: change type dict to string
update ai_model_provider set fields = replace(fields, '"type": "dict"', '"type": "string"') where id not in ('SYSTEM_LLM_fastgpt', 'SYSTEM_TTS_custom');
update ai_model_provider set fields = replace(fields, '"type":"dict"', '"type": "string"') where id not in ('SYSTEM_LLM_fastgpt', 'SYSTEM_TTS_custom');