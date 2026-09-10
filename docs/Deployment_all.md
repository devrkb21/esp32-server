# Deployment Architecture
![Reference: Full-Module Architecture Diagram](../docs/images/deploy2.png)
# Option 1: Run the full module with Docker

Starting from version `0.8.2`, the published Docker images only support `x86` architecture. If you need to deploy on an `arm64` CPU, follow [this guide](docker-build.md) to build an `arm64` image locally.

## 1. Install Docker

If Docker is not installed on your computer yet, follow this guide: [Docker installation](https://www.runoob.com/docker/ubuntu-docker-install.html)

There are two ways to install the full module with Docker. You can [use the one-click script](./Deployment_all.md#11-one-click-script) (by [@VanillaNahida](https://github.com/VanillaNahida)).
The script will automatically download the required files and configuration files. You can also use [manual deployment](./Deployment_all.md#12-manual-deployment) to build everything from scratch.

### 1.1 One-click script

This is the easiest option. You can also refer to the [video tutorial](https://www.bilibili.com/video/BV17bbvzHExd/). The text guide is below:

> [!NOTE]
> For now, this only supports one-click deployment on Ubuntu servers. Other systems have not been tested and may contain unexpected bugs.

Use an SSH tool to connect to the server, then run the following script as root:
```bash
sudo bash -c "$(wget -qO- https://ghfast.top/https://raw.githubusercontent.com/xinnan-tech/xiaozhi-esp32-server/main/docker-setup.sh)"
```

The script will automatically do the following:
> 1. Install Docker
> 2. Configure a mirror source
> 3. Download/pull images
> 4. Download the speech recognition model file
> 5. Guide the server configuration
>

After the script finishes and you complete the basic configuration, please continue with [4. Run the program](#4-run-the-program) and the three most important tasks mentioned in [5. Restart xiaozhi-esp32-server](#5-restart-xiaozhi-esp32-server).
Once those three configuration steps are done, the system is ready to use.

### 1.2 Manual deployment

#### 1.2.1 Create directories

After Docker is installed, create a folder to store this project's configuration files. For example, you can create a folder named `xiaozhi-server`.

Then create a `data` folder and a `models` folder inside `xiaozhi-server`. Under `models`, create another folder named `SenseVoiceSmall`.

The final directory structure should look like this:

```text
xiaozhi-server
  ├─ data
  ├─ models
     ├─ SenseVoiceSmall
```

#### 1.2.2 Download the speech recognition model file

The default speech recognition model used by this project is `SenseVoiceSmall` for speech-to-text. Because the model is large, it must be downloaded separately. After downloading, place `model.pt` inside `models/SenseVoiceSmall`.
You can choose either of the following download methods:

- Method 1: Download [SenseVoiceSmall](https://modelscope.cn/models/iic/SenseVoiceSmall/resolve/master/model.pt) from ModelScope
- Method 2: Download [SenseVoiceSmall](https://pan.baidu.com/share/init?surl=QlgM58FHhYv1tFnUT_A8Sg&pwd=qvna) from Baidu Netdisk. Extraction code: `qvna`

#### 1.2.3 Download the configuration files

You need two configuration files: `docker-compose_all.yaml` and `config_from_api.yaml`. Both must be downloaded from the repository.

##### 1.2.3.1 Download `docker-compose_all.yaml`

Open [this link](../main/xiaozhi-server/docker-compose_all.yml) in your browser.

On the right side of the page, find the `RAW` button. Next to it, find the download icon and click it to download `docker-compose_all.yml`. Put the file into your `xiaozhi-server` folder.

Or directly download it with:
```bash
wget https://raw.githubusercontent.com/xinnan-tech/xiaozhi-esp32-server/refs/heads/main/main/xiaozhi-server/docker-compose_all.yml
```

After downloading, continue with the guide.

##### 1.2.3.2 Download `config_from_api.yaml`

Open [this link](../main/xiaozhi-server/config_from_api.yaml) in your browser.

On the right side of the page, find the `RAW` button. Next to it, find the download icon and click it to download `config_from_api.yaml`. Put the file into the `data` folder under `xiaozhi-server`, then rename `config_from_api.yaml` to `.config.yaml`.

Or directly download and save it with:
```bash
wget https://raw.githubusercontent.com/xinnan-tech/xiaozhi-esp32-server/refs/heads/main/main/xiaozhi-server/config_from_api.yaml
```

After downloading the configuration files, verify that your `xiaozhi-server` directory looks like this:

```text
xiaozhi-server
  ├─ docker-compose_all.yml
  ├─ data
    ├─ .config.yaml
  ├─ models
     ├─ SenseVoiceSmall
       ├─ model.pt
```

If your directory structure matches the above, continue. If not, double-check whether something was missed.

## 2. Back up data

If you already have the console running successfully and it contains key information, copy the important data out of the console first. During the upgrade process, some original data may be overwritten.

## 3. Remove old images and containers

Open your terminal or command-line tool and enter the `xiaozhi-server` directory. Then run the following commands:

```bash
docker compose -f docker-compose_all.yml down

docker stop xiaozhi-esp32-server
docker rm xiaozhi-esp32-server

docker stop xiaozhi-esp32-server-web
docker rm xiaozhi-esp32-server-web

docker stop xiaozhi-esp32-server-db
docker rm xiaozhi-esp32-server-db

docker stop xiaozhi-esp32-server-redis
docker rm xiaozhi-esp32-server-redis

docker rmi ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:server_latest
docker rmi ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:web_latest
```

## 4. Run the program

Start the new containers with:

```bash
docker compose -f docker-compose_all.yml up -d
```

After that, run the following command to view the logs:

```bash
docker logs -f xiaozhi-esp32-server-web
```

When you see output like the following, it means the console has started successfully:

```text
2025-xx-xx 22:11:12.445 [main] INFO  c.a.d.s.b.a.DruidDataSourceAutoConfigure - Init DruidDataSource
2025-xx-xx 21:28:53.873 [main] INFO  xiaozhi.AdminApplication - Started AdminApplication in 16.057 seconds (process running for 17.941)
http://localhost:8002/xiaozhi/doc.html
```

At this stage, only the console is running successfully. If port `8000` shows an error for `xiaozhi-esp32-server`, ignore it for now.

Now open the console in your browser: `http://127.0.0.1:8002`. Register the first user. The first user becomes the super administrator. All later users are normal users. Normal users can only bind devices and configure agents; the super administrator can manage models, users, and parameters.

Now you need to do three important things:

### The first important thing

Log in to the console with the super administrator account. In the top menu, find `Parameter Management`. In the first row of the list, find the parameter code `server.secret` and copy its value to `Parameter Value`.

A quick note about `server.secret`: this value is very important. It is used to let the `Server` side connect to `manager-api`. `server.secret` is a randomly generated key that is created every time the manager module is deployed from scratch.

After copying the value, open the `.config.yaml` file inside the `data` directory under `xiaozhi-server`. The file should look like this:

```yaml
manager-api:
  url:  http://127.0.0.1:8002/xiaozhi
  secret: your server.secret value
```

1. Copy the `server.secret` value you just copied from the console into the `secret` field in `.config.yaml`.
2. Because you are deploying with Docker, change `url` to `http://xiaozhi-esp32-server-web:8002/xiaozhi`.
3. Because you are deploying with Docker, change `url` to `http://xiaozhi-esp32-server-web:8002/xiaozhi`.
4. Because you are deploying with Docker, change `url` to `http://xiaozhi-esp32-server-web:8002/xiaozhi`.

The final result should look like this:
```yaml
manager-api:
  url: http://xiaozhi-esp32-server-web:8002/xiaozhi
  secret: 12345678-xxxx-xxxx-xxxx-123456789000
```

Save the file, then continue to the second important thing.

### The second important thing

Log in to the console with the super administrator account. In the top menu, find `Model Configuration`. In the left sidebar, click `Large Language Model`. Find the first entry `Zhipu AI`, click `Edit`, then enter your registered Zhipu AI API key into the `API Key` field and save it.

## 5. Restart xiaozhi-esp32-server

Open your terminal or command-line tool and run:
```bash
docker restart xiaozhi-esp32-server
docker logs -f xiaozhi-esp32-server
```
If you see logs like the following, the Server has started successfully:

```text
25-02-23 12:01:09[core.websocket_server] - INFO - Websocket address is      ws://xxx.xx.xx.xx:8000/xiaozhi/v1/
25-02-23 12:01:09[core.websocket_server] - INFO - =======The address above is a websocket protocol address. Do not open it in a browser.=======
25-02-23 12:01:09[core.websocket_server] - INFO - If you want to test websocket, start the digital-human module and use the browser interaction test.
25-02-23 12:01:09[core.websocket_server] - INFO - =======================================================
```

Because this is a full-module deployment, you need to write two important endpoints into the ESP32 configuration.

OTA endpoint:
```text
http://your host machine LAN IP:8002/xiaozhi/ota/
```

Websocket endpoint:
```text
ws://your host machine IP:8000/xiaozhi/v1/
```

### The third important thing

Log in to the console with the super administrator account. In the top menu, find `Parameter Management`. Find the parameter code `server.websocket` and enter your `Websocket endpoint`.

Log in to the console with the super administrator account. In the top menu, find `Parameter Management`. Find the parameter code `server.ota` and enter your `OTA endpoint`.

Now you can start working with your ESP32 device. You can either compile the ESP32 firmware yourself or use the prebuilt firmware version `1.6.1` or later from Xiaoge. Choose either option:

1. [Compile your own ESP32 firmware](firmware-build.md)
2. [Configure a custom server using Xiaoge's prebuilt firmware](firmware-setting.md)

# Option 2: Run the full module from local source

## 1. Install the MySQL database

If MySQL is already installed locally, you can create a database named `xiaozhi_esp32_server` directly:

```sql
CREATE DATABASE xiaozhi_esp32_server CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

If MySQL is not installed yet, you can install it with Docker:

```bash
docker run --name xiaozhi-esp32-server-db -e MYSQL_ROOT_PASSWORD=123456 -p 3306:3306 -e MYSQL_DATABASE=xiaozhi_esp32_server -e MYSQL_INITDB_ARGS="--character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci" -e TZ=Asia/Shanghai -d mysql:latest
```

## 2. Install Redis

If Redis is not installed yet, you can install it with Docker:

```bash
docker run --name xiaozhi-esp32-server-redis -d -p 6379:6379 redis
```

## 3. Run the manager-api program

3.1 Install JDK 21 and set the JDK environment variables.

3.2 Install Maven and set the Maven environment variables.

3.3 Use VS Code and install the Java-related extensions.

3.4 Use VS Code to open the `manager-api` module.

Configure the database connection in `src/main/resources/application-dev.yml`:

```yaml
spring:
  datasource:
    username: root
    password: 123456
```

Configure the Redis connection in `src/main/resources/application-dev.yml`:
```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      password:
      database: 0
```

3.5 Run the main program

This is a Spring Boot project. To start it, open `Application.java` and run the `Main` method:

```text
Path:
src/main/java/xiaozhi/AdminApplication.java
```

When you see the output logs, it means `manager-api` started successfully:

```text
2025-xx-xx 22:11:12.445 [main] INFO  c.a.d.s.b.a.DruidDataSourceAutoConfigure - Init DruidDataSource
2025-xx-xx 21:28:53.873 [main] INFO  xiaozhi.AdminApplication - Started AdminApplication in 16.057 seconds (process running for 17.941)
http://localhost:8002/xiaozhi/doc.html
```

## 4. Run the manager-web program

4.1 Install Node.js.

4.2 Use VS Code to open the `manager-web` module.

Open a terminal and go to the `manager-web` directory:

```bash
npm install
```
Then start it:
```bash
npm run serve
```

Note: if your `manager-api` endpoint is not `http://localhost:8002`, update the path in `main/manager-web/.env.development` during development.

After it starts successfully, open the console in your browser: `http://127.0.0.1:8001`. Register the first user. The first user becomes the super administrator. All later users are normal users. Normal users can only bind devices and configure agents; the super administrator can manage models, users, and parameters.

Important: After registration succeeds, log in with the super administrator account. In the top menu, find `Model Configuration`. In the left sidebar, click `Large Language Model`. Find the first entry `Zhipu AI`, click `Edit`, then enter your registered Zhipu AI API key into the `API Key` field and save it.

Important: After registration succeeds, log in with the super administrator account. In the top menu, find `Model Configuration`. In the left sidebar, click `Large Language Model`. Find the first entry `Zhipu AI`, click `Edit`, then enter your registered Zhipu AI API key into the `API Key` field and save it.

Important: After registration succeeds, log in with the super administrator account. In the top menu, find `Model Configuration`. In the left sidebar, click `Large Language Model`. Find the first entry `Zhipu AI`, click `Edit`, then enter your registered Zhipu AI API key into the `API Key` field and save it.

## 5. Install the Python environment

This project uses `conda` to manage dependencies. If you do not want to install `conda`, you need to install `libopus` and `ffmpeg` according to your operating system.
If you do use `conda`, then run the following commands after installation.

Important for Windows users: you can manage the environment with `Anaconda`. After installing `Anaconda`, search for `anaconda` in the Start menu, find `Anaconda Prompt`, and run it as Administrator. Like this:

![conda_prompt](./images/conda_env_1.png)

After it opens, if you see `(base)` at the beginning of the terminal prompt, that means you have successfully entered the `conda` environment. Then you can run these commands:

![conda_env](./images/conda_env_2.png)

```bash
conda remove -n xiaozhi-esp32-server --all -y
conda create -n xiaozhi-esp32-server python=3.10 -y
conda activate xiaozhi-esp32-server

# Add the Tsinghua mirror channels
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/free
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/cloud/conda-forge

conda install libopus -y
conda install ffmpeg -y

# On Linux, if you get an error like missing libiconv.so.2, install it with:
conda install libiconv -y
```

Please note: these commands are not meant to be run all at once. Execute them step by step, and check the log after each step to make sure it succeeded.

## 6. Install the project dependencies

First, download the project source code. You can use `git clone` if you are familiar with it.

You can also open this address in your browser: `https://github.com/xinnan-tech/xiaozhi-esp32-server.git`

After it opens, find the green `Code` button, click it, and then you will see the `Download ZIP` option.

Click it to download the source archive. After downloading, extract it. The extracted folder may be named `xiaozhi-esp32-server-main`.
You should rename it to `xiaozhi-esp32-server`, then go into the `main` folder, then into `xiaozhi-server`. Remember this directory: `xiaozhi-server`.

```bash
# Continue using the conda environment
conda activate xiaozhi-esp32-server
# Go to your project root, then into main/xiaozhi-server
cd main/xiaozhi-server
pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/
pip install -r requirements.txt
```

### 7. Download the speech recognition model file

The default speech recognition model is `SenseVoiceSmall` for speech-to-text. Because the model is large, it must be downloaded separately. After downloading, place `model.pt` inside `models/SenseVoiceSmall`.
You can choose either of the following routes:

- Route 1: Download [SenseVoiceSmall](https://modelscope.cn/models/iic/SenseVoiceSmall/resolve/master/model.pt) from ModelScope
- Route 2: Download [SenseVoiceSmall](https://pan.baidu.com/share/init?surl=QlgM58FHhYv1tFnUT_A8Sg&pwd=qvna) from Baidu Netdisk. Extraction code: `qvna`

## 8. Configure the project files

Log in to the console with the super administrator account. In the top menu, find `Parameter Management`. In the first row of the list, find the parameter code `server.secret` and copy its value to `Parameter Value`.

A quick note about `server.secret`: this value is very important. It is used to let the `Server` side connect to `manager-api`. `server.secret` is a randomly generated key that is created every time the manager module is deployed from scratch.

If your `xiaozhi-server` directory does not contain `data`, create the `data` directory.
If there is no `.config.yaml` file under `data`, you can copy `config_from_api.yaml` from the `xiaozhi-server` directory into `data` and rename it to `.config.yaml`.

After copying the value, open the `.config.yaml` file inside the `data` directory under `xiaozhi-server`. The file should look like this:

```yaml
manager-api:
  url: http://127.0.0.1:8002/xiaozhi
  secret: your server.secret value
```

Copy the `server.secret` value you just copied from the console into the `secret` field in `.config.yaml`.

The final result should look like this:
```yaml
manager-api:
  url: http://127.0.0.1:8002/xiaozhi
  secret: 12345678-xxxx-xxxx-xxxx-123456789000
```

## 9. Run the project

```bash
# Make sure you run this inside the xiaozhi-server directory
conda activate xiaozhi-esp32-server
python app.py
```

If you see logs like the following, it means the service started successfully:

```text
25-02-23 12:01:09[core.websocket_server] - INFO - Server is running at ws://xxx.xx.xx.xx:8000/xiaozhi/v1/
25-02-23 12:01:09[core.websocket_server] - INFO - =======The address above is a websocket protocol address. Do not open it in a browser.=======
25-02-23 12:01:09[core.websocket_server] - INFO - If you want to test websocket, start the digital-human module and use the browser interaction test.
25-02-23 12:01:09[core.websocket_server] - INFO - =======================================================
```

Because this is a full-module deployment, you have two important endpoints.

OTA endpoint:
```text
http://your computer LAN IP:8002/xiaozhi/ota/
```

Websocket endpoint:
```text
ws://your computer LAN IP:8000/xiaozhi/v1/
```

Please make sure to write the above two endpoint addresses into the console; they affect websocket address issuance and automatic upgrade functionality.

1. Log in to the console with the super administrator account. In the top menu, find `Parameter Management`. Find the parameter code `server.websocket` and enter your `Websocket endpoint`.

2. Log in to the console with the super administrator account. In the top menu, find `Parameter Management`. Find the parameter code `server.ota` and enter your `OTA endpoint`.

Now you can start working with your ESP32 device. You can either compile the ESP32 firmware yourself or use the prebuilt firmware version `1.6.1` or later from Xiaoge. Choose either option:

1. [Compile your own ESP32 firmware](firmware-build.md)
2. [Configure a custom server using Xiaoge's prebuilt firmware](firmware-setting.md)

# FAQ
Here are some common questions for reference:

1. [Why does Xiaozhi recognize a lot of Korean, Japanese, or English when I speak?](./FAQ.md)<br/>
2. [Why does the error “TTS task failed: file does not exist” appear?](./FAQ.md)<br/>
3. [Why does TTS often fail or time out?](./FAQ.md)<br/>
4. [I can connect to my self-hosted server over Wi‑Fi, but not over 4G](./FAQ.md)<br/>
5. [How can I improve Xiaozhi's response speed?](./FAQ.md)<br/>
6. [When I speak slowly and pause, Xiaozhi keeps interrupting me](./FAQ.md)<br/>

## Deployment-related tutorials
1. [How to automatically pull the latest code, build, and start this project](./dev-ops-integration.md)<br/>
2. [How to deploy the MQTT gateway to enable MQTT+UDP protocol](./mqtt-gateway-integration.md)<br/>
3. [How to integrate with Nginx](https://github.com/xinnan-tech/xiaozhi-esp32-server/issues/791)<br/>

## Extension-related tutorials
1. [How to enable phone number registration for the console](./ali-sms-integration.md)<br/>
2. [How to integrate HomeAssistant for smart home control](./homeassistant-integration.md)<br/>
3. [How to enable the vision model for image recognition](./mcp-vision-integration.md)<br/>
4. [How to deploy the MCP endpoint](./mcp-endpoint-enable.md)<br/>
5. [How to connect to the MCP endpoint](./mcp-endpoint-integration.md)<br/>
6. [How to enable voiceprint recognition](./voiceprint-integration.md)<br/>
7. [News plugin source configuration guide](./newsnow_plugin_config.md)<br/>
8. [Weather plugin user guide](./weather-integration.md)<br/>

## Voice cloning and local voice deployment tutorials
1. [How to clone a voice in the console](./huoshan-streamTTS-voice-cloning.md)<br/>
2. [How to deploy integrated index-tts local voice](./index-stream-integration.md)<br/>
3. [How to deploy integrated fish-speech local voice](./fish-speech-integration.md)<br/>
4. [How to deploy integrated PaddleSpeech local voice](./paddlespeech-deploy.md)<br/>

## Performance testing tutorials
1. [Component speed test guide](./performance_tester.md)<br/>
2. [Regular public test results](https://github.com/xinnan-tech/xiaozhi-performance-research)<br/>
