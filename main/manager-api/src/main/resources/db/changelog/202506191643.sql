-- LLM intent recognition configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = NULL,
`remark` = 'LLMIntent RecognitionConfiguration Instructions:
1. use independentLLMperform intent recognition
2. Default usesselected_module.LLMmodels
3. Can be configured to use independentLLM (such as freeChatGLMLLM) 
4. Generalstrong, but will increase processing time
Configuration Instructions:
1. inllmfield specifies the usedLLMModel
2. If not specified, then useselected_module.LLMmodels' WHERE `id` = 'Intent_intent_llm';

-- Function call intent recognition configuration instructions
UPDATE `ai_model_config` SET 
`doc_link` = NULL,
`remark` = 'Function call intent recognitionConfiguration Instructions:
1. UseLLMfunction_callfunction to perform intent recognition
2. requires the selectedLLMSupportsfunction_call
3. Call tools on demand, Fast processing speed' WHERE `id` = 'Intent_function_call';