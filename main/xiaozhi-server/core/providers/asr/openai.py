import time
import os
from config.logger import setup_logging
from typing import Optional, Tuple, List
from core.providers.asr.dto.dto import InterfaceType
from core.providers.asr.base import ASRProviderBase

import requests

TAG = __name__
logger = setup_logging()

class ASRProvider(ASRProviderBase):
    def __init__(self, config: dict, delete_audio_file: bool):
        self.interface_type = InterfaceType.NON_STREAM
        self.api_key = config.get("api_key")
        self.api_url = config.get("base_url")
        self.model = config.get("model_name")
        # ISO-639-1 code such as "bn". Whisper guesses the language otherwise, and short Bangla
        # phrases often come back transcribed as Japanese or Hindi.
        self.language = config.get("language")
        self.output_dir = config.get("output_dir")
        self.delete_audio_file = delete_audio_file
        # Seconds to wait for the API; a hung request would stall the chat (and the fallback)
        try:
            self.timeout = float(config.get("timeout") or 20)
        except (TypeError, ValueError):
            self.timeout = 20.0
        self.last_error = None

        os.makedirs(self.output_dir, exist_ok=True)

    def requires_file(self) -> bool:
        return True

    async def speech_to_text(self, opus_data: List[bytes], session_id: str, artifacts=None) -> Tuple[Optional[str], Optional[str]]:
        file_path = None
        self.last_error = None
        try:
            if artifacts is None:
                return "", None
            file_path = artifacts.file_path
                
            logger.bind(tag=TAG).info(f"file path: {file_path}")
            headers = {
                "Authorization": f"Bearer {self.api_key}",
            }
            
            # Use data parameter to pass model name
            data = {
                "model": self.model
            }
            if self.language:
                data["language"] = self.language

            with open(file_path, "rb") as audio_file:  # Use with statement to ensure file is closed
                files = {
                    "file": audio_file
                }

                start_time = time.time()
                response = requests.post(
                    self.api_url,
                    files=files,
                    data=data,
                    headers=headers,
                    timeout=self.timeout,
                )
                logger.bind(tag=TAG).debug(
                    f"Speech recognition time: {time.time() - start_time:.3f}s | Result: {response.text}"
                )

            if response.status_code == 200:
                text = response.json().get("text", "")
                return text, file_path
            else:
                error = Exception(f"API request failed: {response.status_code} - {response.text[:200]}")
                error.status_code = response.status_code
                raise error

        except Exception as e:
            logger.bind(tag=TAG).error(f"Speech recognition failed: {e}")
            # Kept for FallbackASR (the next recognizer gets the same audio)
            self.last_error = e
            return "", None
