# Device-to-Device Call Plugin Guide

## Overview

The device call feature enables two configured devices to communicate bidirectionally through voice/data channels. When Device A calls Device B, the system follows this flow:

```text
Device A → authorization check → MQTT gateway → remote wakeup of Device B → connection established → call begins
```

## Prerequisites

1. You must have at least two devices, and each device must be an `ESP32-S3` model, because only `ESP32-S3` supports remote wakeup.
2. Your devices should ideally have `two microphones`. If a device only has a single microphone and you just want to try the feature, that is still possible, but the experience will be noticeably laggy.
3. You must use the [full-module deployment](Deployment_all.md) of this project, because you need the `management console` to manage device permissions and communication.
4. You must install and configure the [MQTT gateway service](mqtt-gateway-integration.md) from after `2026-05-27`. If you already deployed the MQTT gateway service, make sure the code version is from after `2026-05-27`.

Those are the hard requirements. The next sections explain the setup in detail.

## Configuration Steps

### Step 1: Enable the address book feature

1. Confirm that your management console version is `0.9.4` or later.
2. Log in to the management console.
3. Go to **System Feature Configuration**.
4. In the feature list on the left, check **Address Book**.
5. Click **Save Configuration**.

### Step 2: Configure device-to-device call permissions

1. In the top menu of the management console, click **Address Book**.
2. Under the selected agent on the left, choose Device A from the device list (you can search by MAC address or remark name).
3. In the right-side details panel, find the naming setting for target Device B, for example **"Xiao Wang"**.
4. Check the **Call Permission** checkbox for Device B.
5. Click **Save**.

**Two-way authorization:** If you want Device A and Device B to communicate with each other, you must configure the other side separately in the console. For example:

- In Device A’s configuration, check Device B → Device A can communicate with Device B
- In Device B’s configuration, check Device A → Device B can communicate with Device A

### Step 3: Add the call tool to the agent configuration

1. In the top menu of the management console, click **Agent Management**.
2. In the agent associated with the configured device contact, click **Edit Role**.
3. In the right-side details panel, click **Edit Functions**.
4. Check the **Device Calls Device** tool.
5. Click **Save Configuration**.
6. Click **Save Configuration** again in the outer panel, then restart the device.

### Step 4: Add the remote wakeup tool on the firmware side

1. Based on the [xiaozhi-esp32](https://github.com/78/xiaozhi-esp32) codebase, add the remote wakeup MCP tool. Supported versions are 2.1.0 to 2.2.6 (the 2026-05-29 release).
2. Add the remote wakeup function declaration in `application.h`:
    ```cpp
    void RemoteWakeup(const std::string& reason);
    ```
3. Add the remote wakeup function in `application.cc`:
    ```cpp
    void Application::RemoteWakeup(const std::string& reason){
        if (!protocol_) {
            return;
        }

        auto state = GetDeviceState();
        
        if (state == kDeviceStateIdle) {
            audio_service_.EncodeWakeWord();

            if (!protocol_->IsAudioChannelOpened()) {
                SetDeviceState(kDeviceStateConnecting);
                if (!protocol_->OpenAudioChannel()) {
                    audio_service_.EnableWakeWordDetection(true);
                    return;
                }
            }
            std::string wake_word = reason;
    #if CONFIG_USE_AFE_WAKE_WORD || CONFIG_USE_CUSTOM_WAKE_WORD
            // Encode and send the wake word data to the server
            while (auto packet = audio_service_.PopWakeWordPacket()) {
                protocol_->SendAudio(std::move(packet));
            }
            // Set the chat state to wake word detected
            protocol_->SendWakeWordDetected(wake_word);
            SetListeningMode(aec_mode_ == kAecOff ? kListeningModeAutoStop : kListeningModeRealtime);
    #else
            // Set flag to play popup sound after state changes to listening
            // (PlaySound here would be cleared by ResetDecoder in EnableVoiceProcessing)
            play_popup_on_listening_ = true;
            SetListeningMode(aec_mode_ == kAecOff ? kListeningModeAutoStop : kListeningModeRealtime);
    #endif
        } else if (state == kDeviceStateSpeaking) {
            AbortSpeaking(kAbortReasonWakeWordDetected);
            SetDeviceState(kDeviceStateIdle);
        } else if (state == kDeviceStateActivating) {
            SetDeviceState(kDeviceStateIdle);
        }
    }
    ```
4. Add the remote wakeup tool in `mcp_server.cc`:
    ```cpp
    AddUserOnlyTool("self.remote_wakeup", "Remote wakeup function with configurable parameters",
        PropertyList({
            Property("reason", kPropertyTypeString, "Wakeup reason"),
        }),
        [this](const PropertyList& properties) -> ReturnValue {
            std::string reason = properties["reason"].value<std::string>();
            ESP_LOGI(TAG, "Wakeup reason=%s", reason.c_str());
            auto& app = Application::GetInstance();
            app.RemoteWakeup(reason);
            return true;
    ```
5. Follow the [firmware build and flashing guide](firmware-build.md) to flash the firmware.
6. Whether your device has one microphone or two, make sure AEC is enabled during compilation.
7. Whether your device has one microphone or two, make sure AEC is enabled during compilation.
8. Whether your device has one microphone or two, make sure AEC is enabled during compilation.

### Step 5: Configure the MQTT gateway service

1. Deploy the MQTT gateway service by following the [MQTT gateway integration guide](mqtt-gateway-integration.md).
2. If it is already deployed, confirm that the code version is from `2026-05-27`.

## Call Flow

Prepare two devices. After configuring communication permissions in the management console and adding the call tool to the agent, say to one of the devices: "Call XXX" and observe whether Device B responds.

## FAQ

### Q: Device B does not respond to the call?

- Check whether Device B is online (in the device status view of the management console)
- Confirm that Device B’s firmware correctly integrates the remote wakeup tool
- Check whether the MQTT gateway connection is working properly
- Verify that the bidirectional permission configuration is complete

### Q: It says "No call permission"?

- Confirm in the management console that Device A has Device B checked for call permission
- Confirm the configuration was saved, not just edited

### Q: How do I confirm that the address book feature is enabled?

- If the top menu of the management console shows an **Address Book** entry, the feature is enabled

### Q: I say "Zhang Shan", but it keeps recognizing it as "Zhang San". What should I do?

- Check the documentation of the ASR service you are using to confirm whether hotword recognition is supported.
- If you use `FunASRServer`, add "Zhang Shan" to the hotword file inside the container, then restart the container.
- If you use the `Volcengine` service, add the hotword file in the Volcengine console, then return to the management console’s **Model Configuration** page and set the hotword file name on Volcengine TTS.
