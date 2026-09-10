# MCP Endpoint Deployment and Usage Guide

This tutorial has 3 parts:
- 1. How to deploy the MCP endpoint service
- 2. How to configure the MCP endpoint in a full-module deployment
- 3. How to configure the MCP endpoint in a single-module deployment

# 1. How to deploy the MCP endpoint service

## Step 1: Download the MCP endpoint source code

Open the [MCP endpoint project page](https://github.com/xinnan-tech/mcp-endpoint-server) in your browser.

Find the green `Code` button, click it, and then click `Download ZIP`.

Download the source code archive to your computer, extract it, and rename the extracted folder from something like `mcp-endpoint-server-main` to `mcp-endpoint-server`.

## Step 2: Start the program

This is a simple project, so Docker is recommended. If you do not want to use Docker, you can follow the [source code instructions](https://github.com/xinnan-tech/mcp-endpoint-server/blob/main/README_dev.md). The Docker method is shown below:

```bash
# Enter the project root
cd mcp-endpoint-server

# Clean up
docker compose -f docker-compose.yml down
docker stop mcp-endpoint-server
docker rm mcp-endpoint-server
docker rmi ghcr.nju.edu.cn/xinnan-tech/mcp-endpoint-server:latest

# Start the container
docker compose -f docker-compose.yml up -d
# View logs
docker logs -f mcp-endpoint-server
```

At this point, the logs will show something like this:

```text
250705 INFO-=====The following addresses are for the control panel / single-module MCP endpoint====
250705 INFO-Control panel MCP parameter endpoint: http://172.22.0.2:8004/mcp_endpoint/health?key=abc
250705 INFO-Single-module MCP endpoint: ws://172.22.0.2:8004/mcp_endpoint/mcp/?token=def
250705 INFO-=====Use the correct one for your deployment. Do not share them with anyone======
```

Copy both endpoint addresses:

Because you are using Docker, you must **not** use the addresses above directly.

Copy them into a draft first. You need to know your machine’s LAN IP. For example, if my machine’s LAN IP is `192.168.1.25`, then the addresses become:

```text
Control panel MCP parameter endpoint: http://192.168.1.25:8004/mcp_endpoint/health?key=abc
Single-module MCP endpoint: ws://192.168.1.25:8004/mcp_endpoint/mcp/?token=def
```

After updating them, open the `Control panel MCP parameter endpoint` in a browser. If you see output like this, it means the service is working:

```json
{"result":{"status":"success","connections":{"tool_connections":0,"robot_connections":0,"total_connections":0}},"error":null,"id":null,"jsonrpc":"2.0"}
```

Keep the two endpoint addresses; you will need them later.

# 2. Configure the MCP endpoint in a full-module deployment

First, enable the MCP endpoint feature. In the control panel, click `Parameter Dictionary` in the top menu, open `System Feature Configuration`, check `MCP Endpoint`, and click `Save Configuration`. After that, `MCP Endpoint` will appear in the role configuration page.

If you are using a full-module deployment, log in to the control panel as an administrator and open `Parameter Management`.

Search for `server.mcp_endpoint`. Its value should be `null`.
Click edit, paste the `Control panel MCP parameter endpoint` from above into the value field, and save.

If saving succeeds, everything is fine and you can check the agent behavior. If it fails, the control panel probably cannot reach the MCP endpoint because of a firewall issue or an incorrect LAN IP.

# 3. Configure the MCP endpoint in a single-module deployment

If you are using a single-module deployment, open your `data/.config.yaml` file.
Search for `mcp_endpoint`. If it is not present, add the `mcp_endpoint` configuration. For example:

```yaml
server:
  websocket: ws://your-ip-or-domain:port/xiaozhi/v1/
  http_port: 8002
log:
  log_level: INFO

# there may be more configuration here...

mcp_endpoint: your-endpoint-websocket-url
```

Now paste the `Single-module MCP endpoint` from the deployment step into `mcp_endpoint`, for example:

```yaml
server:
  websocket: ws://your-ip-or-domain:port/xiaozhi/v1/
  http_port: 8002
log:
  log_level: INFO

# there may be more configuration here

mcp_endpoint: ws://192.168.1.25:8004/mcp_endpoint/mcp/?token=def
```

After configuring it, starting the single-module server will print logs like this:

```text
250705[__main__]-INFO-Initialized component successfully: VAD SileroVAD
250705[__main__]-INFO-Initialized component successfully: ASR FunASRServer
250705[__main__]-INFO-OTA endpoint:          http://192.168.1.25:8002/xiaozhi/ota/
250705[__main__]-INFO-Visual analysis endpoint: http://192.168.1.25:8002/mcp/vision/explain
250705[__main__]-INFO-MCP endpoint:        ws://192.168.1.25:8004/mcp_endpoint/mcp/?token=abc
250705[__main__]-INFO-WebSocket endpoint:   ws://192.168.1.25:8000/xiaozhi/v1/
250705[__main__]-INFO-=======The above address is a WebSocket URL; do not open it in a browser=======
250705[__main__]-INFO-If you want to test WebSocket, start the digital-human module and use the browser interaction test
250705[__main__]-INFO-=============================================================
```

If you see the `MCP endpoint` log line with a `ws://...` address, the configuration is successful.
