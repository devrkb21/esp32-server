# Voiceprint Recognition Setup Guide

This guide has 3 parts:
- 1. How to deploy the voiceprint recognition service
- 2. How to configure the voiceprint API in a full-module deployment
- 3. How to configure voiceprint in a minimal deployment

# 1. How to deploy the voiceprint recognition service

## Step 1: Download the voiceprint project source code

Open the voiceprint project page in your browser:
[https://github.com/xinnan-tech/voiceprint-api](https://github.com/xinnan-tech/voiceprint-api)

On the page, find the green `Code` button, click it, and then click `Download ZIP`.

Download the source archive to your computer, extract it, and rename the extracted folder if necessary. It may be named `voiceprint-api-main`.
You should rename it to `voiceprint-api`.

## Step 2: Create the database and table

Voiceprint recognition depends on a `mysql` database. If you already deployed the `admin console` before, then MySQL is probably already installed and can be reused.

You can try using the `telnet` command on the host machine to check whether MySQL port `3306` is reachable:
```bash
telnet 127.0.0.1 3306
```
If port 3306 is reachable, you can skip the following content and go directly to Step 3.

If it is not reachable, you need to check how your MySQL instance was installed.

If your MySQL was installed with a standalone installer package, it may be network-isolated. You may need to solve the problem of reaching port `3306` first.

If your MySQL was installed through this project's `docker-compose_all.yml`, find that file and update the following section.

Before:
```yaml
  xiaozhi-esp32-server-db:
    ...
    networks:
      - default
    expose:
      - "3306:3306"
```

After:
```yaml
  xiaozhi-esp32-server-db:
    ...
    networks:
      - default
    ports:
      - "3306:3306"
```

Note that you need to change `expose` to `ports` under `xiaozhi-esp32-server-db`. After that, restart the service. The restart commands are:

```bash
# Enter the folder that contains docker-compose_all.yml, for example xiaozhi-server
cd xiaozhi-server
docker compose -f docker-compose_all.yml down
docker compose -f docker-compose.yml up -d
```

After the restart, use `telnet` again on the host machine to check whether MySQL port `3306` is reachable:
```bash
telnet 127.0.0.1 3306
```
Normally, that should work.

## Step 3: Create the database and table

If the host machine can reach MySQL successfully, create a database named `voiceprint_db` and a `voiceprints` table:

```sql
CREATE DATABASE voiceprint_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE voiceprint_db;

CREATE TABLE voiceprints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    speaker_id VARCHAR(255) NOT NULL UNIQUE,
    feature_vector LONGBLOB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_speaker_id (speaker_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Step 4: Configure the database connection

Enter the `voiceprint-api` folder and create a folder named `data`.

Copy `voiceprint.yaml` from the root of `voiceprint-api` into the `data` folder and rename it to `.voiceprint.yaml`.

Now configure the database connection in `.voiceprint.yaml`:

```yaml
mysql:
  host: "127.0.0.1"
  port: 3306
  user: "root"
  password: "your_password"
  database: "voiceprint_db"
```

Important: because your voiceprint service is deployed with Docker, `host` should be set to the **LAN IP of the machine running MySQL**.

Important: because your voiceprint service is deployed with Docker, `host` should be set to the **LAN IP of the machine running MySQL**.

Important: because your voiceprint service is deployed with Docker, `host` should be set to the **LAN IP of the machine running MySQL**.

## Step 5: Start the service

This is a simple project, so Docker is recommended. If you do not want to use Docker, you can follow the [project README](https://github.com/xinnan-tech/voiceprint-api/blob/main/README.md) to run it from source. Below is the Docker approach:

```bash
# Enter the root directory of the source code
cd voiceprint-api

# Clear cached containers/images
docker compose -f docker-compose.yml down
docker stop voiceprint-api
docker rm voiceprint-api
docker rmi ghcr.nju.edu.cn/xinnan-tech/voiceprint-api:latest

# Start the Docker container
docker compose -f docker-compose.yml up -d
# View logs
docker logs -f voiceprint-api
```

At this point, the logs should look something like this:
```text
250711 INFO-🚀 Start: production service startup (Uvicorn), listening on: 0.0.0.0:8005
250711 INFO-============================================================
250711 INFO-Voiceprint endpoint: http://127.0.0.1:8005/voiceprint/health?key=abcd
250711 INFO-============================================================
```

Copy the voiceprint endpoint URL:

Because you are deploying with Docker, **do not use the URL above directly**.

Because you are deploying with Docker, **do not use the URL above directly**.

Because you are deploying with Docker, **do not use the URL above directly**.

Copy the URL into a draft. You need to know your computer's LAN IP. For example, if your LAN IP is `192.168.1.25`, then

your original endpoint:
```text
http://127.0.0.1:8005/voiceprint/health?key=abcd
```
should be changed to:
```text
http://192.168.1.25:8005/voiceprint/health?key=abcd
```

After changing it, open the voiceprint endpoint URL directly in your browser. If you see output like this, it means success:
```json
{"total_voiceprints":0,"status":"healthy"}
```

Keep the modified voiceprint endpoint URL. You will need it in the next step.

# 2. How to configure voiceprint in a full-module deployment

## Step 1: Configure the endpoint
First, enable the voiceprint feature. In the admin console, click the top menu `Parameter Dictionary`, then open the `System Function Configuration` page from the dropdown menu. Check `Voiceprint Recognition` and click `Save Configuration`. After that, you will see a `Voiceprint Recognition` button on the new agent card.

If you are using a full-module deployment, log in to the admin console with an administrator account, click `Parameter Dictionary` in the top menu, and open `Parameter Management`.

Then search for the parameter `server.voice_print`. Its value should currently be `null`.
Click the edit button, paste the voiceprint endpoint URL from the previous step into the `Parameter Value` field, and save.

If saving succeeds, everything is fine and you can check the agent behavior now. If it fails, the admin console probably cannot reach the voiceprint service. Most likely this is a network firewall issue, or the LAN IP was entered incorrectly.

## Step 2: Set the agent memory mode

Open your agent's role configuration and set memory to `local short-term memory`. Make sure `report text + voice` is enabled.

## Step 3: Chat with your agent

Power on your device and talk to it at a normal speed and tone.

## Step 4: Set up voiceprint profiles

On the admin console, in the `Agent Management` page, there is a `Voiceprint Recognition` button on the agent panel. Click it. At the bottom, there is an `Add` button that lets you register voiceprints for a person.
In the popup, it is recommended to fill in the `description` field. You can use the person's job, personality, or hobbies to help the agent analyze and understand the speaker.

## Step 3: Chat with your agent

Power on your device and ask it: `Do you know who I am?` If it can answer correctly, voiceprint recognition is working properly.

# 3. How to configure voiceprint in a minimal deployment

## Step 1: Configure the endpoint
Open `xiaozhi-server/data/.config.yaml` (create it if it does not exist), then add or update the following content:

```yaml
# Voiceprint recognition configuration
voiceprint:
  # Voiceprint endpoint URL
  url: your voiceprint endpoint URL
  # Speaker configuration: speaker_id, name, description
  speakers:
    - "test1,John Zhang,John Zhang is a programmer"
    - "test2,Li Si,Li Si is a product manager"
    - "test3,Wang Wu,Wang Wu is a designer"
```

Paste the voiceprint endpoint URL from the previous step into `url`, then save.

Add `speakers` entries as needed. Pay attention to the `speaker_id` field, because you will use it later when registering voiceprints.

## Step 2: Register a voiceprint
If you have already started the voiceprint service, open `http://localhost:8005/voiceprint/docs` in your browser to view the API documentation. Here we only explain how to use the voiceprint registration API.

The voiceprint registration API is `http://localhost:8005/voiceprint/register`, and the request method is POST.

The request header must include Bearer Token authentication. The token is the part after `?key=` in the voiceprint endpoint URL. For example, if my voiceprint registration URL is `http://127.0.0.1:8005/voiceprint/health?key=abcd`, then my token is `abcd`.

The request body includes the speaker ID (`speaker_id`) and a WAV audio file (`file`). Example:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "speaker_id=your_speaker_id_here" \
  -F "file=@/path/to/your/file" \
  http://localhost:8005/voiceprint/register
```

Here, `file` should be an audio recording of the person you want to register, and `speaker_id` must match the `speaker_id` configured in Step 1. For example, if I want to register Zhang San's voiceprint and the `speaker_id` for Zhang San in `.config.yaml` is `test1`, then the `speaker_id` in the request body must also be `test1`, and `file` should be an audio file of Zhang San speaking.

## Step 3: Start the services

Start the Xiaozhi server and the voiceprint service, and you can use them normally.
