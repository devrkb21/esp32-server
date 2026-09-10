# ESP32 Firmware Build

## Step 1: Prepare your OTA URL

If you are using version `0.3.12` of this project, both the simple server deployment and the full-module deployment will have an OTA URL.

Because the OTA URL setup differs between the simple server deployment and the full-module deployment, please choose the appropriate path below:

### If you are using the simple server deployment
Open your OTA URL in a browser. For example, my OTA URL is:

```text
http://192.168.1.25:8003/xiaozhi/ota/
```

If it shows that the OTA interface is running normally and prints the websocket URL, for example:

```text
OTA interface is running normally, the websocket URL sent to devices is: ws://xxx:8000/xiaozhi/v1/
```

You can start the `digital-human` module and open `index.html` to test whether it can connect to the websocket URL returned by the OTA page.

If you cannot access it, update `server.websocket` in the `.config.yaml` file, restart the service, and test again until `index.html` works correctly.

When this succeeds, continue to Step 2.

### If you are using the full-module deployment
Open your OTA URL in a browser. For example, my OTA URL is:

```text
http://192.168.1.25:8002/xiaozhi/ota/
```

If it shows that the OTA interface is running normally and the websocket cluster count is `X`, continue to Step 2.

If it shows that the OTA interface is not running correctly, you probably have not configured the websocket URL in the console yet. In that case:

- 1. Log in to the console as the super administrator.
- 2. Click `Parameter Management` in the top menu.
- 3. Find `server.websocket` in the list and enter your websocket URL. For example:

```text
ws://192.168.1.25:8000/xiaozhi/v1/
```

After configuring it, refresh the OTA URL again and check whether it is working normally. If it still does not work, confirm that the websocket service is running and that the websocket URL is configured correctly.

## Step 2: Set up the build environment

First, set up the project environment by following this guide: [Windows ESP IDF 5.3.2 development environment and Xiaozhi build guide](https://icnynnzcwou8.feishu.cn/wiki/JEYDwTTALi5s2zkGlFGcDiRknXf).

## Step 3: Open the configuration file

After the build environment is ready, download the xiaozhi-esp32 project source code from the Xiaozhi repository.

Download the xiaozhi-esp32 source code from here: [xiaozhi-esp32 project](https://github.com/78/xiaozhi-esp32).

After downloading, open the `xiaozhi-esp32/main/Kconfig.projbuild` file.

## Step 4: Change the OTA URL

Find the `default` value for `OTA_URL` and replace `https://api.tenclass.net/xiaozhi/ota/` with your own URL. For example, if my OTA URL is `http://192.168.1.25:8002/xiaozhi/ota/`, I would change it to that value.

Before:

```text
config OTA_URL
    string "Default OTA URL"
    default "https://api.tenclass.net/xiaozhi/ota/"
    help
        The application will access this URL to check for new firmwares and server address.
```

After:

```text
config OTA_URL
    string "Default OTA URL"
    default "http://192.168.1.25:8002/xiaozhi/ota/"
    help
        The application will access this URL to check for new firmwares and server address.
```

## Step 5: Set the build options

Run these commands:

```bash
# Enter the root directory of xiaozhi-esp32
cd xiaozhi-esp32

# Example: I use an esp32s3 board, so set the target to esp32s3.
# Replace it with the correct target for your board.
idf.py set-target esp32s3

# Open menuconfig
idf.py menuconfig
```

After menuconfig opens, go to `Xiaozhi Assistant` and set `BOARD_TYPE` to the exact model of your board.
Then save and exit back to the terminal.

## Step 6: Build the firmware

```bash
idf.py build
```

## Step 7: Package the firmware binary

```bash
cd scripts
python release.py
```

After the packaging command finishes, the firmware file `merged-binary.bin` will be generated in the project root `build` directory.
That `merged-binary.bin` is the firmware file you need to flash to the hardware.

Note: if the second command throws a `zip` related error, ignore it. As long as `merged-binary.bin` is generated in the `build` directory, it will not affect you much. You can continue.

## Step 8: Flash the firmware

Connect the ESP32 device to your computer, then open the following URL in Chrome:

```text
https://espressif.github.io/esp-launchpad/
```

Open this guide: [Flash tool / browser-based flashing (no IDF development environment)](https://ccnphfhqs21z.feishu.cn/wiki/Zpz4wXBtdimBrLk25WdcXzxcnNS).
Scroll to `Method 2: ESP-Launchpad browser flashing`, then start from `3. Flash firmware / download to development board` and follow the steps.

After flashing succeeds and the device connects successfully, wake Xiaozhi with the wake word and watch the server-side console output.

## FAQ

Here are some common questions for reference:

[1. Why does Xiaozhi recognize my speech as Korean, Japanese, or English?](./FAQ.md)

[2. Why do I get “TTS task error: file does not exist”?](./FAQ.md)

[3. Why does TTS fail or time out so often?](./FAQ.md)

[4. Wi-Fi can connect to my self-hosted server, but 4G mode cannot](./FAQ.md)

[5. How can I improve Xiaozhi's response speed?](./FAQ.md)

[6. I speak slowly, and Xiaozhi keeps interrupting me when I pause](./FAQ.md)

[7. I want Xiaozhi to control lights, air conditioners, remote power on/off, and similar actions](./FAQ.md)
