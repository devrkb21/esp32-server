# FAQ ❓

### 1. Why does Xiaozhi recognize my speech as a lot of Korean, Japanese, or English? 🇰🇷

Suggestion: Check whether `models/SenseVoiceSmall` already contains `model.pt`.
If not, download it from here: [Download speech recognition model file](Deployment.md#model-files)

### 2. Why do I get `TTS task error: file does not exist`? 📁

Suggestion: Check whether `libopus` and `ffmpeg` were installed correctly with `conda`.

If they are not installed, run:

```bash
conda install conda-forge::libopus
conda install conda-forge::ffmpeg
```

### 3. Why does TTS fail so often or time out often? ⏰

Suggestion: If `EdgeTTS` fails frequently, first check whether you are using a proxy. If you are, try turning it off and testing again.
If you are using Volcano Engine Doubao TTS, frequent failures are expected in the test version because it only supports 2 concurrent requests.

### 4. Why can I connect to my self-hosted server over Wi-Fi, but not in 4G mode? 🔐

Reason: For Xiaoge’s firmware, 4G mode requires a secure connection.

Fix: There are currently two ways to solve this. Choose one:

1. Modify the code. Refer to this video: https://www.bilibili.com/video/BV18MfTYoE85

2. Configure an SSL certificate with Nginx. Refer to this guide: https://icnt94i5ctj4.feishu.cn/docx/GnYOdMNJOoRCljx1ctecsj9cnRe

### 5. How can I improve Xiaozhi’s response speed? ⚡

The default setup in this project is a low-cost configuration. Beginners are advised to start with the default free models and first solve the problem of “getting it to run,” then optimize for speed.
To improve response speed, try replacing the individual components. Starting from version `0.5.2`, the project supports a streaming configuration. Compared with earlier versions, response speed improves by about `2.5 seconds`, which significantly improves the user experience.

| Module | Starter Free Setup | Streaming Setup |
|:---:|:---:|:---:|
| ASR (speech recognition) | FunASR (local) | 👍 XunfeiStreamASR |
| LLM | glm-4-flash (Zhipu) | 👍 qwen-flash (Alibaba Bailian) |
| VLLM (vision model) | glm-4v-flash (Zhipu) | 👍 qwen3.5-flash (Alibaba Bailian) |
| TTS (speech synthesis) | EdgeTTS (Microsoft) | 👍 HuoshanDoubleStreamTTS |
| Intent recognition | function_call | function_call |
| Memory | mem_local_short (local short-term memory) | mem_local_short (local short-term memory) |

If you care about the runtime cost of each component, check the [Xiaozhi component performance test report](https://github.com/xinnan-tech/xiaozhi-performance-research). You can use the same test methods in your own environment.

### 6. I speak slowly, and Xiaozhi keeps interrupting me when I pause 🗣️

Suggestion: In the config file, find the following section and increase the value of `min_silence_duration_ms` (for example, set it to `1000`):

```yaml
VAD:
  SileroVAD:
    threshold: 0.5
    model_dir: models/snakers4_silero-vad
    min_silence_duration_ms: 700  # Increase this value if your pauses are long
```

### 7. Deployment tutorials
1. [How to perform the minimal deployment](./Deployment.md)<br/>
2. [How to perform the full-module deployment](./Deployment_all.md)<br/>
3. [How to deploy the MQTT gateway to enable MQTT+UDP](./mqtt-gateway-integration.md)<br/>
4. [How to auto-pull the latest code, build, and start automatically](./dev-ops-integration.md)<br/>
5. [How to integrate with Nginx](https://github.com/xinnan-tech/xiaozhi-esp32-server/issues/791)<br/>
6. [How to build your own Docker image after modifying the code](./docker-build.md)<br/>

### 8. Firmware build tutorials
1. [How to build the Xiaozhi firmware yourself](./firmware-build.md)<br/>
2. [How to modify the OTA address using a prebuilt firmware](./firmware-setting.md)<br/>
3. [How to configure firmware OTA auto-upgrade in single-module deployment](./ota-upgrade-guide.md)<br/>

### 9. Extension tutorials
1. [How to enable phone-number registration for the console](./ali-sms-integration.md)<br/>
2. [How to integrate HomeAssistant for smart-home control](./homeassistant-integration.md)<br/>
3. [How to enable vision models for photo-based object recognition](./mcp-vision-integration.md)<br/>
4. [How to deploy an MCP endpoint](./mcp-endpoint-enable.md)<br/>
5. [How to connect to an MCP endpoint](./mcp-endpoint-integration.md)<br/>
6. [How to get device information using MCP methods](./mcp-get-device-info.md)<br/>
7. [How to enable voiceprint recognition](./voiceprint-integration.md)<br/>
8. [News plugin source configuration guide](./newsnow_plugin_config.md)<br/>
9. [RAGFlow knowledge base integration guide](./ragflow-integration.md)<br/>
10. [How to deploy a context provider](./context-provider-integration.md)<br/>
11. [How to integrate PowerMem smart memory](./powermem-integration.md)<br/>
12. [How to configure the weather plugin for weather queries](./weather-integration.md)<br/>
13. [How to enable the device call plugin](./device-call-guide.md)<br/>
14. [How to enable web search](./web-search-integration.md)<br/>

### 10. Digital human tutorials
1. [How to start digital-human](./digital-human-wakeword.md)<br/>
2. [How to deploy digital-human on an N100 mini PC](./all-in-one-digital-human-setup.md)<br/>

### 11. Voice cloning and local voice deployment tutorials
1. [How to clone a voice in the console](./huoshan-streamTTS-voice-cloning.md)<br/>
2. [How to deploy and integrate local index-tts voice](./index-stream-integration.md)<br/>
3. [How to deploy and integrate local fish-speech voice](./fish-speech-integration.md)<br/>
4. [How to deploy and integrate PaddleSpeech local voice](./paddlespeech-deploy.md)<br/>

### 12. Performance test tutorials
1. [Component speed test guide](./performance_tester.md)<br/>
2. [Periodic public test results](https://github.com/xinnan-tech/xiaozhi-performance-research)<br/>

### 13. More questions? Contact us and submit feedback 💬

You can submit your issue in [Issues](https://github.com/xinnan-tech/xiaozhi-esp32-server/issues).