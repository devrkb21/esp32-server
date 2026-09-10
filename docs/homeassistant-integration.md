# Xiaozhi ESP32 Open Source Server and Home Assistant Integration Guide

[TOC]

-----

## Introduction

This document explains how to integrate ESP32 devices with Home Assistant.

## Prerequisites

- Home Assistant is already installed and configured.
- For this guide, the selected model is the free ChatGLM model, which supports function-calling.

## Required preparation before you begin

### 1. Get the Home Assistant network address

Open your Home Assistant URL in a browser. For example, if my Home Assistant address is `192.168.4.7` and the default port is `8123`, I would open:

```text
http://192.168.4.7:8123
```

> **Manual method to find the Home Assistant IP** *(only when Xiaozhi esp32-server and Home Assistant are on the same network, such as the same Wi‑Fi)*:
>
> 1. Open Home Assistant.
> 2. Go to **Settings** → **System** → **Network**.
> 3. Scroll to the bottom to the `Home Assistant URL` section. In `Local network`, click the `eye` button to view the current IP address (for example, `192.168.1.10`) and the network interface. You can also click `copy link` to copy it directly.
>
>    ![image-20250504051716417](images/image-ha-integration-01.png)

If you already have a directly accessible Home Assistant URL, you can also open it in your browser:

```text
http://homeassistant.local:8123
```

### 2. Log in to Home Assistant and get an API token

Log in to Home Assistant, click the avatar in the lower-left corner → `Profile`, switch to the `Security` tab, scroll to the bottom, and generate a long-lived access token. Copy and save it; later steps require this API key, and it is shown only once. *(Tip: you can save the QR code image and scan it later to retrieve the API key again.)*

## Method 1: Community-built HA control integration

### What this method does

- If you add new devices later, you must manually restart `xiaozhi-esp32-server` to refresh the device information. **Important**.
- Make sure `Xiaomi Home` is already integrated into Home Assistant, and that Xiaomi devices have been imported into Home Assistant.
- Make sure the `xiaozhi-esp32-server` control panel is working properly.
- In my setup, `xiaozhi-esp32-server` and Home Assistant run on the same machine but on different ports, and the version is `0.3.10`.

  ```text
  http://192.168.4.7:8002
  ```

### Configuration steps

#### 1. Log in to Home Assistant and organize the devices you want to control

Log in to Home Assistant, click `Settings` in the lower-left corner, go to `Devices & Services`, then click `Entities` at the top.

Search for the switches or devices you want to control. When the results appear, click one of them to open the switch panel.

In the switch panel, try toggling it on and off. If it responds, the device is connected normally.

Then open the device settings and check its `entity ID`.

Write down each device in this format:

`location` + comma + `device name` + comma + `entity ID` + semicolon

For example, if I am in the office and I have a toy lamp with entity ID `switch.cuco_cn_460494544_cp1_on_p_2_1`, I would write:

```text
Office,Toy Lamp,switch.cuco_cn_460494544_cp1_on_p_2_1;
```

If I need to control two lights, the final result might look like this:

```text
Office,Toy Lamp,switch.cuco_cn_460494544_cp1_on_p_2_1;
Office,Desk Lamp,switch.iot_cn_831898993_socn1_on_p_2_1;
```

We call this text the “device list string.” Save it; you will need it later.

#### 2. Log in to the control panel

![image-20250504051716417](images/image-ha-integration-06.png)

Use an administrator account to log in to the control panel. In `Agent Management`, find your agent and click `Configure Role`.

Set intent recognition to `External LLM Intent Recognition` or `LLM Function Calling`. You will then see an `Edit Function` button on the right. Click it to open the `Function Management` dialog.

In the `Function Management` dialog, check `HomeAssistant Device Status Query` and `HomeAssistant Device Status Modification`.

After selecting them, click `HomeAssistant Device Status Query` in `Selected Functions`, then configure your Home Assistant address, API key, and device list string in `Parameter Configuration`.

When you are done, click `Save Configuration`. The function dialog will close; then click to save the agent configuration.

Once saved successfully, you can wake the device and use it.

#### 3. Wake the device and control it

Try saying to the ESP32: “Turn on the XXX light.”

## Method 2: Use Home Assistant’s voice assistant as an LLM tool

### What this method does

