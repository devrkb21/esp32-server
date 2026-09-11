-- Add RAG model provider and configuration
-- -------------------------------------------------------

-- Add RAG model provider
delete from `ai_model_provider` where id = 'SYSTEM_RAG_ragflow';
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`) VALUES
('SYSTEM_RAG_ragflow', 'RAG', 'ragflow', 'RAGFlow', '[{"key": "base_url", "type": "string", "label": "Service address"}, {"key": "api_key", "type": "string", "label": "API Key"}]', 1, 1, NOW(), 1, NOW());

-- Add RAG model configuration
delete from `ai_model_config` where id = 'RAG_RAGFlow';
INSERT INTO `ai_model_config` VALUES ('RAG_RAGFlow', 'RAG', 'ragflow', 'RAGFlow', 1, 1, '{"type": "ragflow", "base_url": "http://localhost", "api_key": "YourRAGSecret Key"}', 'https://github.com/infiniflow/ragflow/blob/main/README_zh.md', 'RAGFlowConfiguration Instructions:
One, Quick deployment tutorial (dockerDeployment) 
1.$ sysctl vm.max_map_count
2.$ sysctl -w vm.max_map_count=262144
3.$ git clone https://github.com/infiniflow/ragflow.git
4.docker compose -f docker-compose.yml up -d
5.$ docker logs -f docker-ragflow-cpu-1
6.After registration and login, Click the avatar in top right corner, ObtainRAGFlowAPI KEYandAPIServer Address。UseRAGFlowbefore please inModel Provideradd models and set default model in。
Two, If you wish to turn off the registration function
1.Stop Service docker compose down
2. sed -i ''s/REGISTER_ENABLED=1/REGISTER_ENABLED=0/g'' .env 
3.cat .env | grep -i register
4.SeeREGISTER_ENABLED=0 Just restart the service。', 1, NULL, NULL, NULL, NULL);

