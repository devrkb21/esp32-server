# Run xiaozhi-server natively with manager-api (LAN test): models, prompt and voice come from
# manager-api (docker-compose.lan.yml), the companion API is served here on port 8003.
# Needs .venv and data/.config.manager.yaml (server address, manager-api url + secret, companion).
# Note: no $ErrorActionPreference = 'Stop' here (see run-local.ps1).
Set-Location $PSScriptRoot
$env:XIAOZHI_CUSTOM_CONFIG = 'data/.config.manager.yaml'
$env:PYTHONIOENCODING = 'utf-8'
& "$PSScriptRoot\.venv\Scripts\python.exe" app.py
exit $LASTEXITCODE
