# PaddleSpeech TTS Integration with Xiaozhi

## Key notes
- Pros: local offline deployment, fast response
- Cons: as of 2025-09-25, the default model is a Chinese model and does not support converting English to speech. If the text contains English, it may produce no sound. If you need both Chinese and English support, you must train your own model.

## 1. Basic requirements
Operating systems: Windows / Linux / WSL 2

Python version: 3.9 or later (adjust according to the official Paddle tutorial)

Paddle version: latest official release  
https://www.paddlepaddle.org.cn/install

Dependency manager: conda or venv

## 2. Start the PaddleSpeech service
### 1) Clone the official PaddleSpeech repository
```bash
git clone https://github.com/PaddlePaddle/PaddleSpeech.git
```
### 2) Create a virtual environment
```bash
conda create -n paddle_env python=3.10 -y
conda activate paddle_env
```
### 3) Install Paddle
Because CPU and GPU architectures differ, create the environment according to the Python versions supported by Paddle.  
```
https://www.paddlepaddle.org.cn/install
```
### 4) Enter the PaddleSpeech directory
```bash
cd PaddleSpeech
```
### 5) Install PaddleSpeech
```bash
pip install pytest-runner -i https://pypi.tuna.tsinghua.edu.cn/simple

# Use either of the following commands
pip install paddlepaddle -i https://mirror.baidu.com/pypi/simple
pip install paddlespeech -i https://pypi.tuna.tsinghua.edu.cn/simple
```
### 6) Download the speech model automatically
```bash
paddlespeech tts --input "Hello, this is a test"
```
This step will automatically download the model cache into the local `.paddlespeech/models` directory.

### 7) Edit `tts_online_application.yaml`
Refer to `PaddleSpeech/demos/streaming_tts_server/conf/tts_online_application.yaml`.
Open `tts_online_application.yaml` in an editor and set `protocol` to `websocket`.

### 8) Start the service
```yaml
paddlespeech_server start --config_file ./demos/streaming_tts_server/conf/tts_online_application.yaml
# Official default start command:
paddlespeech_server start --config_file ./conf/tts_online_application.yaml
```
Use the command that matches your actual `tts_online_application.yaml` location. The service starts successfully when you see logs like these:
```
Prefix dict has been built successfully.
[2025-08-07 10:03:11,312] [   DEBUG] __init__.py:166 - Prefix dict has been built successfully.
INFO:     Started server process [2298]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8092 (Press CTRL+C to quit)
```

## 3. Update Xiaozhi configuration files
### 1) `main/xiaozhi-server/core/providers/tts/paddle_speech.py`

### 2) `main/xiaozhi-server/data/.config.yaml`
Use single-module deployment:
```yaml
selected_module:
  TTS: PaddleSpeechTTS
TTS:
  PaddleSpeechTTS:
      type: paddle_speech
      protocol: websocket 
      url: ws://127.0.0.1:8092/paddlespeech/tts/streaming  # TTS service URL, pointing to the local server [websocket default ws://127.0.0.1:8092/paddlespeech/tts/streaming]
      spk_id: 0  # Speaker ID, 0 usually means the default speaker
      sample_rate: 24000  # Sample rate [websocket default 24000, http default 0 auto-select]
      speed: 1.0  # Speech speed, 1.0 is normal, >1 faster, <1 slower
      volume: 1.0  # Volume, 1.0 is normal, >1 louder, <1 quieter
      save_path:   # Save path
```
### 3) Start the Xiaozhi service
```py
python app.py
```
After starting `python start.py` under `main/digital-human`, open `http://127.0.0.1:8006/index.html` and test whether the PaddleSpeech side outputs logs when connecting and sending messages.

Example logs:
```
INFO:     127.0.0.1:44312 - "WebSocket /paddlespeech/tts/streaming" [accepted]
INFO:     connection open
[2025-08-07 11:16:33,355] [    INFO] - sentence: Haha, why are you suddenly chatting with me?
[2025-08-07 11:16:33,356] [    INFO] - The durations of audio is: 2.4625 s
[2025-08-07 11:16:33,356] [    INFO] - first response time: 0.1143045425415039 s
[2025-08-07 11:16:33,356] [    INFO] - final response time: 0.4777836799621582 s
[2025-08-07 11:16:33,356] [    INFO] - RTF: 0.19402382942625715
[2025-08-07 11:16:33,356] [    INFO] - Other info: front time: 0.06514096260070801 s, first am infer time: 0.008037090301513672 s, first voc infer time: 0.04112648963928223 s,
[2025-08-07 11:16:33,356] [    INFO] - Complete the synthesis of the audio streams
INFO:     connection closed
```