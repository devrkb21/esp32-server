# MCP Endpoint Usage Guide

This tutorial uses Xiaoge’s open-source MCP calculator as an example to show how to connect your own custom MCP service to your endpoint.

Before starting, your `xiaozhi-server` must already have MCP endpoint support enabled. If it is not enabled yet, follow [this guide](./mcp-endpoint-enable.md) first.

# How to connect a simple MCP tool, such as a calculator, to an agent

### If you are using a full-module deployment
If you are using a full-module deployment, go to the control panel, open `Agent Management`, click `Configure Role`, and find the `Edit Function` button to the right of `Intent Recognition`.

Click that button. In the popup, at the bottom, you will see `MCP Endpoint`. Normally, it will show the agent’s `MCP endpoint address`. We will use that address to extend the agent with a calculator tool based on MCP.

That `MCP endpoint address` is important. Keep it for later.

### If you are using a single-module deployment
If you are using a single-module deployment and you have already configured the MCP endpoint address in the config file, then when the single-module server starts it should print logs like this:

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

If you see the `MCP endpoint` line with `ws://192.168.1.25:8004/mcp_endpoint/mcp/?token=abc`, that is your `MCP endpoint address`.

Keep that `MCP endpoint address`; you will need it later.

## Step 1: Download Xiaoge’s MCP calculator source code

Open the browser and go to the [calculator project](https://github.com/78/mcp-calculator).

Find the green `Code` button, click it, and then click `Download ZIP`.

Download the source archive to your computer, extract it, and rename the extracted folder from something like `mcp-calculator-main` to `mcp-calculator`. Next, use the command line to enter the project directory and install dependencies:

```bash
# Enter the project directory
cd mcp-calculator

conda remove -n mcp-calculator --all -y
conda create -n mcp-calculator python=3.10 -y
conda activate mcp-calculator

pip install -r requirements.txt
```

## Step 2: Start it

Before starting, copy the MCP endpoint address from your agent in the control panel.

For example, my agent’s MCP address is:

```text
ws://192.168.1.25:8004/mcp_endpoint/mcp/?token=abc
```

Set the environment variable:

```bash
export MCP_ENDPOINT=ws://192.168.1.25:8004/mcp_endpoint/mcp/?token=abc
```

Then start the program:

```bash
python mcp_pipe.py calculator.py
```

### If you are using the control panel deployment
After startup, go back to the control panel and refresh the MCP connection status. You should see the extended tool list.

### If you are using a single-module deployment
When the device connects successfully, the logs should look like this:

```text
250705 -INFO-Initializing MCP endpoint: wss://2662r3426b.vicp.fun/mcp_e 
250705 -INFO-Sending MCP endpoint initialization message
250705 -INFO-MCP endpoint connected successfully
250705 -INFO-MCP endpoint initialized successfully
250705 -INFO-Unified tool handler initialized successfully
250705 -INFO-MCP endpoint server info: name=Calculator, version=1.9.4
250705 -INFO-Number of tools supported by the MCP endpoint: 1
250705 -INFO-All MCP endpoint tools have been fetched, client is ready
250705 -INFO-Tool cache refreshed
250705 -INFO-Current supported function list: [ 'get_time', 'get_lunar', 'play_music', 'get_weather', 'handle_exit_intent', 'calculator']
```

If `calculator` appears in the list, the device can use intent recognition to call the calculator tool.
