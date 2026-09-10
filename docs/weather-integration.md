# Weather Plugin Usage Guide

## Overview

The weather plugin `get_weather` is one of the core features of the Xiaozhi ESP32 voice assistant. It supports weather queries for locations across the country through voice input. Based on the QWeather API, it provides real-time weather and 7-day forecasts.

## API Key Application Guide

### 1. Register a QWeather account

1. Visit the [QWeather Console](https://console.qweather.com/).
2. Register an account and complete email verification.
3. Sign in to the console.

### 2. Create an app and get an API Key

1. After entering the console, click **Project Management** on the right and then **Create Project**.
2. Fill in the project information:
   - **Project Name**: for example, `Xiaozhi Voice Assistant`
3. Click Save.
4. After the project is created, click **Create Credential** in that project.
5. Fill in the credential information:
   - **Credential Name**: for example, `Xiaozhi Voice Assistant`
   - **Authentication Method**: choose **API Key**
6. Click Save.
7. Copy the `API Key` from the credential. This is the first key configuration item.

### 3. Get the API Host

1. In the console, click **Settings** → **API Host**.
2. Check the dedicated `API Host` assigned to you. This is the second key configuration item.

These steps give you two important values: `API Key` and `API Host`.

## Configuration Methods (choose one)

### Method 1. If you are using the control panel deployment (recommended)

1. Log in to the control panel.
2. Open the **Role Configuration** page.
3. Select the agent you want to configure.
4. Click **Edit Functions**.
5. Find the **Weather Query** plugin in the parameter section on the right.
6. Enable **Weather Query**.
7. Paste the first key value, `API Key`, into **Weather Plugin API Key**.
8. Paste the second key value, `API Host`, into **Developer API Host**.
9. Save the configuration, then save the agent configuration.

### Method 2. If you are using a single-module xiaozhi-server deployment

Add the following to `data/.config.yaml`:

1. Paste the first key value, `API Key`, into `api_key`.
2. Paste the second key value, `API Host`, into `api_host`.
3. Set `default_location` to your city, for example `Guangzhou`.

```yaml
plugins:
  get_weather:
    api_key: "your QWeather API key"
    api_host: "your QWeather API host"
    default_location: "your default query city"
```
