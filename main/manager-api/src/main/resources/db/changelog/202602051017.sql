-- Add powermem memory model provider
INSERT INTO `ai_model_provider` (`id`, `model_type`, `provider_code`, `name`, `fields`, `sort`, `creator`, `create_date`, `updater`, `update_date`)
VALUES ('SYSTEM_Memory_powermem', 'Memory', 'powermem', 'PowerMem Memory', '[
  {"key":"enable_user_profile","label":"Enable user profile","type":"boolean"},
  {"key":"llm_provider","label":"LLM Provider","type":"string"},
  {"key":"llm_api_key","label":"LLM API Key","type":"string"},
  {"key":"llm_model","label":"LLM Model","type":"string"},
  {"key":"openai_base_url","label":"OpenAI Base URL","type":"string"},
  {"key":"embedding_provider","label":"Embedding Provider","type":"string"},
  {"key":"embedding_api_key","label":"Embedding API Key","type":"string"},
  {"key":"embedding_model","label":"Embedding Model","type":"string"},
  {"key":"embedding_openai_base_url","label":"Embedding OpenAI Base URL","type":"string"},
  {"key":"embedding_dims","label":"Embedding Dimension","type":"integer"},
  {"key":"vector_store","label":"Vector store config (JSON)","type":"dict"}
]', 4, 1, NOW(), 1, NOW());

-- Add PowerMem memory model configuration
INSERT INTO `ai_model_config` VALUES (
  'Memory_powermem',
  'Memory',
  'powermem',
  'PowerMem Memory',
  0,
  1,
  '{"type": "powermem", "enable_user_profile": true, "llm_provider": "openai", "llm_api_key": "your_llm_api_key", "llm_model": "qwen-plus", "openai_base_url": "", "embedding_provider": "openai", "embedding_api_key": "your_embedding_api_key", "embedding_model": "text-embedding-v4", "embedding_openai_base_url": "https://api.openai.com/v1", "embedding_dims": "", "vector_store": {"provider": "sqlite", "config": {}}}',
  NULL,
  NULL,
  4,
  NULL,
  NULL,
  NULL,
  NULL
);


-- PowerMem memory configuration instructions
UPDATE `ai_model_config` SET
`doc_link` = 'https://github.com/oceanbase/powermem',
`remark` = 'PowerMem is an open-source agent memory component from OceanBase that uses local LLMs for memory summarization.
GitHub: https://github.com/oceanbase/powermem
Website: https://www.powermem.ai/
Examples: https://github.com/oceanbase/powermem/tree/main/examples

[Cost Information]
PowerMem itself is free. Actual cost depends on the selected LLM and database:
- Using sqlite + free LLM (e.g. glm-4-flash) = Completely free
- Using cloud LLM or cloud database = Billed according to corresponding service

[enable_user_profile] User Profile Feature
- false: Use standard memory mode (AsyncMemory)
- true: Use user profile mode (UserMemory), automatically extracting user information
- Profile supported by: oceanbase, seekdb, sqlite (powermem 0.3.0+)

[llm] LLM Configuration - for memory summarization and user profile extraction
  provider: LLM provider, options:
    - qwen: Tongyi Qianwen (https://bailian.console.aliyun.com/?apiKey=1#/api-key)
    - openai: OpenAI compatible API
    - zhipu: Zhipu AI (https://bigmodel.cn/usercenter/proj-mgmt/apikeys) - recommended free glm-4-flash
  config: LLM configuration parameters
    - api_key: API key (required)
    - model: Model name, e.g. qwen-plus, glm-4-flash
    - openai_base_url: Custom service URL (optional), e.g. https://api.openai.com/v1
  Example:
    {"provider": "zhipu", "config": {"api_key": "your_key", "model": "glm-4-flash"}}
    {"provider": "qwen", "config": {"api_key": "your_key", "model": "qwen-plus"}}

[embedder] Embedding Configuration - for vectorizing memory content
  provider: Embedding provider, options:
    - qwen: Tongyi Qianwen
    - openai: OpenAI compatible API
  config: Embedding configuration parameters
    - api_key: API key (required)
    - model: Model name, e.g. text-embedding-v4, text-embedding-3-small
    - openai_base_url: Custom service URL (optional)
    - embedding_dims: Vector dimensions (optional), needed when not 1536
  Example:
    {"provider": "openai", "config": {"api_key": "your_key", "model": "text-embedding-v4", "openai_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1"}}

[vector_store] Database Storage Configuration - for storing vectorized memories
  provider: Database type, options:
    - sqlite: Lightweight local database (recommended for starters, no extra config)
    - oceanbase: OceanBase database (recommended for production, best performance)
    - seekdb: SeekDB (recommended, integrated AI storage)
    - postgres: PostgreSQL database

  SQLite Config (no extra setup needed):
    {"provider": "sqlite", "config": {}}

  OceanBase Config Example:
    {"provider": "oceanbase", "config": {
      "host": "127.0.0.1",
      "port": 2881,
      "user": "root@test",
      "password": "your_password",
      "db_name": "powermem",
      "collection_name": "memories",
      "embedding_model_dims": 1024
    }}
  Note:
    - collection_name: Default table name. If created with wrong dimensions, drop or rename table.
    - embedding_model_dims: Embedding vector dimensions, must match embedder model dimensions.
      E.g. Zhipu: embedding-2 dimension is 1024, embedding-3 dimension is 2048

[Recommended Combinations]
1. Completely Free:
   - LLM: zhipu + glm-4-flash (free)
   - Embedder: Tongyi Qianwen text-embedding-v4
   - Database: sqlite

2. Production:
   - LLM: qwen-plus or other commercial model
   - Embedder: text-embedding-v4
   - Database: oceanbase or seekdb
'
WHERE `id` = 'Memory_powermem';
