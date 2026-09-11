[![Banners](docs/images/banner1.png)](https://github.com/xinnan-tech/xiaozhi-esp32-server)

<h1 align="center">Xiaozhi Backend Service xiaozhi-esp32-server</h1>

<p align="center">
This project researches and builds a smart terminal hardware/software system based on human-machine symbiotic intelligence theory and technology.<br/>
It provides backend services for the open-source smart hardware project
<a href="https://github.com/78/xiaozhi-esp32">xiaozhi-esp32</a>.<br/>
It is implemented with Python, Java, and Vue based on the <a href="https://ccnphfhqs21z.feishu.cn/wiki/M0XiwldO9iJwHikpXD5cEx71nKh">Xiaozhi communication protocol</a>.<br/>
It supports MQTT+UDP, WebSocket, MCP access points, voiceprint recognition, and knowledge bases.
</p>

<p align="center">
<a href="./docs/FAQ.md">FAQ</a>
· <a href="https://github.com/xinnan-tech/xiaozhi-esp32-server/issues">Report an issue</a>
· <a href="./README.md#deployment-docs">Deployment docs</a>
· <a href="https://github.com/xinnan-tech/xiaozhi-esp32-server/releases">Changelog</a>
</p>

<p align="center">
  <a href="./README.md"><img alt="Simplified Chinese README" src="https://img.shields.io/badge/Chinese-DBEDFA"></a>
  <a href="./docs/readme/README_en.md"><img alt="README in English" src="https://img.shields.io/badge/English-DFE0E5"></a>
  <a href="./docs/readme/README_vi.md"><img alt="Vietnamese" src="https://img.shields.io/badge/Tiếng Việt-DFE0E5"></a>
  <a href="./docs/readme/README_de.md"><img alt="German" src="https://img.shields.io/badge/Deutsch-DFE0E5"></a>
  <a href="./docs/readme/README_pt_BR.md"><img alt="Portuguese (Brazil)" src="https://img.shields.io/badge/Português (Brasil)-DFE0E5"></a>
  <a href="https://github.com/xinnan-tech/xiaozhi-esp32-server/releases">
    <img alt="GitHub releases" src="https://img.shields.io/github/v/release/xinnan-tech/xiaozhi-esp32-server?logo=docker" />
  </a>
  <a href="https://github.com/xinnan-tech/xiaozhi-esp32-server/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/badge/license-MIT-white?labelColor=black" />
  </a>
  <a href="https://github.com/xinnan-tech/xiaozhi-esp32-server">
    <img alt="stars" src="https://img.shields.io/github/stars/xinnan-tech/xiaozhi-esp32-server?color=ffcb47&labelColor=black" />
  </a>
</p>

<p align="center">
Spearheaded by Professor Siyuan Liu's team (South China University of Technology)
</br>
Led by Professor Liu Siyuan's team (South China University of Technology)
</br>
<img src="./docs/images/hnlg.jpg" alt="South China University of Technology" width="50%">
</p>

---

## Target Users 👥

This project is designed to work with ESP32 hardware devices. If you have already purchased ESP32-related hardware, have successfully connected to the backend service deployed by Xiaoge, and want to build your own independent `xiaozhi-esp32` backend service, this project is a great fit.

Want to see it in action? Watch the videos 🎥

<table>
  <tr>
    <td>
      <a href="https://www.bilibili.com/video/BV1FMFyejExX" target="_blank">
        <picture>
          <img alt="Feel the response speed" src="docs/images/demo9.png" /></picture>
      </a>
    </td>
    <td>
      <a href="https://www.bilibili.com/video/BV1vchQzaEse" target="_blank">
        <picture>
          <img alt="Tips for improving speed" src="docs/images/demo6.png" /></picture>
      </a>
    </td>
    <td>
      <a href="https://www.bilibili.com/video/BV1WEcxzFEAT" target="_blank">
        <picture>
          <img alt="Xiaozhi digital human supports voice wake-up" src="docs/images/demo8.png" /></picture>
      </a>
    </td>
    <td>
      <a href="https://www.bilibili.com/video/BV1CKVz6UEuB" target="_blank">
        <picture>
          <img alt="Device calls device, making a call" src="docs/images/demo0.png" /></picture>
      </a>
    </td>
    <td>
      <a href="https://www.bilibili.com/video/BV1C1tCzUEZh" target="_blank">
        <picture>
          <img alt="Complex medical scenario" src="docs/images/demo1.png" /></picture>
      </a>
    </td>
  </tr>
  <tr>
    <td>
      <a href="https://www.bilibili.com/video/BV1VC96Y5EMH" target="_blank">
        <picture>
          <img alt="Play music, check the weather, and read the news" src="docs/images/demo7.png" /></picture>
      </a>
    </td>
    <td>
      <a href="https://www.bilibili.com/video/BV12J7WzBEaH" target="_blank">
        <picture>
          <img alt="Real-time interruption" src="docs/images/demo10.png" /></picture>
      </a>
    </td>
    <td>
      <a href="https://www.bilibili.com/video/BV1Co76z7EvK" target="_blank">
        <picture>
          <img alt="Take a photo to recognize objects" src="docs/images/demo12.png" /></picture>
      </a>
    </td>
    <td>
      <a href="https://www.bilibili.com/video/BV1pNXWYGEx1" target="_blank">
        <picture>
          <img alt="Control home appliance switches" src="docs/images/demo5.png" /></picture>
      </a>
    </td>
    <td>
      <a href="https://www.bilibili.com/video/BV1TJ7WzzEo6" target="_blank">
        <picture>
          <img alt="Multi-command tasks" src="docs/images/demo11.png" /></picture>
      </a>
    </td>
  </tr>
  <tr>
    <td>
      <a href="https://www.bilibili.com/video/BV1ZQKUzYExM" target="_blank">
        <picture>
          <img alt="MCP access point" src="docs/images/demo13.png" /></picture>
      </a>
    </td>
    <td>
      <a href="https://www.bilibili.com/video/BV1zUW5zJEkq" target="_blank">
        <picture>
          <img alt="MQTT command delivery" src="docs/images/demo4.png" /></picture>
      </a>
    </td>
    <td>
      <a href="https://www.bilibili.com/video/BV1Exu3zqEDe" target="_blank">
        <picture>
          <img alt="Voiceprint recognition" src="docs/images/demo14.png" /></picture>
      </a>
    </td>
    <td>
      <a href="https://www.bilibili.com/video/BV1CDKWemEU6" target="_blank">
        <picture>
          <img alt="Custom voice style" src="docs/images/demo2.png" /></picture>
      </a>
    </td>
    <td>
      <a href="https://www.bilibili.com/video/BV12yA2egEaC" target="_blank">
        <picture>
          <img alt="Use Cantonese to communicate" src="docs/images/demo3.png" /></picture>
      </a>
    </td>
  </tr>
</table>

---

## Warning ⚠️

1. This is open-source software. The project has no commercial relationship with any third-party API provider connected to it (including, but not limited to, speech recognition, large-model, and speech synthesis platforms), and does not provide any guarantee regarding their service quality or fund security.
   Users are encouraged to prioritize providers with the relevant business licenses and to carefully read their terms of service and privacy policies. This software does not host any account keys, does not participate in fund transfers, and does not assume risk for recharge or top-up losses.

2. The project is still incomplete and has not passed a cybersecurity assessment. Do not use it in production environments. If you deploy and learn from it on a public network, make sure to apply the necessary protections.

---

## Deployment Docs

![Banners](docs/images/banner2.png)

This project provides two deployment options. Choose the one that best fits your needs:

#### 🚀 Deployment Options
| Deployment method | Features | Use case | Deployment docs | Hardware requirements | Video tutorial |
|---------|------|---------|---------|---------|---------|
| **Minimal installation** | Intelligent conversation, single-agent management | Low-resource environments; data stored in configuration files; no database required | [① Docker](./docs/Deployment.md#%E6%96%B9%E5%BC%8F%E4%B8%80docker%E5%8F%AA%E8%BF%90%E8%A1%8Cserver) / [② Source deployment](./docs/Deployment.md#%E6%96%B9%E5%BC%8F%E4%BA%8C%E6%9C%AC%E5%9C%B0%E6%BA%90%E7%A0%81%E5%8F%AA%E8%BF%90%E8%A1%8Cserver) | If using `FunASR`: 2 cores / 4 GB. If using all APIs: 2 cores / 2 GB | - |
| **Full-module installation** | Intelligent conversation, multi-user management, multi-agent management, control-console UI operations | Full-feature experience; data stored in the database | [① Docker](./docs/Deployment_all.md#%E6%96%B9%E5%BC%8F%E4%B8%80docker%E8%BF%90%E8%A1%8C%E5%85%A8%E6%A8%A1%E5%9D%97) / [② Source deployment](./docs/Deployment_all.md#%E6%96%B9%E5%BC%8F%E4%BA%8C%E6%9C%AC%E5%9C%B0%E6%BA%90%E7%A0%81%E8%BF%90%E8%A1%8C%E5%85%A8%E6%A8%A1%E5%9D%97) / [③ Source deployment auto-update guide](./docs/dev-ops-integration.md) | If using `FunASR`: 4 cores / 8 GB. If using all APIs: 2 cores / 4 GB | [Local source startup video tutorial](https://www.bilibili.com/video/BV1wBJhz4Ewe) |

For FAQs and related tutorials, see [this link](./docs/FAQ.md).

> 💡 Tip: The following test platform is deployed using the latest code. You can flash it for testing if needed. Concurrency is 6, and the data is cleared every day.

```
Control console URL: https://2662r3426b.vicp.fun
Control console (H5): https://2662r3426b.vicp.fun/h5/index.html

Service test tool: https://2662r3426b.vicp.fun/test/
OTA endpoint: https://2662r3426b.vicp.fun/xiaozhi/ota/
WebSocket endpoint: wss://2662r3426b.vicp.fun/xiaozhi/v1/
```

#### 🚩 Configuration Notes and Recommendations
> [!Note]
> This project provides two configuration options:
> 
> 1. `Beginner fully-free` configuration: suitable for personal and home use. All components use free options, with no extra cost.
> 
> 2. `Streaming` configuration: suitable for demos, training, and scenarios with more than 2 concurrent sessions. It uses streaming processing for faster responses and a better experience.
> 
> Starting from version `0.5.2`, the project supports streaming configuration. Compared with earlier versions, response speed improves by about `2.5 seconds`, significantly improving the user experience.

| Module | Beginner fully-free setup | Streaming setup |
|:---:|:---:|:---:|
| ASR (speech recognition) | FunASR (local) | 👍 XunfeiStreamASR (Xunfei streaming) |
| LLM | glm-4-flash (Zhipu) | 👍 qwen-flash (Alibaba Bailian) |
| VLLM (vision large model) | glm-4v-flash (Zhipu) | 👍 qwen3.5-flash (Alibaba Bailian) |
| TTS (speech synthesis) | EdgeTTS (Microsoft) | 👍 HuoshanDoubleStreamTTS (Huoshan streaming) |
| Intent recognition | function_call | function_call |
| Memory | mem_local_short (local short-term memory) | mem_local_short (local short-term memory) |

If you care about component latency, please refer to the [Xiaozhi component performance test report](https://github.com/xinnan-tech/xiaozhi-performance-research). You can also reproduce the tests in your own environment using the methods described in the report.

#### 🔧 Test Tools
This project provides the following test tools to help you validate the system and choose the right models:

| Tool | Location | How to use | Description |
|:---:|:---|:---:|:---:|
| Audio interaction test tool | main>digital-human>index.html | After running `python start.py` in `main/digital-human`, visit `http://127.0.0.1:8006/index.html` | Tests audio playback and receiving, and verifies whether Python-side audio processing is working correctly |
| Model response test tool | main>xiaozhi-server>performance_tester.py | Run `python performance_tester.py` | Tests the response speed of the three core modules: ASR, LLM, VLLM, and TTS |

> 💡 Tip: When testing model speed, only the models that have keys configured will be tested.

---
## Feature List ✨
### Implemented ✅
![Please refer to the full-module deployment architecture diagram](docs/images/deploy2.png)
| Feature module | Description |
|:---:|:---|
| Core architecture | Based on [MQTT+UDP gateway](https://github.com/xinnan-tech/xiaozhi-esp32-server/blob/main/docs/mqtt-gateway-integration.md), WebSocket, and HTTP server, it provides full console management and an authentication system |
| Voice interaction | Supports streaming ASR, streaming TTS, and VAD; supports multilingual recognition and speech processing |
| Voiceprint recognition | Supports multi-user voiceprint enrollment, management, and recognition; processes in parallel with ASR, identifies speaker identity in real time, and passes it to the LLM for personalized responses |
| Intelligent conversation | Supports multiple LLMs (large language models) for smart conversations |
| Vision perception | Supports multiple VLLMs (vision large models) for multimodal interaction |
| Intent recognition | Supports externally hosted LLM-based intent recognition and autonomous function calling, with a plugin-style intent processing mechanism |
| Memory system | Supports local short-term memory, mem0ai API memory, and PowerMem intelligent memory, with memory summarization |
| Knowledge base | Supports RAGFlow knowledge bases so the model can decide whether to query the knowledge base before answering |
| Tool invocation | Supports client IoT protocols, client MCP protocol, server MCP protocol, MCP access point protocol, and custom tool functions |
| Command delivery | Based on MQTT, supports delivering MCP commands from the control console to ESP32 devices |
| Admin backend | Provides a web admin UI with user management, system configuration, and device management; the interface supports Simplified Chinese, Traditional Chinese, and English |
| Test tools | Provides performance, vision-model, and audio interaction test tools |
| Deployment support | Supports Docker and local deployment, with complete configuration file management |
| Plugin system | Supports feature plugins, custom plugin development, and plugin hot reloading |

### In development 🚧

For the current development plan, [click here](https://github.com/users/xinnan-tech/projects/3). For FAQs and related tutorials, see [this link](./docs/FAQ.md).

If you are a software developer, there is a [Public Letter to Developers](docs/contributor_open_letter.md). Welcome to join!

---

## Ecosystem 👬
Xiaozhi is an ecosystem. When you use this product, you may also want to check out other [excellent projects](https://github.com/78/xiaozhi-esp32/blob/main/README_zh.md#%E7%9B%B8%E5%85%B3%E5%BC%80%E6%BA%90%E9%A1%B9%E7%9B%AE) in the ecosystem.

---

## Supported Platforms / Components 📋
### LLMs

| Usage | Supported platforms | Free platforms |
|:---:|:---:|:---:|
| OpenAI-compatible API calls | Alibaba Bailian, Volcano Engine, DeepSeek, Zhipu, Gemini, iFlytek | Zhipu, Gemini |
| Ollama API calls | Ollama | - |
| Dify API calls | Dify | - |
| FastGPT API calls | FastGPT | - |
| Coze API calls | Coze | - |
| Xinference API calls | Xinference | - |
| HomeAssistant API calls | HomeAssistant | - |

In fact, any LLM that supports OpenAI-compatible API calls can be integrated.

---

### VLLMs

| Usage | Supported platforms | Free platforms |
|:---:|:---:|:---:|
| OpenAI-compatible API calls | Alibaba Bailian, Zhipu ChatGLM VLLM | Zhipu ChatGLM VLLM |

In fact, any VLLM that supports OpenAI-compatible API calls can be integrated.

---

### TTS Speech Synthesis

| Usage | Supported platforms | Free platforms |
|:---:|:---:|:---:|
| API calls | EdgeTTS, iFlytek, Volcano Engine, Tencent Cloud, Alibaba Cloud & Bailian, CosyVoiceSiliconflow, TTS302AI, CozeCnTTS, GizwitsTTS, ACGNTTS, OpenAITTS, Lingxi streaming TTS, MinimaxTTS | Lingxi streaming TTS, EdgeTTS, some CosyVoiceSiliconflow options |
| Local services | FishSpeech, GPT_SOVITS_V2, GPT_SOVITS_V3, Index-TTS, PaddleSpeech | Index-TTS, PaddleSpeech, FishSpeech, GPT_SOVITS_V2, GPT_SOVITS_V3 |

---

### VAD Speech Activity Detection

| Type | Platform | Usage | Billing model | Notes |
|:---:|:---------:|:----:|:---------:|:--:|
| VAD | SileroVAD | Local | Free | |

---

### ASR Speech Recognition

| Usage | Supported platforms | Free platforms |
|:---:|:---:|:---:|
| Local usage | FunASR, SherpaASR | FunASR, SherpaASR |
| API calls | FunASRServer, Volcano Engine, iFlytek, Tencent Cloud, Alibaba Cloud, Baidu Cloud, OpenAI ASR | FunASRServer |

---

### Voiceprint Recognition

| Usage | Supported platforms | Free platforms |
|:---:|:---:|:---:|
| Local usage | 3D-Speaker | 3D-Speaker |

---

### Memory Storage

| Type | Platform | Usage | Billing model | Notes |
|:------:|:---------------:|:----:|:---------:|:--:|
| Memory | mem0ai | API calls | 1,000 requests/month quota | |
| Memory | [powermem](./docs/powermem-integration.md) | Local summarization | Depends on LLM and database | Open-sourced by OceanBase, supports intelligent retrieval |
| Memory | mem_local_short | Local summarization | Free | |
| Memory | nomem | No-memory mode | Free | |

---

### Intent Recognition

| Type | Platform | Usage | Billing model | Notes |
|:------:|:-------------:|:----:|:-------:|:---------------------:|
| Intent | intent_llm | API calls | Billed according to the LLM | Uses a large model to recognize intent; very general |
| Intent | function_call | API calls | Billed according to the LLM | Uses LLM function calling to complete intent; fast and effective |
| Intent | nointent | No-intent mode | Free | Does not perform intent recognition; returns the conversation result directly |

---

### RAG Retrieval-Augmented Generation

| Type | Platform | Usage | Billing model | Notes |
|:------:|:-------------:|:----:|:-------:|:---------------------:|
| Rag | ragflow | API calls | Billed according to token usage for chunking and tokenization | Uses RAGFlow retrieval-augmented generation to provide more accurate replies |

---

## Acknowledgements 🙏

| Logo | Project / Company | Description |
|:---:|:---:|:---|
| <img src="./docs/images/logo_bailing.png" width="160"> | [Bailing Voice Chat Robot](https://github.com/wwbin2017/bailing) | This project was inspired by [Bailing Voice Chat Robot](https://github.com/wwbin2017/bailing) and implemented based on it |
| <img src="./docs/images/logo_tenclass.png" width="160"> | [Tenclass](https://www.tenclass.com/) | Thanks to [Tenclass](https://www.tenclass.com/) for defining the standard communication protocol for the Xiaozhi ecosystem, multi-device compatibility solutions, and practical examples for high-concurrency scenarios; and for providing end-to-end technical documentation support for this project |
| <img src="./docs/images/logo_xuanfeng.png" width="160"> | [Xuanfeng Technology](https://github.com/Eric0308) | Thanks to [Xuanfeng Technology](https://github.com/Eric0308) for contributing the function-calling framework, MCP communication protocol, and plugin-based invocation mechanism. Their standardized command scheduling system and dynamic extensibility significantly improve IoT device interaction efficiency and feature extensibility |
| <img src="./docs/images/logo_junsen.png" width="160"> | [huangjunsen](https://github.com/huangjunsen0406) | Thanks to [huangjunsen](https://github.com/huangjunsen0406) for contributing the `Control Console Mobile` module, enabling efficient cross-platform mobile device control and real-time interaction, greatly improving usability and management efficiency in mobile scenarios |
| <img src="./docs/images/logo_huiyuan.png" width="160"> | [Huiyuan Design](http://ui.kwd988.net/) | Thanks to [Huiyuan Design](http://ui.kwd988.net/) for providing professional visual solutions, leveraging their hands-on experience serving more than a thousand enterprises to enhance the product experience of this project |
| <img src="./docs/images/logo_qinren.png" width="160"> | [Xi'an Qinren Information Technology](https://www.029app.com/) | Thanks to [Xi'an Qinren Information Technology](https://www.029app.com/) for refining the visual system of this project and ensuring consistency and scalability across multiple application scenarios |
| <img src="./docs/images/logo_contributors.png" width="160"> | [Code Contributors](https://github.com/xinnan-tech/xiaozhi-esp32-server/graphs/contributors) | Thanks to [all code contributors](https://github.com/xinnan-tech/xiaozhi-esp32-server/graphs/contributors). Your contributions make this project more robust and powerful. |


<a href="https://www.star-history.com/?repos=xinnan-tech%2Fxiaozhi-esp32-server&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=xinnan-tech/xiaozhi-esp32-server&type=date&theme=dark&legend=top-left&sealed_token=cQovHKgZjqEnQ-svfYfN392irNvGuq-6pyv4cA8nd2jQEhQLz1ETV4YHTVk2UZyLMFbCQuZA7jduRh3YbeK5WPYaRLrfmIimGQa3lram652jJL9oQk-UuSZA5H6L4dPIhZc8KCc-Ur_UAUNbly7TePpnTR2otGknBLCOjOliD4fk1st6z7tPEDVjSRx5" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=xinnan-tech/xiaozhi-esp32-server&type=date&legend=top-left&sealed_token=cQovHKgZjqEnQ-svfYfN392irNvGuq-6pyv4cA8nd2jQEhQLz1ETV4YHTVk2UZyLMFbCQuZA7jduRh3YbeK5WPYaRLrfmIimGQa3lram652jJL9oQk-UuSZA5H6L4dPIhZc8KCc-Ur_UAUNbly7TePpnTR2otGknBLCOjOliD4fk1st6z7tPEDVjSRx5" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=xinnan-tech/xiaozhi-esp32-server&type=date&legend=top-left&sealed_token=cQovHKgZjqEnQ-svfYfN392irNvGuq-6pyv4cA8nd2jQEhQLz1ETV4YHTVk2UZyLMFbCQuZA7jduRh3YbeK5WPYaRLrfmIimGQa3lram652jJL9oQk-UuSZA5H6L4dPIhZc8KCc-Ur_UAUNbly7TePpnTR2otGknBLCOjOliD4fk1st6z7tPEDVjSRx5" />
 </picture>
</a>
