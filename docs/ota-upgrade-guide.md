# OTA Auto-Upgrade Guide for Single-Module Deployment

This guide explains how to configure firmware OTA auto-upgrade for a **single-module deployment**, so devices can update their firmware automatically.

If you are using **full-module deployment**, you can ignore this guide.

## Overview

In single-module deployment, xiaozhi-server includes built-in OTA firmware management. It can automatically detect the device version and deliver the matching upgrade firmware. The system automatically matches and pushes the latest firmware version based on the device model and current version.

## Prerequisites

- You have successfully completed a **single-module deployment** and xiaozhi-server is running
- The device can connect to the server normally

## Step 1: Prepare firmware files

### 1. Create the firmware directory

Firmware files must be placed in the `data/bin/` directory. If it does not exist, create it manually:

```bash
mkdir -p data/bin
```

### 2. Firmware naming rules

Firmware files must follow this naming format:

```
{device-model}_{version}.bin
```

**Naming rules:**
- `device-model`: the device model name, such as `lichuang-dev` or `bread-compact-wifi`
- `version`: the firmware version. It must start with a number and may contain numbers, letters, dots, underscores, and hyphens, such as `1.6.6` or `2.0.0`
- The file extension must be `.bin`

**Examples:**
```text
bread-compact-wifi_1.6.6.bin
lichuang-dev_2.0.0.bin
```

### 3. Place the firmware file

Copy the prepared firmware file (`.bin`) into `data/bin/`:

Important: use `xiaozhi.bin` as the upgrade binary, not the full merged firmware `merged-binary.bin`!

Important: use `xiaozhi.bin` as the upgrade binary, not the full merged firmware `merged-binary.bin`!

Important: use `xiaozhi.bin` as the upgrade binary, not the full merged firmware `merged-binary.bin`!

```bash
cp xiaozhi.bin data/bin/device-model_version.bin
```

For example:
```bash
cp xiaozhi.bin data/bin/bread-compact-wifi_1.6.6.bin
```

## Step 2: Configure the public access address (public deployment only)

**Note: This step only applies to single-module public deployments.**

If your xiaozhi-server is exposed on the public internet using a public IP or domain, you **must** configure the `server.vision_explain` parameter, because the OTA firmware download URL will use the configured domain and port.

If you are deploying on a local network, you can skip this step.

### Why is this parameter needed?

In single-module deployment, the system generates the firmware download URL using the domain and port configured in `vision_explain`. If it is not configured or is wrong, devices will not be able to access the firmware download URL.

### How to configure it

Open `data/.config.yaml` and find the `server` section. Set the `vision_explain` parameter:

```yaml
server:
  vision_explain: http://your-domain-or-ip:port/mcp/vision/explain
```

**Examples:**

Local network deployment (default):
```yaml
server:
  vision_explain: http://192.168.1.100:8003/mcp/vision/explain
```

Public domain deployment:
```yaml
server:
  vision_explain: http://yourdomain.com:8003/mcp/vision/explain
```

### Notes

- The domain or IP must be reachable by the device
- If you use Docker, do not use internal addresses such as `127.0.0.1` or `localhost`
- If you use Nginx reverse proxy, use the public-facing address and port, not the port used by this project itself

## FAQ

### 1. The device is not receiving firmware updates

**Possible causes and fixes:**

- Check whether the firmware filename follows the required format: `{model}_{version}.bin`
- Check whether the firmware file is placed correctly in `data/bin/`
- Check whether the device model matches the model name in the firmware filename
- Check whether the firmware version is newer than the device’s current version
- Review the server logs to confirm the OTA request is being handled correctly

### 2. The device reports that the download URL cannot be accessed

**Possible causes and fixes:**

- Check whether the domain or IP configured in `server.vision_explain` is correct
- Confirm the port number is correct (default: 8003)
- For public deployments, make sure the device can reach the public address
- If you are using Docker, make sure you are not using an internal address (`127.0.0.1`)
- Check whether the firewall allows the relevant port
- If you use Nginx reverse proxy, use the public-facing address and port, not the port used by this project itself

### 3. How to confirm the current device version

Check the OTA request logs. The logs will show the version reported by the device:

```text
[ota_handler] - Device AA:BB:CC:DD:EE:FF firmware is already the latest: 1.6.6
```

### 4. Firmware files do not take effect after being placed

The system has a 30-second cache time by default. You can:
- Wait 30 seconds and then trigger the OTA request again
- Restart the xiaozhi-server service
- Set `firmware_cache_ttl` to a shorter value
