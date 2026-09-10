# IndexStreamTTS Guide

## Environment setup
### 1) Clone the project
```bash
git clone https://github.com/Ksuriuri/index-tts-vllm.git
```
Enter the extracted directory:
```bash
cd index-tts-vllm
```
Switch to the specified version (historical VLLM-0.10.2 version):
```bash
git checkout 224e8d5e5c8f66801845c66b30fa765328fd0be3
```

### 2) Create and activate a conda environment
```bash
conda create -n index-tts-vllm python=3.12
conda activate index-tts-vllm
```

### 3) Install PyTorch
The required version is 2.8.0 (latest).  
Check the highest GPU-supported version and your installed version:
```bash
nvidia-smi
nvcc --version
```
Example supported CUDA version:
```bash
CUDA Version: 12.8
```
Example installed CUDA compiler version:
```bash
Cuda compilation tools, release 12.8, V12.8.89
```
The corresponding installation command (PyTorch defaults to the 12.8 driver version) is:
```bash
pip install torch torchvision
```
You need PyTorch 2.8.0 (matching vllm 0.10.2). For detailed installation instructions, refer to the [official PyTorch website](https://pytorch.org/get-started/locally/).

### 4) Install dependencies
```bash
pip install -r requirements.txt
```

### 5) Download model weights
### Option 1: Download official weights and convert them
These are the official weights, which you can download to any local path. This supports IndexTTS-1.5 weights.  
| HuggingFace | ModelScope |
|---|---|
| [IndexTTS](https://huggingface.co/IndexTeam/Index-TTS) | [IndexTTS](https://modelscope.cn/models/IndexTeam/Index-TTS) |
| [IndexTTS-1.5](https://huggingface.co/IndexTeam/IndexTTS-1.5) | [IndexTTS-1.5](https://modelscope.cn/models/IndexTeam/IndexTTS-1.5) |

Below we use ModelScope as the example.  
#### Note: git-lfs must be installed and initialized (skip if already installed)
```bash
sudo apt-get install git-lfs
git lfs install
```
Create a model directory and pull the model:
```bash
mkdir model_dir
cd model_dir
git clone https://www.modelscope.cn/IndexTeam/IndexTTS-1.5.git
```

#### Convert the model weights
```bash
bash convert_hf_format.sh /path/to/your/model_dir
```
For example, if your IndexTTS-1.5 model is stored in `model_dir`, run:
```bash
bash convert_hf_format.sh model_dir/IndexTTS-1.5
```
This converts the official model weights into a format compatible with the `transformers` library and stores them under the `vllm` folder in the model path, making them available for later loading by vllm.

### 6) Adapt the API to this project
The API response is not directly compatible with the project, so you need to modify it to return audio data directly:
```bash
vi api_server.py
```
```bash
@app.post("/tts", responses={
    200: {"content": {"application/octet-stream": {}}},
    500: {"content": {"application/json": {}}}
})
async def tts_api(request: Request):
    try:
        data = await request.json()
        text = data["text"]
        character = data["character"]

        global tts
        sr, wav = await tts.infer_with_ref_audio_embed(character, text)

        return Response(content=wav.tobytes(), media_type="application/octet-stream")
        
    except Exception as ex:
        tb_str = ''.join(traceback.format_exception(type(ex), ex, ex.__traceback__))
        print(tb_str)
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "error": str(tb_str)
            }
        )
```

### 7) Write a shell startup script (make sure it runs in the correct conda environment)
```bash
vi start_api.sh
```
### Paste the following content into it and press `:wq` to save  
#### Replace `/home/system/index-tts-vllm/model_dir/IndexTTS-1.5` with your actual path
```bash
# Activate conda environment
conda activate index-tts-vllm
echo "Activated project conda environment"
sleep 2
# Find the process ID using port 11996
PID_VLLM=$(sudo netstat -tulnp | grep 11996 | awk '{print $7}' | cut -d'/' -f1)

# Check whether a PID was found
if [ -z "$PID_VLLM" ]; then
  echo "No process found using port 11996"
else
  echo "Found process using port 11996, PID: $PID_VLLM"
  # Try a normal kill first, then wait 2 seconds
  kill $PID_VLLM
  sleep 2
  # Check whether the process is still running
  if ps -p $PID_VLLM > /dev/null; then
    echo "Process is still running, force terminating..."
    kill -9 $PID_VLLM
  fi
  echo "Terminated process $PID_VLLM"
fi

# Find VLLM::EngineCore processes
GPU_PIDS=$(ps aux | grep -E "VLLM|EngineCore" | grep -v grep | awk '{print $2}')

# Check whether any process IDs were found
if [ -z "$GPU_PIDS" ]; then
  echo "No VLLM-related processes found"
else
  echo "Found VLLM-related processes, PID(s): $GPU_PIDS"
  # Try a normal kill first, then wait 2 seconds
  kill $GPU_PIDS
  sleep 2
  # Check whether the process is still running
  if ps -p $GPU_PIDS > /dev/null; then
    echo "Process is still running, force terminating..."
    kill -9 $GPU_PIDS
  fi
  echo "Terminated process $GPU_PIDS"
fi

# Create tmp directory if needed
mkdir -p tmp

# Run api_server.py in the background and redirect logs to tmp/server.log
nohup python api_server.py --model_dir /home/system/index-tts-vllm/model_dir/IndexTTS-1.5 --port 11996 > tmp/server.log 2>&1 &
echo "api_server.py is now running in the background; check tmp/server.log for logs"
```
Grant execute permission and run the script:
```bash
chmod +x start_api.sh
./start_api.sh
```
Logs will be written to `tmp/server.log`, which you can monitor with:
```bash
tail -f tmp/server.log
```
If your GPU memory is sufficient, you can add the `--gpu_memory_utilization` startup parameter to adjust memory usage. The default value is `0.25`.

## Voice configuration
IndexStreamTTS supports custom voice registration through a configuration file, including both single-voice and mixed-voice setups.  
Configure custom voices in `assets/speaker.json` in the project root.
### Configuration format
```bash
{
    "speaker name 1": [
        "audio file path 1.wav",
        "audio file path 2.wav"
    ],
    "speaker name 2": [
        "audio file path 3.wav"
    ]
}
```
### Note (restart required after adding roles for voice registration)
After adding voices, add the corresponding speaker in the control panel (for single-module deployment, switch to the corresponding voice instead).
