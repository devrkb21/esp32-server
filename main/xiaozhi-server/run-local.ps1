# Run xiaozhi-server standalone on this PC for LAN testing (no Docker, no manager-api).
# Needs .venv (python -m venv .venv; .venv\Scripts\pip install -r requirements.txt)
# and GROQ_API_KEY / GEMINI_API_KEY in main/xiaozhi-server/.env.
# Device OTA URL: http://<this-pc-ip>:8003/xiaozhi/ota/
# Note: no $ErrorActionPreference = 'Stop' here. Python writes warnings to stderr, and when the
# output is redirected PowerShell would turn the first warning into a fatal error.
Set-Location $PSScriptRoot
$env:XIAOZHI_CUSTOM_CONFIG = 'data/.config.local.yaml'
$env:PYTHONIOENCODING = 'utf-8'
& "$PSScriptRoot\.venv\Scripts\python.exe" app.py
exit $LASTEXITCODE
