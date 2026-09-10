# Vision Model Guide

This tutorial has two parts:
- Part 1: Enable the vision model when running `xiaozhi-server` in single-module mode
- Part 2: Enable the vision model when running in full-module mode

Before enabling the vision model, prepare these three things:
- A device with a camera, and the device firmware must already support camera access in Xiaoge's repository. For example: `Lichuang · Practical ESP32-S3 Development Board`
- Your device firmware must be upgraded to version `1.6.6` or later
- You must already have the basic chat module working successfully

## Enabling the vision model in single-module mode

### Step 1: Check the network

The vision model uses port `8003` by default.

If you are using Docker, make sure your `docker-compose.yml` exposes port `8003`. If not, update to the latest `docker-compose.yml`.

If you are running from source, make sure your firewall allows port `8003`.

### Step 2: Choose your vision model

Open `data/.config.yaml` and set `selected_module.VLLM` to a vision model. We currently support vision models that use `openai`-compatible APIs. `ChatGLMVLLM` is one such compatible model.

```yaml
selected_module:
  VAD: ..
  ASR: ..
  LLM: ..
  VLLM: ChatGLMVLLM
  TTS: ..
  Memory: ..
  Intent: ..
```

If we use `ChatGLMVLLM` as the vision model, first log in to [Zhipu AI](https://bigmodel.cn/usercenter/proj-mgmt/apikeys) and apply for an API key. If you already have one, you can reuse it.

Add the following config to your file, or fill in `api_key` if it already exists:

```yaml
VLLM:
  ChatGLMVLLM:
    api_key: your_api_key
```

### Step 3: Start the `xiaozhi-server` service

If you are running from source, start it with:
```bash
python app.py
```
If you are using Docker, restart the container:
```bash
docker restart xiaozhi-esp32-server
```

After startup, you should see logs like this:

```text
2025-06-01 **** - OTA interface:           http://192.168.4.7:8003/xiaozhi/ota/
2025-06-01 **** - Vision analysis interface: http://192.168.4.7:8003/mcp/vision/explain
2025-06-01 **** - WebSocket address:       ws://192.168.4.7:8000/xiaozhi/v1/
2025-06-01 **** - =======The above address is a WebSocket URL; do not open it in a browser=======
2025-06-01 **** - If you want to test WebSocket, start the digital-human module and open the browser interaction test
2025-06-01 **** - =============================================================
```

After startup, open the `vision analysis interface` URL from the logs in a browser and see what it returns. If you are on Linux and do not have a browser, you can run:
```bash
curl -i your_vision_analysis_interface
```

Normally it should look like this:
```text
MCP Vision interface is running normally, and the vision explanation interface address is: http://xxxx:8003/mcp/vision/explain
```

Note: if you are deploying publicly, or using Docker, you must update this config in `data/.config.yaml`:
```yaml
server:
  vision_explain: http://your_ip_or_domain:port/mcp/vision/explain
```

Why? Because the vision explanation interface is sent to the device, and if the address is a LAN address or a Docker-internal address, the device cannot access it.

If your public address is `111.111.111.111`, then `vision_explain` should be configured like this:

```yaml
server:
  vision_explain: http://111.111.111.111:8003/mcp/vision/explain
```

If the MCP Vision interface is working normally, and you can also open the delivered `vision explanation interface address` in a browser successfully, continue to the next step.

### Step 4: Wake up the device

Say to the device: “Please turn on the camera and tell me what you see.”

Watch the `xiaozhi-server` logs for any errors.

## Enabling the vision model in full-module mode

### Step 1: Check the network

The vision model uses port `8003` by default.

If you are using Docker, make sure your `docker-compose_all.yml` exposes port `8003`. If not, update to the latest `docker-compose_all.yml`.

If you are running from source, make sure your firewall allows port `8003`.

### Step 2: Check your configuration file

Open `data/.config.yaml` and confirm that its structure matches `data/config_from_api.yaml`. If it does not, or if anything is missing, fill it in.

### Step 3: Configure the vision model API key

First, log in to [Zhipu AI](https://bigmodel.cn/usercenter/proj-mgmt/apikeys) and apply for an API key. If you already have one, you can reuse it.

Log in to the control panel, click `Model Configuration` in the top menu, then click `Vision Large Language Model` in the left sidebar. Find `VLLM_ChatGLMVLLM`, click the edit button, enter your API key in the `API Key` field, and save.

After saving successfully, go to the agent you want to test, click `Configure Role`, and check whether `Vision Large Language Model (VLLM)` is set to the vision model you just configured. Click save.

### Step 4: Start the `xiaozhi-server` module

If you are using source code, run:
```bash
python app.py
```
If you are using Docker, restart the container:
```bash
docker restart xiaozhi-esp32-server
```

After startup, you should see logs like this:
```text
2025-06-01 **** - Vision analysis interface: http://192.168.4.7:8003/mcp/vision/explain
2025-06-01 **** - WebSocket address:       ws://192.168.4.7:8000/xiaozhi/v1/
2025-06-01 **** - =======The above address is a WebSocket URL; do not open it in a browser=======
2025-06-01 **** - If you want to test WebSocket, start the digital-human module and open the browser interaction test
2025-06-01 **** - =============================================================
```

After startup, use a browser to open the `vision analysis interface` URL from the logs. If you are on Linux and do not have a browser, you can run:
```bash
curl -i your_vision_analysis_interface
```

Normally it should look like this:
```text
MCP Vision interface is running normally, and the vision explanation interface address is: http://xxxx:8003/mcp/vision/explain
```

Please note: if you are deploying on a public server or using Docker, be sure to update this config in `data/.config.yaml`:
```yaml
server:
  vision_explain: http://your_ip_or_domain:port/mcp/vision/explain
```

Why? Because the vision explanation interface is delivered to the device, and if the address is a LAN address or Docker-internal address, the device cannot access it.

If your public address is `111.111.111.111`, then `vision_explain` should be configured like this:

```yaml
server:
  vision_explain: http://111.111.111.111:8003/mcp/vision/explain
```

If the MCP Vision interface is working correctly and you can successfully open the delivered `vision explanation interface address` in a browser, continue to the next step.

### Step 5: Wake up the device

Say to the device: “Please open the camera and tell me what you see.”

Watch the `xiaozhi-server` logs for any errors.
