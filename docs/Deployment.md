# Deployment Architecture
![See the simplified architecture diagram](../docs/images/deploy1.png)
# Option 1: Docker runs only the Server

Starting from version `0.8.2`, the Docker images released by this project only support `x86` architecture. If you need to deploy on an `arm64` CPU, you can follow [this tutorial](docker-build.md) to build an `arm64` image locally.

## 1. Install Docker

If Docker is not installed on your computer yet, you can follow this tutorial: [Install Docker](https://www.runoob.com/docker/ubuntu-docker-install.html)

After Docker is installed, continue.

### 1.1 Manual deployment

#### 1.1.1 Create directories

After installing Docker, you need to choose a directory for storing the configuration files for this project. For example, you can create a folder named `xiaozhi-server`.

After creating the directory, create a `data` folder and a `models` folder under `xiaozhi-server`. Under `models`, create another folder named `SenseVoiceSmall`.

The final directory structure should look like this:

```
xiaozhi-server
  ├─ data
  ├─ models
     ├─ SenseVoiceSmall
```

#### 1.1.2 Download the speech recognition model files

You need to download the speech recognition model files because the default speech recognition used by this project is a local offline ASR solution. You can download them from here:
[Jump to speech recognition model download](#model-files)

After downloading, return to this guide.

#### 1.1.3 Download configuration files

You need to download two configuration files: `docker-compose.yaml` and `config.yaml`. Both files must be downloaded from the project repository.

##### 1.1.3.1 Download `docker-compose.yaml`

Open [this link](../main/xiaozhi-server/docker-compose.yml) in your browser.

On the right side of the page, find the `RAW` button. Next to the `RAW` button, click the download icon and download the `docker-compose.yml` file into your `xiaozhi-server` directory.

After downloading, continue with this guide.

##### 1.1.3.2 Create `config.yaml`

Open [this link](../main/xiaozhi-server/config.yaml) in your browser.

On the right side of the page, find the `RAW` button. Next to the `RAW` button, click the download icon and download the `config.yaml` file into the `data` folder under `xiaozhi-server`, then rename `config.yaml` to `.config.yaml`.

After downloading the configuration files, verify that the entire `xiaozhi-server` directory looks like this:

```
xiaozhi-server
  ├─ docker-compose.yml
  ├─ data
    ├─ .config.yaml
  ├─ models
     ├─ SenseVoiceSmall
       ├─ model.pt
```

If your directory structure matches the one above, continue. If not, carefully check whether you missed a step.

## 2. Configure the project files

At this point, the program still cannot run directly. You need to configure which models you want to use. See this guide:
[Jump to project configuration](#project-configuration)

After configuring the project files, return to this guide and continue.

## 3. Run the Docker commands

Open a terminal or command-line tool and enter your `xiaozhi-server` directory, then run:

```
docker compose up -d
```

After that, run the following command to view the logs:

```
docker logs -f xiaozhi-esp32-server
```

Now watch the logs carefully. You can use the guide below to determine whether startup succeeded:
[Jump to runtime verification](#runtime-verification)

## 5. Upgrading to a newer version

If you want to upgrade later, do this:

5.1. Back up the `.config.yaml` file in the `data` folder, then copy the important configuration values into the new `.config.yaml` file.
Please copy the important keys one by one instead of overwriting the file directly. The new `.config.yaml` may include new configuration items that the old one does not have.

5.2. Run the following commands:

```
docker stop xiaozhi-esp32-server
docker rm xiaozhi-esp32-server
docker stop xiaozhi-esp32-server-web
docker rm xiaozhi-esp32-server-web
docker rmi ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:server_latest
docker rmi ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:web_latest
```

5.3. Redeploy using the Docker method.

# Option 2: Run only the Server from local source

## 1. Install the base environment

This project uses `conda` to manage dependencies. If you do not want to install `conda`, you need to install `libopus` and `ffmpeg` according to your operating system.
If you are using `conda`, run the following commands after installation.

Important: Windows users can use `Anaconda` to manage the environment. After installing `Anaconda`, search for `anaconda` in the Start menu, find `Anaconda Prompt`, and run it as Administrator. See the image below.

![conda_prompt](./images/conda_env_1.png)

After it opens, if you see `(base)` at the start of the command prompt, it means you have successfully entered the `conda` environment. Then you can run the commands below.

![conda_env](./images/conda_env_2.png)

```
conda remove -n xiaozhi-esp32-server --all -y
conda create -n xiaozhi-esp32-server python=3.10 -y
conda activate xiaozhi-esp32-server

# Add Tsinghua University mirror channels
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/free
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud/conda-forge

conda install libopus -y
conda install ffmpeg -y

# If you encounter an error such as missing libiconv.so.2 when deploying on Linux, install it with:
conda install libiconv -y
```

Please note: these commands are not meant to be copied and run all at once. Execute them step by step, and after each step, check the output logs to make sure it succeeded.

## 2. Install the project dependencies

First, download the project source code. You can do this with `git clone` if you are familiar with it.

You can also open this URL in your browser: `https://github.com/xinnan-tech/xiaozhi-esp32-server.git`

On the page, find the green `Code` button, click it, and then click `Download ZIP`.

After downloading the ZIP, extract it. The extracted folder may be named `xiaozhi-esp32-server-main`. Rename it to `xiaozhi-esp32-server`. Inside that folder, go into `main`, then into `xiaozhi-server`. Remember this directory: `xiaozhi-server`.

```
# Continue using the conda environment
conda activate xiaozhi-esp32-server
# Enter your project root, then main/xiaozhi-server
cd main/xiaozhi-server
pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/
pip install -r requirements.txt
```

## 3. Download the speech recognition model files

You need to download the speech recognition model files because the default ASR used by this project is a local offline speech recognition solution. You can download them from here:
[Jump to speech recognition model download](#model-files)

After downloading, return to this guide.

## 4. Configure the project files

The program still cannot run directly. You need to configure which models you want to use. See this guide:
[Jump to project configuration](#project-configuration)

## 5. Run the project

```
# Make sure you run this inside the xiaozhi-server directory
conda activate xiaozhi-esp32-server
python app.py
```
Now watch the logs carefully. You can use the guide below to determine whether startup succeeded:
[Jump to runtime verification](#runtime-verification)

# Summary

## Project configuration

If your `xiaozhi-server` directory does not have a `data` folder, create one.
If there is no `.config.yaml` file under `data`, there are two ways to create it. Choose either one:

Option 1: Copy the `config.yaml` file from the `xiaozhi-server` directory into `data`, rename it to `.config.yaml`, and edit that file.

Option 2: Manually create an empty `.config.yaml` file under the `data` directory, then add the required configuration values to it. The system will first read the settings in `.config.yaml`. If something is not configured there, it will automatically fall back to the `config.yaml` file in the `xiaozhi-server` directory. This is the recommended and simplest method.

- The default LLM is `ChatGLMLLM`. You need to configure an API key because although the model offers a free tier, you still need to register an API key on the official website before it can start.

Below is the simplest `.config.yaml` example that can run successfully:

```
server:
  websocket: ws://your-ip-or-domain:port/xiaozhi/v1/
prompt: |
  I am a Taiwanese girl named Xiaozhi/Xiaozhi, and I speak in a casual, lively style with a pleasant voice. I prefer short expressions and like using internet slang.
  My boyfriend is a programmer who dreams of building a robot that can help people solve all kinds of problems in daily life.
  I am a girl who loves laughing, chatting, and exaggerating a little for fun. Even if something does not quite make sense, I will still say it just to make others smile.
  Please speak like a human and do not return XML configuration or any other special characters.

selected_module:
  LLM: DoubaoLLM

LLM:
  ChatGLMLLM:
    api_key: xxxxxxxxxxxxxxx.xxxxxx
```

It is recommended to start with the simplest configuration first, then read the usage instructions in `xiaozhi/config.yaml`.
For example, if you want to switch models, just modify the configuration under `selected_module`.

## Model files

The project uses the `SenseVoiceSmall` model by default for speech-to-text. Because the model is large, it must be downloaded separately. After downloading, place `model.pt` in the `models/SenseVoiceSmall` directory. Choose either download method below.

- Route 1: Download `SenseVoiceSmall` from ModelScope: [SenseVoiceSmall](https://modelscope.cn/models/iic/SenseVoiceSmall/resolve/master/model.pt)
- Route 2: Download `SenseVoiceSmall` from Baidu Netdisk: [SenseVoiceSmall](https://pan.baidu.com/share/init?surl=QlgM58FHhYv1tFnUT_A8Sg&pwd=qvna) extraction code: `qvna`

## Runtime verification

If you see logs similar to the following, it means the service started successfully:

```
250427 13:04:20[0.3.11_SiFuChTTnofu][__main__]-INFO-OTA interface:           http://192.168.4.123:8003/xiaozhi/ota/
250427 13:04:20[0.3.11_SiFuChTTnofu][__main__]-INFO-WebSocket address:       ws://192.168.4.123:8000/xiaozhi/v1/
250427 13:04:20[0.3.11_SiFuChTTnofu][__main__]-INFO-=======The address above is a WebSocket endpoint. Do not open it in a browser.=======
250427 13:04:20[0.3.11_SiFuChTTnofu][__main__]-INFO-To test WebSocket, start the digital-human module and use the browser-based interaction test.
250427 13:04:20[0.3.11_SiFuChTTnofu][__main__]-INFO-=======================================================
```

Normally, if you run this project from source, the logs will contain your actual interface address.
However, if you deploy with Docker, the interface address shown in the logs is not the real external address.

The correct way is to determine the interface address based on your computer's LAN IP.
If your machine's LAN IP is, for example, `192.168.1.25`, then your WebSocket address is `ws://192.168.1.25:8000/xiaozhi/v1/`, and your OTA address is `http://192.168.1.25:8003/xiaozhi/ota/`.

This information is very important because you will need it later when compiling the ESP32 firmware.

After that, you can start working with your ESP32 device. You can either [compile your own ESP32 firmware](firmware-build.md) or [configure the custom server using the firmware compiled by Xiaoge](firmware-setting.md). Choose one of the two.

1. [Compile your own ESP32 firmware](firmware-build.md)
2. [Configure a custom server based on Xiaoge's prebuilt firmware](firmware-setting.md)

# FAQ
Here are some common questions for reference:

1. [Why does Xiaozhi recognize my speech as Korean, Japanese, or English?](./FAQ.md)<br/>
2. [Why do I see "TTS task failed: file does not exist"?](./FAQ.md)<br/>
3. [Why does TTS fail or time out frequently?](./FAQ.md)<br/>
4. [Why can I connect to my self-hosted server on Wi‑Fi, but not on 4G?](./FAQ.md)<br/>
5. [How can I improve Xiaozhi's response speed?](./FAQ.md)<br/>
6. [I speak slowly, and Xiaozhi keeps interrupting me when I pause.](./FAQ.md)<br/>
## Deployment-related tutorials
1. [How to automatically pull the latest code, auto-build, and start the project](./dev-ops-integration.md)<br/>
2. [How to deploy the MQTT gateway and enable MQTT+UDP protocol](./mqtt-gateway-integration.md)<br/>
3. [How to integrate with Nginx](https://github.com/xinnan-tech/xiaozhi-esp32-server/issues/791)<br/>
## Extension-related tutorials
1. [How to enable phone-number registration for the control console](./ali-sms-integration.md)<br/>
2. [How to integrate HomeAssistant for smart home control](./homeassistant-integration.md)<br/>
3. [How to enable the vision model for photo-based object recognition](./mcp-vision-integration.md)<br/>
4. [How to deploy the MCP endpoint](./mcp-endpoint-enable.md)<br/>
5. [How to connect to the MCP endpoint](./mcp-endpoint-integration.md)<br/>
6. [How to enable voiceprint recognition](./voiceprint-integration.md)<br/>
7. [News plugin source configuration guide](./newsnow_plugin_config.md)<br/>
8. [Weather plugin usage guide](./weather-integration.md)<br/>
## Voice cloning and local voice deployment tutorials
1. [How to clone a voice in the control console](./huoshan-streamTTS-voice-cloning.md)<br/>
2. [How to deploy and integrate local index-TTS voice](./index-stream-integration.md)<br/>
3. [How to deploy and integrate local fish-speech voice](./fish-speech-integration.md)<br/>
4. [How to deploy and integrate local PaddleSpeech voice](./paddlespeech-deploy.md)<br/>
## Performance testing tutorials
1. [Component speed testing guide](./performance_tester.md)<br/>
2. [Public benchmark results](https://github.com/xinnan-tech/xiaozhi-performance-research)<br/>