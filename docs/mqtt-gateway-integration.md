# MQTT Gateway Deployment Guide

The `xiaozhi-esp32-server` project can be lightly adapted together with the open-source [xiaozhi-mqtt-gateway](https://github.com/78/xiaozhi-mqtt-gateway) project to enable MQTT+UDP connectivity for Xiaozhi hardware.
This guide is divided into three parts. You can choose the relevant section based on whether you are using a full-module deployment or a single-module deployment:
- Part 1: Deploy the MQTT gateway
- Part 2: Enable MQTT+UDP connectivity for Xiaozhi hardware in a full-module deployment
- Part 3: Enable MQTT+UDP connectivity for Xiaozhi hardware when running `xiaozhi-server` in single-module mode

## Preparation
Prepare the `mqtt-websocket` connection address for your `xiaozhi-server`. Add `?from=mqtt_gateway` to your original `websocket` URL to get the `mqtt-websocket` connection address.

1. If you are running from source, your `mqtt-websocket` URL is:
```
ws://127.0.0.1:8000/xiaozhi/v1/?from=mqtt_gateway
```

2. If you are running with Docker, your `mqtt-websocket` URL is:
```
ws://your-host-machine-LAN-IP:8000/xiaozhi/v1/?from=mqtt_gateway
```

## Important Notes

If you are deploying on a server, make sure ports `1883`, `8884`, and `8007` are open to the outside world. The protocol type for `8884` is `UDP`; the others are `TCP`.

If you are deploying on a server, make sure ports `1883`, `8884`, and `8007` are open to the outside world. The protocol type for `8884` is `UDP`; the others are `TCP`.

If you are deploying on a server, make sure ports `1883`, `8884`, and `8007` are open to the outside world. The protocol type for `8884` is `UDP`; the others are `TCP`.

## Part 1: Deploy the MQTT Gateway

1. Clone the adapted [xiaozhi-mqtt-gateway project](https://github.com/xinnan-tech/xiaozhi-mqtt-gateway.git):
```bash
git clone https://ghfast.top/https://github.com/xinnan-tech/xiaozhi-mqtt-gateway.git
cd xiaozhi-mqtt-gateway
```

2. Install dependencies:
```bash
npm install
npm install -g pm2
```

3. Configure `config.json`:
```bash
cp config/mqtt.json.example config/mqtt.json
```

4. Edit `config/mqtt.json` and replace the `mqtt-websocket` URL you prepared earlier in `chat_servers`. For example, for a source-based `xiaozhi-server` deployment, use the following configuration:

``` 
{
    "production": {
        "chat_servers": [
            "ws://127.0.0.1:8000/xiaozhi/v1/?from=mqtt_gateway"
        ]
    },
    "debug": false,
    "max_mqtt_payload_size": 8192,
    "mcp_client": {
        "capabilities": {
        },
        "client_info": {
            "name": "xiaozhi-mqtt-client",
            "version": "1.0.0"
        },
        "max_tools_count": 128
    }
}
```

5. Create a `.env` file in the project root and set the following environment variables:
```
PUBLIC_IP=your-ip         # Server public IP
MQTT_PORT=1883            # MQTT server port
UDP_PORT=8884             # UDP server port
API_PORT=8007             # Management API port
MQTT_SIGNATURE_KEY=test   # MQTT signature key
SERVER_SECRET=Te1st12134  # Server secret, keep this aligned with `server.secret` in the dashboard or `server.auth_key` in `xiaozhi-server`
```
Make sure `PUBLIC_IP` matches your actual public IP; if you have a domain name, use that instead.

`MQTT_SIGNATURE_KEY` is used for MQTT connection authentication. It is best to make it reasonably strong, ideally at least 8 characters long and containing both uppercase and lowercase letters. You will need this key later as well.

- Do not use weak passwords such as `123456` or `test`.
- Do not use weak passwords such as `123456` or `test`.
- Do not use weak passwords such as `123456` or `test`.

`SERVER_SECRET` is used to generate websocket connection authentication information.

1. If you are using a full-module deployment and `server.auth.enabled` is set to `true` in the dashboard parameter settings, then `SERVER_SECRET` must match the dashboard value (`server.secret`).

2. If you are using a single-module deployment and `server.auth.enabled` is set to `true` in your config file, then `SERVER_SECRET` must match the value in the config file (`server.auth_key`).

6. Start the MQTT gateway
```
# Start the service
pm2 start ecosystem.config.js

# View logs
pm2 logs xz-mqtt
```

When you see the following logs, the MQTT gateway has started successfully:
```
0|xz-mqtt  | 2025-09-11T12:14:48: MQTT server is listening on port 1883
0|xz-mqtt  | 2025-09-11T12:14:48: UDP server is listening on x.x.x.x:8884
```

If you need to restart the MQTT gateway, run:
```
pm2 restart xz-mqtt
```

## Part 2: Enable MQTT+UDP Connectivity for Xiaozhi Hardware in a Full-Module Deployment

Check the version number at the bottom of the dashboard home page and confirm whether your dashboard version is `0.7.7` or later. If not, you need to upgrade the dashboard.

1. At the top of the dashboard, click `Parameter Management`, search for `server.mqtt_gateway`, click edit, and enter `PUBLIC_IP` + `:` + `MQTT_PORT` from your `.env` file. For example:
```
192.168.0.7:1883
```

2. At the top of the dashboard, click `Parameter Management`, search for `server.mqtt_signature_key`, click edit, and enter the `MQTT_SIGNATURE_KEY` from your `.env` file.

3. At the top of the dashboard, click `Parameter Management`, search for `server.udp_gateway`, click edit, and enter `PUBLIC_IP` + `:` + `UDP_PORT` from your `.env` file. For example:
```
192.168.0.7:8884
```

4. At the top of the dashboard, click `Parameter Management`, search for `server.mqtt_manager_api`, click edit, and enter `PUBLIC_IP` + `:` + `API_PORT` from your `.env` file. For example:
```
192.168.0.7:8007
```

After completing the above configuration, you can use a `curl` command to verify whether your OTA endpoint will return MQTT configuration. Replace `http://localhost:8002/xiaozhi/ota/` below with your actual OTA URL:
```
curl 'http://localhost:8002/xiaozhi/ota/' \
  -H 'Content-Type: application/json' \
  -H 'Client-Id: 7b94d69a-9808-4c59-9c9b-704333b38aff' \
  -H 'Device-Id: 11:22:33:44:55:66' \
  --data-raw $'{\n  "application": {\n    "version": "1.0.1",\n    "elf_sha256": "1"\n  },\n  "board": {\n    "mac": "11:22:33:44:55:66"\n  }\n}'
```

If the returned content contains MQTT-related configuration, the setup was successful. It should look similar to this:

```
{"server_time":{"timestamp":1757567894012,"timeZone":"Asia/Shanghai","timezone_offset":480},"activation":{"code":"460609","message":"http://xiaozhi.server.com\n460609","challenge":"11:22:33:44:55:66"},"firmware":{"version":"1.0.1","url":"http://xiaozhi.server.com:8002/xiaozhi/otaMag/download/NOT_ACTIVATED_FIRMWARE_THIS_IS_A_INVALID_URL"},"websocket":{"url":"ws://192.168.4.23:8000/xiaozhi/v1/"},"mqtt":{"endpoint":"192.168.0.7:1883","client_id":"GID_default@@@11_22_33_44_55_66@@@7b94d69a-9808-4c59-9c9b-704333b38aff","username":"eyJpcCI6IjA6MDowOjA6MDowOjA6MSJ9","password":"Y8XP9xcUhVIN9OmbCHT9ETBiYNE3l3Z07Wk46wV9PE8=","publish_topic":"device-server","subscribe_topic":"devices/p2p/11_22_33_44_55_66"}}
```

Because MQTT information is delivered through the OTA endpoint, it is enough to ensure the OTA URL can connect properly; after that, simply reboot and wake the device.

After waking the device, watch the `mqtt-gateway` logs to confirm that the connection succeeded.
```
pm2 logs xz-mqtt
```

## Part 3: Enable MQTT+UDP Connectivity for Xiaozhi Hardware When Running `xiaozhi-server` in Single-Module Mode

Open your `data/.config.yaml` file and, under `server`, set `mqtt_gateway` to `PUBLIC_IP` + `:` + `MQTT_PORT` from your `.env` file. For example:
```
192.168.0.7:1883
```
Under `server`, set `mqtt_signature_key` to `MQTT_SIGNATURE_KEY` from your `.env` file.

Under `server`, set `udp_gateway` to `PUBLIC_IP` + `:` + `UDP_PORT` from your `.env` file. For example:
```
192.168.0.7:8884
```

After completing the above configuration, you can use a `curl` command to verify whether your OTA endpoint will return MQTT configuration. Replace `http://localhost:8002/xiaozhi/ota/` below with your actual OTA URL:
```
curl 'http://localhost:8002/xiaozhi/ota/' \
  -H 'Device-Id: 11:22:33:44:55:66' \
  --data-raw $'{\n  "application": {\n    "version": "1.0.1",\n    "elf_sha256": "1"\n  },\n  "board": {\n    "mac": "11:22:33:44:55:66"\n  }\n}'
```

If the returned content contains MQTT-related configuration, the setup was successful. It should look similar to this:
```
{"server_time":{"timestamp":1758781561083,"timeZone":"GMT+08:00","timezone_offset":480},"activation":{"code":"527111","message":"http://xiaozhi.server.com\n527111","challenge":"11:22:33:44:55:66"},"firmware":{"version":"1.0.1","url":"http://xiaozhi.server.com:8002/xiaozhi/otaMag/download/NOT_ACTIVATED_FIRMWARE_THIS_IS_A_INVALID_URL"},"websocket":{"url":"ws://192.168.1.15:8000/xiaozhi/v1/"},"mqtt":{"endpoint":"192.168.1.15:1883","client_id":"GID_default@@@11_22_33_44_55_66@@@11_22_33_44_55_66","username":"eyJpcCI6IjE5Mi4xNjguMS4xNSJ9","password":"fjAYs49zTJecWqJ3jBt+kqxVn/x7vkXRAc85ak/va7Y=","publish_topic":"device-server","subscribe_topic":"devices/p2p/11_22_33_44_55_66"}}
```

Because MQTT information is delivered through the OTA endpoint, it is enough to ensure the OTA URL can connect properly; after that, simply reboot and wake the device.

After waking the device, watch the `mqtt-gateway` logs to confirm that the connection succeeded.
```
pm2 logs xz-mqtt
```
