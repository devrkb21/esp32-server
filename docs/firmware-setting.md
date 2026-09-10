# Configure a Custom Server with Xiaoge-Compiled Firmware

## Step 1: Confirm the version
Flash [firmware version 1.6.1 or later](https://github.com/78/xiaozhi-esp32/releases) compiled by Xiaoge.

## Step 2: Prepare your OTA address
If you followed the tutorial for full-module deployment, you should already have an OTA address.

Open your OTA address in a browser. For example, my OTA address is:
```text
https://2662r3426b.vicp.fun/xiaozhi/ota/
```

If you see “OTA interface is running normally, websocket cluster count: X”, continue.

If you see “OTA interface is not running normally”, you probably have not configured the `Websocket` address in the control panel yet. Do the following:

- 1. Log in to the control panel as the super administrator.
- 2. Click `Parameter Management` in the top menu.
- 3. Find `server.websocket` in the list and enter your `Websocket` address. For example:

```text
wss://2662r3426b.vicp.fun/xiaozhi/v1/
```

After configuring it, refresh the OTA address in your browser and check again. If it still does not work, verify that Websocket is running correctly and that the Websocket address is configured properly.

## Step 3: Enter pairing mode
Enter the device pairing mode. On the page top, click `Advanced Options`, enter your server’s `ota` address, and save. Then restart the device.

![OTA address setup](../docs/images/firmware-setting-ota.png)

## Step 4: Wake Xiaozhi and check the logs

Wake Xiaozhi and confirm that the logs are output normally.

## FAQ
Here are some common questions for reference:

[1. Why does Xiaozhi recognize a lot of Korean, Japanese, or English when I speak?](./FAQ.md)

[2. Why do I get “TTS task error: file does not exist”?](./FAQ.md)

[3. Why does TTS often fail or time out?](./FAQ.md)

[4. Why can Wi‑Fi connect to my self-hosted server, but 4G cannot?](./FAQ.md)

[5. How can I improve Xiaozhi’s response speed?](./FAQ.md)

[6. I speak slowly, and Xiaozhi keeps interrupting me when I pause.](./FAQ.md)

[7. I want Xiaozhi to control lights, air conditioners, remote power, and similar actions.](./FAQ.md)