- A notable downside is that this method **cannot use the open-source function_call plugin capabilities** from the Xiaozhi ecosystem, because using Home Assistant as the LLM tool transfers intent recognition to Home Assistant. However, this method lets you experience Home Assistant’s native control features while keeping Xiaozhi’s chat abilities unchanged. If that is a concern, you can use [Method 3](#method-3-use-home-assistants-mcp-service-recommended), which also supports Home Assistant.

### Configuration steps

#### 1. Configure Home Assistant’s voice assistant / LLM assistant

**You must first configure a Home Assistant voice assistant or LLM assistant.**

#### 2. Get the agent ID of the Home Assistant assistant

1. Open the Home Assistant page. Click `Developer Tools` on the left.
2. In `Developer Tools`, click the `Actions` tab. In the action picker, find or enter `conversation.process` and select `Conversation: Process`.

![image-20250504043539343](images/image-ha-integration-02.png)

3. Check the `agent` option, then select the voice assistant you configured in step 1 in the `conversation agent` field. In my case, I configured `ZhipuAi` and selected it.

![image-20250504043854760](images/image-ha-integration-03.png)

4. After selecting it, click `Enter YAML mode` in the lower-left corner of the form.

![image-20250504043951126](images/image-ha-integration-04.png)

5. Copy the `agent-id` value, for example `01JP2DYMBDF7F4ZA2DMCF2AGX2` in my screenshot (for reference only).

![image-20250504044046466](images/image-ha-integration-05.png)

6. Open the `config.yaml` file of `xiaozhi-esp32-server`, find the Home Assistant section in the LLM configuration, and set your Home Assistant network address, API key, and the `agent_id` you just copied.
7. Change the `selected_module` values in `config.yaml`: set `LLM` to `HomeAssistant` and `Intent` to `nointent`.
8. Restart `xiaozhi-esp32-server`.

## Method 3: Use Home Assistant’s MCP service (recommended)

### What this method does

- You need to first install the Home Assistant integration called [Model Context Protocol Server](https://www.home-assistant.io/integrations/mcp_server/).
- This method and Method 2 are both official Home Assistant solutions. Unlike Method 2, you can still use the open-source plugin ecosystem of `xiaozhi-esp32-server`, while freely using any LLM that supports function_call.

### Configuration steps

#### 1. Install the Home Assistant MCP integration

Official page: [Model Context Protocol Server](https://www.home-assistant.io/integrations/mcp_server/).

Or follow these manual steps:

> - Go to **Settings > Devices & Services**.
> - In the lower-right corner, click **Add Integration**.
> - Select **Model Context Protocol Server** from the list.
> - Follow the on-screen instructions to finish setup.

#### 2. Configure MCP settings in the Xiaozhi server

Open the `data` directory and find `.mcp_server_settings.json`.

If `.mcp_server_settings.json` does not exist in `data`:
- Copy `mcp_server_settings.json` from the root of `xiaozhi-server` into `data` and rename it to `.mcp_server_settings.json`.
- Or download this file from [here](https://github.com/xinnan-tech/xiaozhi-esp32-server/blob/main/main/xiaozhi-server/mcp_server_settings.json), save it into `data`, and rename it to `.mcp_server_settings.json`.

Update this part inside `"mcpServers"`:

```json
"Home Assistant": {
      "command": "mcp-proxy",
      "args": [
        "http://YOUR_HA_HOST/mcp_server/sse"
      ],
      "env": {
        "API_ACCESS_TOKEN": "YOUR_API_ACCESS_TOKEN"
      }
},
```

Notes:

1. **Replace values carefully:**
   - Replace `YOUR_HA_HOST` in `args` with your Home Assistant service address. If your address already includes `https://` or `http://` (for example `http://192.168.1.101:8123`), then enter only `192.168.1.101:8123`.
   - Replace `YOUR_API_ACCESS_TOKEN` in `env.API_ACCESS_TOKEN` with the API key you generated earlier.
2. **If your new configuration is the last item inside `"mcpServers"`, remove the trailing comma `,`** or the JSON may fail to parse.

**Final example:**

```json
"mcpServers": {
    "Home Assistant": {
      "command": "mcp-proxy",
      "args": [
        "http://192.168.1.101:8123/mcp_server/sse"
      ],
      "env": {
        "API_ACCESS_TOKEN": "abcd.efghi.jkl"
      }
    }
  }
```

#### 3. Configure the Xiaozhi server system settings

1. **Choose any LLM that supports function_call as Xiaozhi’s chat model (but do not choose Home Assistant as the LLM tool).** In this example, I use the free ChatGLM model. It supports function calling, though it may be somewhat unstable. If you want better stability, set the LLM to `DoubaoLLM` and use the model name `doubao-1-5-pro-32k-250115`.

2. Open `xiaozhi-esp32-server/config.yaml`, configure your LLM model, and set `selected_module` → `Intent` to `function_call`.

3. Restart `xiaozhi-esp32-server`.
