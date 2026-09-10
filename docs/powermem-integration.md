# PowerMem Integration Guide

## Introduction

[PowerMem](https://www.powermem.ai/) is an open-source Agent memory component from OceanBase. It uses a local LLM for memory summarization and intelligent retrieval, providing efficient memory management for AI agents.

Pricing note: PowerMem itself is open source and free. The actual cost depends on the LLM and database you choose:
- SQLite + a free LLM (for example, Zhipu `glm-4-flash`) = **completely free**
- A cloud LLM or cloud database = billed by the corresponding service

> 💡 **Best performance tip**: PowerMem works best with OceanBase. SQLite is recommended only when resources are limited.

- **GitHub**: https://github.com/oceanbase/powermem
- **Website**: https://www.powermem.ai/
- **Examples**: https://github.com/oceanbase/powermem/tree/main/examples

## Features

- **Local summarization**: summarize and extract memory locally through an LLM
- **User profile**: automatically extract user information (name, job, interests, and more) through `UserMemory`
- **Smart forgetting**: automatically forget outdated noisy information based on the Ebbinghaus forgetting curve
- **Multiple storage backends**: OceanBase (recommended, best performance), SeekDB (recommended, AI-native storage), PostgreSQL, SQLite (lightweight fallback)
- **Multiple LLMs**: Qwen, Zhipu (`glm-4-flash` free), OpenAI, and others
- **Intelligent retrieval**: vector-search-based semantic retrieval
- **Private deployment**: fully supports local/private deployment
- **Async operations**: efficient asynchronous memory management

## Installation

PowerMem is already included in the project dependencies. If you need to install it manually:

```bash
pip install powermem
```

## Configuration

### Basic configuration

Configure PowerMem in `config.yaml`:

```yaml
selected_module:
  Memory: powermem

Memory:
  powermem:
    type: powermem
    # Whether to enable the user profile feature
    # Supported user-profile backends: oceanbase, seekdb, sqlite (powermem 0.3.0+)
    enable_user_profile: true

    # ========== LLM config ==========
    llm:
      provider: openai  # optional: qwen, openai, zhipu, etc.
      config:
        api_key: your_llm_api_key
        model: qwen-plus
        # openai_base_url: https://api.openai.com/v1  # optional, custom service URL

    # ========== Embedding config ==========
    embedder:
      provider: openai  # optional: qwen, openai, etc.
      config:
        api_key: your_embedding_api_key
        model: text-embedding-v4
        openai_base_url: https://dashscope.aliyuncs.com/compatible-mode/v1
        # embedding_dims: 1024  # configure this if the vector dimension is not 1536

    # ========== Database config ==========
    vector_store:
      provider: sqlite  # optional: oceanbase (recommended), seekdb (recommended), postgres, sqlite (lightweight)
      config: {}  # SQLite needs no extra config
```

### Configuration details

#### LLM configuration

| Parameter | Description | Options |
|------|------|--------|
| `llm.provider` | LLM provider | `qwen`, `openai`, `zhipu`, etc. |
| `llm.config.api_key` | API key | - |
| `llm.config.model` | Model name | Depends on the provider |
| `llm.config.openai_base_url` | Custom service URL (optional) | - |

#### Embedding configuration

| Parameter | Description | Options |
|------|------|--------|
| `embedder.provider` | Embedding provider | `qwen`, `openai`, etc. |
| `embedder.config.api_key` | API key | - |
| `embedder.config.model` | Model name | Depends on the provider |
| `embedder.config.openai_base_url` | Custom service URL (optional) | - |

#### Database configuration

| Parameter | Description | Options |
|------|------|--------|
| `vector_store.provider` | Storage backend | `oceanbase` (recommended), `seekdb` (recommended), `postgres`, `sqlite` (lightweight) |
| `vector_store.config` | Database connection settings | Set according to the provider |

### Memory modes

PowerMem supports two memory modes:

| Mode | Config | Function | Storage requirement |
|------|------|------|----------|
| **Normal memory** | `enable_user_profile: false` | conversation memory storage and retrieval | all databases supported |
| **User profile** | `enable_user_profile: true` | memory + automatic user profile extraction | `oceanbase`, `seekdb`, `sqlite` |

> 📌 **Version note**: In PowerMem 0.3.0+, user profile support is available for OceanBase, SeekDB, and SQLite backends.

### Using Qwen (recommended)

1. Visit the [Alibaba Cloud Bailian platform](https://bailian.console.aliyun.com/) and register an account.
2. Get your API key on the [API Key management](https://bailian.console.aliyun.com/?apiKey=1#/api-key) page.
3. Configure it like this:

```yaml
Memory:
  powermem:
    type: powermem
    enable_user_profile: true
    llm:
      provider: qwen
      config:
        api_key: sk-xxxxxxxxxxxxxxxx
        model: qwen-plus
    embedder:
      provider: openai
      config:
        api_key: sk-xxxxxxxxxxxxxxxx
        model: text-embedding-v4
        openai_base_url: https://dashscope.aliyuncs.com/compatible-mode/v1
    vector_store:
      provider: sqlite
      config: {}
```

### Using Zhipu free LLM (fully free setup)

Zhipu offers a free `glm-4-flash` model. Paired with SQLite, this gives you a completely free setup:

1. Visit the [Zhipu AI open platform](https://bigmodel.cn/) and register an account.
2. Get your API key on the [API Keys](https://bigmodel.cn/usercenter/proj-mgmt/apikeys) page.
3. Configure it like this:

```yaml
Memory:
  powermem:
    type: powermem
    enable_user_profile: true
    llm:
      provider: openai  # use OpenAI-compatible mode
      config:
        api_key: xxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxx
        model: glm-4-flash
        openai_base_url: https://open.bigmodel.cn/api/paas/v4/
    embedder:
      provider: openai
      config:
        api_key: xxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxx
        model: embedding-3
        openai_base_url: https://open.bigmodel.cn/api/paas/v4/
    vector_store:
      provider: sqlite
      config: {}
```

### Using OpenAI

```yaml
Memory:
  powermem:
    type: powermem
    enable_user_profile: true
    llm:
      provider: openai
      config:
        api_key: sk-xxxxxxxxxxxxxxxx
        model: gpt-4o-mini
        openai_base_url: https://api.openai.com/v1
    embedder:
      provider: openai
      config:
        api_key: sk-xxxxxxxxxxxxxxxx
        model: text-embedding-3-small
        openai_base_url: https://api.openai.com/v1
    vector_store:
      provider: sqlite
      config: {}
```

### Using OceanBase (best performance)

OceanBase is the best match for PowerMem and unlocks maximum performance:

1. Deploy an OceanBase database (open-source local deployment or cloud service)
   - Open-source deployment: https://github.com/oceanbase/oceanbase
   - Cloud service: https://www.oceanbase.com/
2. Configure it like this:

```yaml
Memory:
  powermem:
    type: powermem
    enable_user_profile: true
    llm:
      provider: qwen
      config:
        api_key: sk-xxxxxxxxxxxxxxxx
        model: qwen-plus
    embedder:
      provider: openai
      config:
        api_key: sk-xxxxxxxxxxxxxxxx
        model: text-embedding-v4
        openai_base_url: https://dashscope.aliyuncs.com/compatible-mode/v1
    vector_store:
      provider: oceanbase
      config:
        host: 127.0.0.1
        port: 2881
        user: root@test
        password: your_password
        db_name: powermem
        collection_name: memories  # default value
        embedding_model_dims: 1536  # required vector dimension
```

## Device memory isolation

PowerMem automatically uses the device ID (`device_id`) as the `user_id` for memory isolation. That means:

- Each device has its own independent memory space
- Memory is fully isolated across different devices
- Multiple conversations on the same device can share memory context

## User profile (`UserMemory`)

PowerMem provides the `UserMemory` class, which can automatically extract user profile information from conversations.

> 📌 **Version note**: In PowerMem 0.3.0+, user profile support is available for OceanBase, SeekDB, and SQLite backends.

### Enabling user profile

Enable it by setting `enable_user_profile: true`:

```yaml
Memory:
  powermem:
    type: powermem
    enable_user_profile: true  # enable user profile
    llm:
      provider: qwen
      config:
        api_key: sk-xxxxxxxxxxxxxxxx
        model: qwen-plus
    embedder:
      provider: openai
      config:
        api_key: sk-xxxxxxxxxxxxxxxx
        model: text-embedding-v4
        openai_base_url: https://dashscope.aliyuncs.com/compatible-mode/v1
    vector_store:
      provider: sqlite  # user-profile backends: oceanbase, seekdb, sqlite
      config: {}
```

### User profile capabilities

| Capability | Description |
|------|------|
| **Information extraction** | Automatically extracts name, age, occupation, interests, and more from conversations |
| **Continuous updates** | Keeps refining the user profile as conversations continue |
| **Profile-aware retrieval** | Combines user profile with memory search to improve relevance |
| **Smart forgetting** | Soft-forgets outdated information using the Ebbinghaus curve |

### How it works

When user profile is enabled, Xiaozhi automatically returns:
1. **User profile**: basic user information, interests, and more
2. **Relevant memories**: historical memories related to the current conversation

> ✅ **Version note**: In PowerMem 0.3.0+, user profile support is available for OceanBase, SeekDB, and SQLite backends.

## Comparison with other memory components

| Feature | PowerMem | mem0ai | mem_local_short |
|------|----------|--------|-----------------|
| Workflow | Local summarization | Cloud API | Local summarization |
| Storage location | Local/cloud DB | Cloud | Local YAML |
| Cost | Depends on LLM and DB | 1000 calls/month free | Completely free |
| Intelligent retrieval | ✅ Vector search | ✅ Vector search | ❌ Full return |
| User profile | ✅ UserMemory | ❌ | ❌ |
| Smart forgetting | ✅ Forgetting curve | ❌ | ❌ |
| Private deployment | ✅ Supported | ❌ Cloud only | ✅ Supported |
| Database support | OceanBase (recommended) / SeekDB / PostgreSQL / SQLite | - | YAML file |

## FAQ

### 1. API key error

If you see `API key is required`, check the following:
- Make sure `llm_api_key` and `embedding_api_key` are filled in correctly
- Make sure the API keys are valid

### 2. Model not found

If a model cannot be found, confirm the following:
- The `llm_model` and `embedding_model` names are correct
- The corresponding model services are available

### 3. Connection timeout

If you see a connection timeout, try the following:
- Check your network connection
- If you are using a proxy, configure `llm_base_url` and `embedding_base_url`

## Test and verify

You can test whether PowerMem works correctly in a virtual environment:

```bash
# Activate the virtual environment
source .venv/bin/activate

# Test PowerMem import
python -c "from powermem import AsyncMemory; print('PowerMem imported successfully')"

# Test UserMemory import (user-profile feature)
python -c "from powermem import UserMemory; print('UserMemory imported successfully')"
```

## More resources

- [PowerMem official docs](https://www.powermem.ai/)
- [PowerMem GitHub repository](https://github.com/oceanbase/powermem)
- [PowerMem examples](https://github.com/oceanbase/powermem/tree/main/examples)
- [OceanBase website](https://www.oceanbase.com/)
- [OceanBase GitHub](https://github.com/oceanbase/oceanbase)
- [SeekDB GitHub](https://github.com/oceanbase/seekdb) (AI-native search database)
- [Alibaba Cloud Bailian platform](https://bailian.console.aliyun.com/)
