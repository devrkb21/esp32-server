import os
import io
import sys
import time
import shutil
import psutil
import asyncio

from funasr import AutoModel
from config.logger import setup_logging
from typing import Optional, Tuple, List
from core.providers.asr.utils import lang_tag_filter
from core.providers.asr.base import ASRProviderBase
from core.providers.asr.dto.dto import InterfaceType

TAG = __name__
logger = setup_logging()

MAX_RETRIES = 2
RETRY_DELAY = 1  # Retry delay (seconds)


# Capture standard output
class CaptureOutput:
    def __enter__(self):
        self._output = io.StringIO()
        self._original_stdout = sys.stdout
        sys.stdout = self._output

    def __exit__(self, exc_type, exc_value, traceback):
        sys.stdout = self._original_stdout
        self.output = self._output.getvalue()
        self._output.close()

        # Output captured content via logger
        if self.output:
            logger.bind(tag=TAG).info(self.output.strip())


class ASRProvider(ASRProviderBase):
    def __init__(self, config: dict, delete_audio_file: bool):
        super().__init__()
        
        # Memory check, requires > 2GB
        min_mem_bytes = 2 * 1024 * 1024 * 1024
        try:
            total_mem = psutil.virtual_memory().total
        except RuntimeError as e:
            logger.bind(tag=TAG).warning(f"Failed to get system memory info, skipping FunASR memory check: {e}")
        else:
            if total_mem < min_mem_bytes:
                logger.bind(tag=TAG).error(f"Available memory less than 2GB, currently only {total_mem / (1024*1024):.2f} MB, FunASR may fail to start")
        
        self.interface_type = InterfaceType.LOCAL
        self.model_dir = config.get("model_dir")
        self.output_dir = config.get("output_dir")
        self.language = config.get("language", "auto")
        self.delete_audio_file = delete_audio_file

        # Ensure output directory exists
        os.makedirs(self.output_dir, exist_ok=True)

        # Ensure model.pt exists and is valid (> 900MB)
        if self.model_dir:
            os.makedirs(self.model_dir, exist_ok=True)
            model_pt = os.path.join(self.model_dir, "model.pt")

            # Check if existing file is incomplete (< 900 MB)
            if os.path.exists(model_pt) and os.path.getsize(model_pt) < 900 * 1024 * 1024:
                logger.bind(tag=TAG).warning(
                    f"Corrupted or incomplete SenseVoiceSmall model.pt ({os.path.getsize(model_pt)} bytes). Removing and redownloading..."
                )
                try:
                    os.remove(model_pt)
                except Exception as rm_err:
                    logger.bind(tag=TAG).error(f"Error removing corrupted model: {rm_err}")

            if not os.path.exists(model_pt):
                logger.bind(tag=TAG).info(
                    f"SenseVoiceSmall model.pt not found in {self.model_dir}. Downloading (~936 MB)..."
                )
                try:
                    import urllib.request
                    url = "https://modelscope.cn/models/iic/SenseVoiceSmall/resolve/master/model.pt"
                    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                    tmp_pt = model_pt + ".tmp"
                    if os.path.exists(tmp_pt):
                        os.remove(tmp_pt)

                    with urllib.request.urlopen(req, timeout=600) as response, open(tmp_pt, "wb") as out_file:
                        chunk_size = 1024 * 1024
                        downloaded = 0
                        total_size = int(response.headers.get("Content-Length", 936291369))
                        while True:
                            chunk = response.read(chunk_size)
                            if not chunk:
                                break
                            out_file.write(chunk)
                            downloaded += len(chunk)
                            if downloaded % (50 * 1024 * 1024) < chunk_size:
                                logger.bind(tag=TAG).info(
                                    f"Downloading SenseVoiceSmall: {downloaded // (1024*1024)}MB / {total_size // (1024*1024)}MB..."
                                )

                    os.replace(tmp_pt, model_pt)
                    logger.bind(tag=TAG).info("Successfully downloaded SenseVoiceSmall model.pt")
                except Exception as e:
                    logger.bind(tag=TAG).error(f"Failed to auto-download SenseVoiceSmall model.pt: {e}")

        with CaptureOutput():
            self.model = AutoModel(
                model=self.model_dir,
                vad_kwargs={"max_single_segment_time": 30000},
                disable_update=True,
                hub="hf",
                # device="cuda:0",  # Enable GPU acceleration
            )

    async def speech_to_text(
        self, opus_data: List[bytes], session_id: str, artifacts=None
    ) -> Tuple[Optional[str], Optional[str]]:
        """Main speech-to-text processing logic"""
        retry_count = 0
        
        while retry_count < MAX_RETRIES:
            try:
                if artifacts is None:
                    return "", None

                # Speech recognition - use thread pool to avoid blocking event loop
                start_time = time.time()
                result = await asyncio.to_thread(
                    self.model.generate,
                    input=artifacts.pcm_bytes,
                    cache={},
                    language=self.language,
                    use_itn=True,
                    batch_size_s=60,
                )
                text = lang_tag_filter(result[0]["text"])
                logger.bind(tag=TAG).debug(
                    f"Speech recognition time: {time.time() - start_time:.3f}s | Result: {text['content']}"
                )

                return text, artifacts.file_path

            except OSError as e:
                retry_count += 1
                if retry_count >= MAX_RETRIES:
                    logger.bind(tag=TAG).error(
                        f"Speech recognition failed (retried {retry_count} times): {e}", exc_info=True
                    )
                    return "", None
                logger.bind(tag=TAG).warning(
                    f"Speech recognition failed, retrying ({retry_count}/{MAX_RETRIES}): {e}"
                )
                time.sleep(RETRY_DELAY)

            except Exception as e:
                logger.bind(tag=TAG).error(f"Speech recognition failed: {e}", exc_info=True)
                return "", None
