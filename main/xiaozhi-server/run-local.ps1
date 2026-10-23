# Run xiaozhi-server standalone on this PC for LAN testing (no Docker, no manager-api).
# Needs .venv (python -m venv .venv; .venv\Scripts\pip install -r requirements.txt)
# and GROQ_API_KEY / GEMINI_API_KEY in main/xiaozhi-server/.env.
# Device OTA URL: http://<this-pc-ip>:8003/xiaozhi/ota/
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$env:XIAOZHI_CUSTOM_CONFIG = 'data/.config.local.yaml'
& "$PSScriptRoot\.venv\Scripts\python.exe" app.py
