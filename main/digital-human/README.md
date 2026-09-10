This document is a development guide. If you need deployment instructions for the Xiaozhi server, [click here to view the deployment guide](../../README.md#deployment).

If you want to see the all-in-one digital human deployment, kiosk fullscreen startup, and system environment setup, [click here to view the all-in-one deployment guide](../../docs/all-in-one-digital-human-setup.md).

If you want to see wakeword model downloads, runtime configuration, and detailed usage instructions, [click here to view the wakeword guide](../../docs/digital-human-wakeword.md).

# Project overview

digital-human is a standalone digital human test module that provides a local test page, frontend interaction resources, wakeword runtime, and an event bridge. It is used to coordinate the full digital-human interaction pipeline.

# Quick start

Install dependencies:

```bash
pip install -r wakeword_runtime/requirements.txt
```

Start the module:

```bash
python start.py
```

# Access URLs

After startup, you can access:

- Page URL: http://127.0.0.1:8006/index.html
- Event bridge URL: ws://127.0.0.1:8006/wakeword-ws
- Health check: http://127.0.0.1:8006/health

# Directory overview

- `start.py`: module entry point
- `index.html`: digital-human test page entry
- `wakeword_runtime`: local wakeword runtime and configuration directory
- `js`, `css`: frontend scripts and styles
- `images`, `resources`: page assets

# Related documentation

- All-in-one deployment guide: for x86 all-in-one deployment, kiosk display, and startup auto-launch configuration
  [../../docs/all-in-one-digital-human-setup.md](../../docs/all-in-one-digital-human-setup.md)
- Wakeword guide: for wakeword model download, runtime configuration, and local debugging notes
  [../../docs/digital-human-wakeword.md](../../docs/digital-human-wakeword.md)