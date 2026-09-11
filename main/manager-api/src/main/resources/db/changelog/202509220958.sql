delete from `ai_model_config` where id = 'LLM_XunfeiSparkLLM';
INSERT INTO `ai_model_config` VALUES ('LLM_XunfeiSparkLLM', 'LLM', 'iFlytek Spark Cognitive Model', 'iFlytek Spark Cognitive Model', 0, 1, '{"type": "openai", "model_name": "generalv3.5", "base_url": "https://spark-api-open.xf-yun.com/v1", "api_password": "Yourapi_password", "temperature": 0.5, "max_tokens": 2048, "top_p": 1.0, "frequency_penalty": 0.0}', 'https://www.xfyun.cn/doc/spark/HTTP%E8%B0%83%E7%94%A8%E6%96%87%E6%A1%A3.html', 'iFlytek Spark Cognitive Model, Supports multi-turn dialogue, text generation and other functions', 14, NULL, NULL, NULL, NULL);

-- Update iFlytek Spark cognitive model configuration documentation
UPDATE `ai_model_config` SET
`doc_link` = 'https://www.xfyun.cn/doc/spark/HTTP%E8%B0%83%E7%94%A8%E6%96%87%E6%A1%A3.html',
`remark` = 'iFlytek Spark Cognitive ModelConfiguration Instructions:
1. Log in to iFlytek Open Platform https://www.xfyun.cn/, Each model corresponds to eachapi_password,Check model settings when changing modelsapi_password
2. CreateSpark Cognitive ModelApplication obtainAPI Password
3. Parameter Descriptions:
- api_password: API Password, Obtained after creating an application on the iFlytek Open Platform
- model_name: Model name, Supportsgeneralv3.5, generalv3and other versions
- base_url: APIAddress, Defaulthttps://spark-api-open.xf-yun.com/v1
- temperature: Temperature Parameter, Controls generation randomness, Range0-1, Default0.5
- max_tokens: Max OutputtokenCount, Default2048
- top_p: Core sampling parameter, Controls vocabulary diversity, Default1.0
- frequency_penalty: Frequency Penalty, Reduces repeated content, Default0.0
4. Each model corresponds to eachapi_password,Check model settings when changing modelsapi_password.
' WHERE `id` = 'LLM_XunfeiSparkLLM';