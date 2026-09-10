# Control Panel: Volcano Engine Dual-Stream TTS + Voice Cloning Setup Guide

This guide is divided into four stages: preparation, configuration, cloning, and usage. It explains how to configure Volcano Engine dual-stream TTS and voice cloning in the control panel.

## Stage 1: Preparation

The super administrator should first enable the Volcano Engine service and obtain the App ID and Access Token. By default, Volcano Engine provides one voice resource. That voice resource needs to be copied into this project.

If you want to clone multiple voices, you need to purchase and enable multiple voice resources. Copy each voice resource ID (`S_xxxxx`) into this project, then assign it to the system account for use. The detailed steps are below:

### 1. Enable Volcano Engine

Visit https://console.volcengine.com/speech/app and create an application in the application management page. Enable both the TTS large model and the voice cloning large model.

### 2. Get the voice resource ID

Visit https://console.volcengine.com/speech/service/9999 and copy these three items: App ID, Access Token, and the voice resource ID (`S_xxxxx`). See the image below.

![Get voice resource](images/image-clone-integration-01.png)

## Stage 2: Configure Volcano Engine

### 1. Fill in the Volcano Engine settings

Log in to the control panel as the super administrator. Click **Model Configuration** at the top, then click **Speech Synthesis** on the left side of the Model Configuration page. Find **Volcano Engine Dual-Stream TTS**, click edit, and fill your Volcano Engine `App ID` into the **Application ID** field and your `Access Token` into the **Access Token** field. Then save.

### 2. Assign the voice resource ID to a system account

Log in to the control panel as the super administrator. Click **Parameter Dictionary** at the top, then open **System Function Configuration** from the dropdown menu. Enable **Voice Cloning** and save the configuration. After that, a **Voice Cloning** menu item will appear at the top.

Log in again as the super administrator, then go to **Voice Cloning** → **Voice Resources**.

Click **Add New**. For **Platform Name**, select **Volcano Engine Dual-Stream TTS**.

In **Voice Resource ID**, enter your Volcano Engine voice resource ID (`S_xxxxx`) and press Enter.

For **Assigned Account**, choose the system account you want to assign it to. You can assign it to yourself, then click Save.

## Stage 3: Cloning

If, after logging in, you click **Voice Cloning** → **Voice Cloning** and see **Your account currently has no voice resources. Please contact the administrator to assign voice resources**, it means you have not assigned a voice resource ID to this account yet. Go back to Stage 2 and assign the voice resource to the corresponding account.

If, after logging in, you click **Voice Cloning** → **Voice Cloning** and can see the corresponding voice list, continue.

In the list, select one voice resource and click **Upload Audio**. After uploading, you can listen to the voice or trim a section of it. When ready, click **Upload Audio**.

![Upload audio](images/image-clone-integration-02.png)

After the audio is uploaded, the corresponding voice will change to **Pending Cloning**. Click **Clone Now**. The result should return within 1–2 seconds.

If cloning fails, hover over the **error information** icon to see the reason.

If cloning succeeds, the corresponding voice in the list will change to **Training Successful**. At that point, you can click the edit button in the **Voice Name** column to rename the voice resource for easier selection later.

## Stage 4: Usage

Click **Agent Management** at the top, select any agent, and click **Configure Role**.

For Text-to-Speech (TTS), choose **Volcano Engine Dual-Stream TTS**. In the list, find the voice resource whose name includes **Cloned Voice** (as shown in the image), select it, and click Save.

![Select voice](images/image-clone-integration-03.png)

You can now wake Xiaozhi and talk to it.