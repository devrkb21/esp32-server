# PowerMem 记忆组件集成指南

## 简介

[PowerMem](https://www.powermem.ai/) 是由 OceanBase 开源的 Agent 记忆组件，通过本地 LLM 进行记忆总结和智能检索，为 AI 代理提供高效的记忆管理功能。

费用说明：PowerMem 本身开源免费，实际费用取决于您选择的 LLM 和数据库：
- 使用 SQLite + 免费 LLM（如智谱 glm-4-flash）= **完全免费**
- 使用云端 LLM 或云端数据库 = 按对应服务收费

> 💡 **最佳性能提示**：PowerMem 配合 OceanBase 使用可实现最大性能释放，SQLite 仅建议在资源不足的情况下使用。

- **GitHub**: https://github.com/oceanbase/powermem
- **官网**: https://www.powermem.ai/
- **使用示例**: https://github.com/oceanbase/powermem/tree/main/examples

## 功能特性

- **本地总结**：通过 LLM 在本地进行记忆总结和提取
- **多种存储后端**：支持 OceanBase（推荐，最佳性能）、SeekDB（推荐，AI应用存储一体）、PostgreSQL、SQLite（轻量备选）
- **多种 LLM 支持**：通义千问、智谱（glm-4-flash 免费）、OpenAI 等
- **智能检索**：基于向量搜索的语义检索能力
- **私有部署**：完全支持本地私有化部署
- **异步操作**：高效的异步记忆管理

## 安装

PowerMem 已添加到项目依赖中，如果需要手动安装：

```bash
pip install powermem
```

## 配置说明

### 基础配置

在 `config.yaml` 中配置 PowerMem：

```yaml
selected_module:
  Memory: powermem

Memory:
  powermem:
    type: powermem
    # 数据库提供者: oceanbase(推荐,最佳性能), seekdb, postgres, sqlite(轻量备选)
    database_provider: sqlite  # 资源充足时建议使用 oceanbase 或 seekdb
    # LLM提供者: qwen(默认), openai, 等
    llm_provider: qwen
    # 嵌入模型提供者: qwen(默认), openai, 等
    embedding_provider: qwen
    # LLM配置
    llm_api_key: 你的LLM API密钥
    llm_model: qwen-plus
    # 嵌入模型配置
    embedding_api_key: 你的嵌入模型API密钥
    embedding_model: text-embedding-v3
```

### 配置参数详解

| 参数 | 说明 | 默认值 | 可选值 |
|------|------|--------|--------|
| `database_provider` | 存储后端类型 | `sqlite` | `oceanbase`(推荐), `seekdb`, `postgres`, `sqlite`(轻量) |
| `llm_provider` | LLM 提供商 | `qwen` | `qwen`, `zhipu`(免费), `openai`, 等 |
| `embedding_provider` | 嵌入模型提供商 | `qwen` | `qwen`, `zhipu`, `openai`, 等 |
| `llm_api_key` | LLM API 密钥 | - | - |
| `llm_model` | LLM 模型名称 | - | 根据提供商选择 |
| `llm_base_url` | LLM API 地址（可选） | - | - |
| `embedding_api_key` | 嵌入模型 API 密钥 | - | - |
| `embedding_model` | 嵌入模型名称 | - | 根据提供商选择 |
| `embedding_base_url` | 嵌入模型 API 地址（可选） | - | - |

### 使用通义千问（推荐）

1. 访问 [阿里云百炼平台](https://bailian.console.aliyun.com/) 注册账号
2. 在 [API Key 管理](https://bailian.console.aliyun.com/?apiKey=1#/api-key) 页面获取 API 密钥
3. 配置如下：

```yaml
Memory:
  powermem:
    type: powermem
    database_provider: sqlite
    llm_provider: qwen
    embedding_provider: qwen
    llm_api_key: sk-xxxxxxxxxxxxxxxx
    llm_model: qwen-plus
    embedding_api_key: sk-xxxxxxxxxxxxxxxx
    embedding_model: text-embedding-v3
```

### 使用智谱免费 LLM（完全免费方案）

智谱提供免费的 glm-4-flash 模型，配合 SQLite 可实现完全免费使用：

1. 访问 [智谱AI开放平台](https://bigmodel.cn/) 注册账号
2. 在 [API Keys](https://bigmodel.cn/usercenter/proj-mgmt/apikeys) 页面获取 API 密钥
3. 配置如下：

```yaml
Memory:
  powermem:
    type: powermem
    database_provider: sqlite
    llm_provider: zhipu
    embedding_provider: zhipu
    llm_api_key: xxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxx
    llm_model: glm-4-flash
    llm_base_url: https://open.bigmodel.cn/api/paas/v4/
    embedding_api_key: xxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxx
    embedding_model: embedding-3
    embedding_base_url: https://open.bigmodel.cn/api/paas/v4/
```

### 使用 OpenAI

```yaml
Memory:
  powermem:
    type: powermem
    database_provider: sqlite
    llm_provider: openai
    embedding_provider: openai
    llm_api_key: sk-xxxxxxxxxxxxxxxx
    llm_model: gpt-4o-mini
    llm_base_url: https://api.openai.com/v1
    embedding_api_key: sk-xxxxxxxxxxxxxxxx
    embedding_model: text-embedding-3-small
    embedding_base_url: https://api.openai.com/v1
```

### 使用 OceanBase（最佳性能方案）

OceanBase 是 PowerMem 的最佳搭档，可实现最大性能释放：

1. 部署 OceanBase 数据库（支持开源本地部署或使用云服务）
   - 开源部署：https://github.com/oceanbase/oceanbase
   - 云服务：https://www.oceanbase.com/
2. 配置如下：

```yaml
Memory:
  powermem:
    type: powermem
    database_provider: oceanbase
    llm_provider: qwen
    embedding_provider: qwen
    llm_api_key: sk-xxxxxxxxxxxxxxxx
    llm_model: qwen-plus
    embedding_api_key: sk-xxxxxxxxxxxxxxxx
    embedding_model: text-embedding-v3
    # OceanBase 数据库连接配置
    vector_store:
      provider: oceanbase
      config:
        host: 127.0.0.1
        port: 2881
        user: root@test
        ***REDACTED***: your_***REDACTED***
        database: powermem
```


### 高级配置

如果需要更精细的控制，可以使用完整的配置结构：

```yaml
Memory:
  powermem:
    type: powermem
    # 向量存储配置
    vector_store:
      provider: sqlite
      config:
        path: ./data/powermem.db
    # LLM 配置
    llm:
      provider: qwen
      config:
        api_key: sk-xxxxxxxxxxxxxxxx
        model: qwen-plus
    # 嵌入模型配置
    embedder:
      provider: qwen
      config:
        api_key: sk-xxxxxxxxxxxxxxxx
        model: text-embedding-v3
```

## 设备记忆隔离

PowerMem 会自动使用设备 ID（`device_id`）作为 `user_id` 进行记忆隔离。这意味着：

- 每个设备拥有独立的记忆空间
- 不同设备之间的记忆完全隔离
- 同一设备的多次对话可以共享记忆上下文

## 与其他记忆组件的对比

| 特性 | PowerMem | mem0ai | mem_local_short |
|------|----------|--------|-----------------|
| 工作方式 | 本地总结 | 云端接口 | 本地总结 |
| 存储位置 | 本地/云端DB | 云端 | 本地YAML |
| 费用 | 取决于LLM和DB | 1000次/月免费 | 完全免费 |
| 智能检索 | ✅ 向量搜索 | ✅ 向量搜索 | ❌ 全量返回 |
| 私有部署 | ✅ 支持 | ❌ 仅云端 | ✅ 支持 |
| 数据库支持 | OceanBase(推荐)/SeekDB/PostgreSQL/SQLite | - | YAML 文件 |

## 常见问题

### 1. API 密钥错误

如果出现 `API key is required` 错误，请检查：
- `llm_api_key` 和 `embedding_api_key` 是否正确填写
- API 密钥是否有效

### 2. 模型不存在

如果出现模型不存在的错误，请确认：
- `llm_model` 和 `embedding_model` 名称是否正确
- 对应的模型服务是否已开通

### 3. 连接超时

如果出现连接超时，可以尝试：
- 检查网络连接
- 如果使用代理，配置 `llm_base_url` 和 `embedding_base_url`

## 测试验证

可以在虚拟环境中测试 PowerMem 是否正常工作：

```bash
# 激活虚拟环境
source .venv/bin/activate

# 测试 PowerMem 导入
python -c "from powermem import AsyncMemory; print('PowerMem 导入成功')"
```

## 更多资源

- [PowerMem 官方文档](https://www.powermem.ai/)
- [PowerMem GitHub 仓库](https://github.com/oceanbase/powermem)
- [PowerMem 使用示例](https://github.com/oceanbase/powermem/tree/main/examples)
- [OceanBase 官网](https://www.oceanbase.com/)
- [OceanBase GitHub](https://github.com/oceanbase/oceanbase)
- [SeekDB GitHub](https://github.com/oceanbase/seekdb)（AI原生搜索数据库）
- [阿里云百炼平台](https://bailian.console.aliyun.com/)

