Log in to AutoDL and rent an image.
Choose this image:
```text
PyTorch / 2.1.0 / 3.10 (ubuntu22.04) / cuda 12.1
```

After the machine starts, enable academic acceleration:
```bash
source /etc/network_turbo
```

Enter the working directory:
```bash
cd autodl-tmp/
```

Clone the project:
```bash
git clone https://gitclone.com/github.com/fishaudio/fish-speech.git ; cd fish-speech
```

Install dependencies:
```bash
pip install -e.
```

If you get an error, install portaudio:
```bash
apt-get install portaudio19-dev -y
```

After installation, run:
```bash
pip install torch==2.3.1 torchvision==0.18.1 torchaudio==2.3.1 --index-url https://download.pytorch.org/whl/cu121
```

Download the models:
```bash
cd tools
python download_models.py
```

After the models are downloaded, start the API server:
```bash
python -m tools.api_server --listen 0.0.0.0:6006
```

Then open the AutoDL instance page in your browser:
```text
https://autodl.com/console/instance/list
```

Click the `Custom Service` button for the machine you just started, and enable port forwarding.
![Custom Service](images/fishspeech/autodl-01.png)

After port forwarding is configured, open `http://localhost:6006/` on your local computer to access the fish-speech API.
![Service Preview](images/fishspeech/autodl-02.png)

If you are doing a single-module deployment, the core configuration looks like this:
```yaml
selected_module:
  TTS: FishSpeech
TTS:
  FishSpeech:
    reference_audio: ["config/assets/wakeup_words.wav",]
    reference_text: ["Hello, I’m Xiaozhi — a cheerful Taiwanese girl with a nice voice. Nice to meet you! What have you been busy with lately? Don’t forget to bring me something interesting; I love gossip.",]
    api_key: "123"
    api_url: "http://127.0.0.1:6006/v1/tts"
```

Then restart the service.
