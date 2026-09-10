# Digital Human `digital-human` Startup Guide

## Overview

The test page includes a high-accuracy wake-word feature based on **Sherpa-ONNX**, supporting custom wake words and real-time detection. It uses a lightweight keyword detection model and provides millisecond-level response speed.

## Wake-word Model

### Model Download (Required)

**Important:** The project does not include model files. You must download and configure them in advance.

### Official Model Download Links

- **Official model list**: <https://csukuangfj.github.io/sherpa/onnx/kws/pretrained_models/index.html>
- **Recommended model**: `sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01`

### Download and Setup Steps

#### 1. Download the model package

```bash
# Method 1: direct download (recommended)
cd main/digital-human/wakeword_runtime/
wget https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01.tar.bz2

# Extract
tar xvf sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01.tar.bz2

# Method 2: use ModelScope
pip install modelscope
python -c "
from modelscope import snapshot_download
snapshot_download('pkufool/sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01', cache_dir='./models')
"
```

#### 2. Configure model files

After extraction, the package contains the following files:

```text
sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01/
├── encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx    # speed-first
├── encoder-epoch-12-avg-2-chunk-16-left-64.onnx
├── encoder-epoch-99-avg-1-chunk-16-left-64.int8.onnx    # speed-first
├── encoder-epoch-99-avg-1-chunk-16-left-64.onnx         # accuracy-first
├── decoder-epoch-12-avg-2-chunk-16-left-64.onnx
├── decoder-epoch-99-avg-1-chunk-16-left-64.onnx         # accuracy-first
├── joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx     # speed-first
├── joiner-epoch-12-avg-2-chunk-16-left-64.onnx
├── joiner-epoch-99-avg-1-chunk-16-left-64.int8.onnx     # speed-first
├── joiner-epoch-99-avg-1-chunk-16-left-64.onnx          # accuracy-first
├── tokens.txt                    # token mapping table (required)
├── keywords_raw.txt              # may be included in the package (optional, runtime does not require it)
├── keywords.txt                  # ready-made file
├── test_wavs/                    # test audio (optional)
├── configuration.json            # model metadata (optional)
└── README.md                     # documentation (optional)
```

#### 3. Choose a configuration plan

**Option 1: accuracy-first (recommended)**

```bash
cd sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01

# Create the model directory
mkdir -p ../models

# Copy the accuracy-first epoch-99 fp32 trio
cp encoder-epoch-99-avg-1-chunk-16-left-64.onnx ../models/encoder.onnx
cp decoder-epoch-99-avg-1-chunk-16-left-64.onnx ../models/decoder.onnx
cp joiner-epoch-99-avg-1-chunk-16-left-64.onnx ../models/joiner.onnx

# Copy supporting files
cp tokens.txt ../models/tokens.txt
# Keep keywords_raw.txt if the package includes it; runtime does not depend on it
```

**Option 2: speed-first**

```bash
cd sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01

# Create the model directory
mkdir -p ../models

# Copy the speed-first epoch-99 int8 trio
cp encoder-epoch-99-avg-1-chunk-16-left-64.int8.onnx ../models/encoder.onnx
cp decoder-epoch-99-avg-1-chunk-16-left-64.onnx ../models/decoder.onnx
cp joiner-epoch-99-avg-1-chunk-16-left-64.int8.onnx ../models/joiner.onnx

# Copy supporting files
cp tokens.txt ../models/tokens.txt
```

**Notes:**

- **Do not mix fp32 and int8**: all three model files must use the same precision.
- **Prefer epoch-99**: it is trained more thoroughly than epoch-12 and usually gives better accuracy.
- **Required files**: `encoder.onnx` + `decoder.onnx` + `joiner.onnx` + `tokens.txt` + `keywords.txt`

### Final model file structure

After setup, the model files should be placed in the `wakeword_runtime/models/` directory, with the full path `main/digital-human/wakeword_runtime/models/`:

```text
wakeword_runtime/models/
├── encoder.onnx      # encoder model (renamed)
├── decoder.onnx      # decoder model (renamed)
├── joiner.onnx       # joiner model (renamed)
├── tokens.txt        # token mapping table (228-line version)
├── keywords.txt      # keyword config file (generated on first launch)
└── keywords_raw.txt  # optional, runtime does not depend on it
```

## Launch Method

Run the following in the `main/digital-human` directory:

```bash
pip install -r wakeword_runtime/requirements.txt
python start.py
```

After startup, the default endpoints are:

- Page: `http://127.0.0.1:8006/index.html`
- Event bridge: `ws://127.0.0.1:8006/wakeword-ws`
- Health check: `http://127.0.0.1:8006/health`

Stop the service by:

- Pressing `Ctrl+C` in the running terminal
- This stops the static page server, event bridge, and wake-word detection pipeline together

## Configuration File Notes

The configuration file is located at [main/digital-human/wakeword_runtime/config.json](../main/digital-human/wakeword_runtime/config.json).

Current main settings:

```json
{
  "wakeword": {
    "enabled": true
  },
  "model_dir": "models",
  "audio": {
    "input_device": null,
    "sample_rate": 16000,
    "channels": 1
  },
  "detector": {
    "num_threads": 4,
    "provider": "cpu",
    "max_active_paths": 2,
    "keywords_score": 1.8,
    "keywords_threshold": 0.1,
    "num_trailing_blanks": 1,
    "cooldown_seconds": 1.5
  },
  "logging": {
    "level": "INFO",
    "dir": "logs",
    "file": "wakeword-runtime.log"
  }
}
```

Field meanings:

| Parameter | Description |
| --- | --- |
| `wakeword.enabled` | Whether to enable local wake-word detection |
| `model_dir` | Directory containing the model and token files |
| `audio.input_device` | Microphone input device; defaults to the system default device |
| `audio.sample_rate` | Sample rate, default `16000` |
| `audio.channels` | Number of channels, default `1` |
| `detector.num_threads` | Number of detector threads |
| `detector.provider` | Inference provider, usually `cpu` |
| `detector.max_active_paths` | Number of active search paths |
| `detector.keywords_score` | Keyword boosting score |
| `detector.keywords_threshold` | Detection threshold |
| `detector.num_trailing_blanks` | Number of trailing blanks |
| `detector.cooldown_seconds` | Cooldown time between repeated triggers |
| `logging.level` | Log level |
| `logging.dir` | Log directory |
| `logging.file` | Log file name |

## Recommended Workflow

### First Use

1. Prepare the model files and `tokens.txt` under `models/`
2. Confirm that `models/keywords.txt` exists
3. Run `python start.py` in the `digital-human` directory
4. Open `http://127.0.0.1:8006/index.html` in your browser
5. Open the settings page and check the wake-word configuration

### Change the Wake Word

1. Open the settings page in Digital Human
2. Go to the "Wake Word" tab
3. Change the enabled state or the wake-word list
4. Click **Apply Wake Word**
5. Follow the prompt to decide whether to restart immediately

### Disable the Wake Word

1. Switch "Enable local wake word" to disabled
2. Click **Apply Wake Word**
3. A restart is recommended

After disabling:

- The page and event bridge still work
- Wake-word detection will stop running
