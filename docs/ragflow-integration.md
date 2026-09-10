# RAGFlow Integration Guide

This guide has two parts:

- 1. How to deploy RAGFlow
- 2. How to configure the RAGFlow interface in the control console

If you are already familiar with RAGFlow and have it deployed, you can skip Part 1 and go directly to Part 2. If you want step-by-step guidance for deploying RAGFlow so it can share the same MySQL and Redis services with `xiaozhi-esp32-server` to reduce resource usage, start from Part 1.

# Part 1. How to deploy RAGFlow

## Step 1. Make sure MySQL and Redis are available

RAGFlow depends on a `mysql` database. If you have already deployed the control console, then MySQL is already installed and you can reuse it.

You can test from the host machine with `telnet` to see whether ports `3306` and `6379` are reachable:

``` shell
telnet 127.0.0.1 3306

telnet 127.0.0.1 6379
```

If both ports are reachable, skip the rest of this section and go directly to Step 2.

If not, check how your MySQL instance was installed.

If MySQL was installed using a package installer, it may be isolated from the network. You may need to fix access to port `3306` first.

If MySQL was installed through this project's `docker-compose_all.yml`, locate the `docker-compose_all.yml` file you used to create it and change the following.

Before:
``` yaml
  xiaozhi-esp32-server-db:
    ...
    networks:
      - default
    expose:
      - "3306:3306"
  xiaozhi-esp32-server-redis:
    ...
    expose:
      - 6379
```

After:
``` yaml
  xiaozhi-esp32-server-db:
    ...
    networks:
      - default
    ports:
      - "3306:3306"
  xiaozhi-esp32-server-redis:
    ...
    ports:
      - "6379:6379"
```

Note that you should change `expose` to `ports` under both `xiaozhi-esp32-server-db` and `xiaozhi-esp32-server-redis`. After that, restart the stack with:

``` shell
# Go to the folder containing docker-compose_all.yml, for example xiaozhi-server
cd xiaozhi-server
docker compose -f docker-compose_all.yml down
docker compose -f docker-compose.yml up -d
```

After startup, test again with `telnet`:

``` shell
telnet 127.0.0.1 3306

telnet 127.0.0.1 6379
```

If everything is correct, the ports should be reachable.

## Step 2. Create the database and tables

If your host machine can reach MySQL, create a database named `rag_flow` and a user named `rag_flow` with password `infini_rag_flow`.

``` sql
-- Create database
CREATE DATABASE IF NOT EXISTS rag_flow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user and grant permissions
CREATE USER IF NOT EXISTS 'rag_flow'@'%' IDENTIFIED BY 'infini_rag_flow';
GRANT ALL PRIVILEGES ON rag_flow.* TO 'rag_flow'@'%';

-- Refresh privileges
FLUSH PRIVILEGES;
```

## Step 3. Download the RAGFlow project

Find a folder on your machine to store the RAGFlow project. For example, I use `/home/system/xiaozhi`.

You can use `git` to clone the project. This guide uses version `v0.22.0`.

``` 
git clone https://ghfast.top/https://github.com/infiniflow/ragflow.git
cd ragflow
git checkout v0.22.0
```

After that, enter the `docker` folder:

``` shell
cd docker
```

Edit `ragflow/docker/docker-compose.yml` and remove the `depends_on` settings from the `ragflow-cpu` and `ragflow-gpu` services so that `ragflow-cpu` no longer depends on MySQL.

Before:
``` yaml
  ragflow-cpu:
    depends_on:
      mysql:
        condition: service_healthy
    profiles:
      - cpu
  ...
  ragflow-gpu:
    depends_on:
      mysql:
        condition: service_healthy
    profiles:
      - gpu
```

After:
``` yaml
  ragflow-cpu:
    profiles:
      - cpu
  ...
  ragflow-gpu:
    profiles:
      - gpu
```

Next, edit `ragflow/docker/docker-compose-base.yml` and remove the `mysql` and `redis` service definitions.

For example, before deleting:
``` yaml
services:
  minio:
    image: quay.io/minio/minio:RELEASE.2025-06-13T11-33-47Z
    ...
  mysql:
    image: mysql:8.0
    ...
  redis:
    image: redis:6.2-alpine
    ...
```

After deleting:
``` yaml
services:
  minio:
    image: quay.io/minio/minio:RELEASE.2025-06-13T11-33-47Z
    ...
```

## Step 4. Update environment variables

Edit the `.env` file in `ragflow/docker` and search for the following settings one by one. Search and edit each one carefully.

A common mistake is forgetting `MYSQL_USER`, which causes RAGFlow to fail to start. This is important, so I will repeat it three times:

- First reminder: if your `.env` file does not contain `MYSQL_USER`, add it.
- Second reminder: if your `.env` file does not contain `MYSQL_USER`, add it.
- Third reminder: if your `.env` file does not contain `MYSQL_USER`, add it.

``` env
# Port settings
SVR_WEB_HTTP_PORT=8008           # HTTP port
SVR_WEB_HTTPS_PORT=8009          # HTTPS port
# MySQL settings - change to your local MySQL information
MYSQL_HOST=host.docker.internal  # Use host.docker.internal so the container can access host services
MYSQL_PORT=3306                  # Local MySQL port
MYSQL_USER=rag_flow              # The username you created above; add it if missing
MYSQL_PASSWORD=infini_rag_flow   # The password you set above
MYSQL_DBNAME=rag_flow            # Database name

# Redis settings - change to your local Redis information
REDIS_HOST=host.docker.internal  # Use host.docker.internal so the container can access host services
REDIS_PORT=6379                  # Local Redis port
REDIS_PASSWORD=                  # Leave blank if your Redis has no password; otherwise fill in the password
```

If your Redis does not have a password, also edit `ragflow/docker/service_conf.yaml.template` and replace `infini_rag_flow` with an empty string.

Before:
``` shell
redis:
  db: 1
  password: '${REDIS_PASSWORD:-infini_rag_flow}'
  host: '${REDIS_HOST:-redis}:6379'
```

After:
``` shell
redis:
  db: 1
  password: '${REDIS_PASSWORD:-}'
  host: '${REDIS_HOST:-redis}:6379'
```

## Step 5. Start the RAGFlow service

Run:
``` shell
docker-compose -f docker-compose.yml up -d
```

After a successful start, you can view the logs with:

``` shell
docker logs -n 20 -f docker-ragflow-cpu-1
```

If there are no errors in the logs, RAGFlow has started successfully.

## Step 6. Register an account

You can open `http://127.0.0.1:8008` in a browser and click `Sign Up` to create an account.

After registration, click `Sign In` to log in. If you want to disable registration, set `REGISTER_ENABLED` to `0` in `ragflow/docker/.env`.

``` dotenv
REGISTER_ENABLED=0
```

Then restart the service:

``` shell
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml up -d
```

## Step 7. Configure the RAGFlow models

Open `http://127.0.0.1:8008` in a browser, click `Sign In`, and log in. Then click the avatar in the top-right corner to open the settings page.

In the left sidebar, click `Model Providers` to open the model configuration page. In the `Available Models` search box on the right, choose `LLM`, select your provider from the list, click `Add`, and enter your API key.

Then choose `TEXT EMBEDDING`, select your provider from the list, click `Add`, and enter your API key.

Finally, refresh the page and set the default LLM and Embedding models to the ones you want to use. Make sure the API key has access to the corresponding service. For example, if your Embedding model comes from provider `xxx`, check whether that provider requires you to purchase a resource package before use.

# Part 2. Configure RAGFlow in the control console

## Step 1. Log in to RAGFlow

Open `http://127.0.0.1:8008` in a browser, click `Sign In`, and log in to RAGFlow.

Then click the avatar in the top-right corner to open the settings page. In the left sidebar, click `API`, then click the `API Key` button. A dialog will appear.

In the dialog, click `Create new Key` to generate an API key. Copy this `API Key`; you will need it later.

## Step 2. Configure the control console

Make sure your control console version is `0.8.7` or later. Log in with the super administrator account.

First, enable the knowledge base feature. In the top navigation bar, click `Parameter Dictionary`, then open `System Function Configuration`. Check `Knowledge Base` on the page and click `Save Configuration`. The `Knowledge Base` item will then appear in the navigation bar.

In the top navigation bar, click `Model Configuration`, then click `Knowledge Base` in the left sidebar. Find `RAG_RAGFlow` in the list and click `Edit`.

In `Service Address`, enter `http://your-ragflow-server-lan-ip:8008`. For example, if my RAGFlow server LAN IP is `192.168.1.100`, I would enter `http://192.168.1.100:8008`.

In `API Key`, paste the `API Key` you copied earlier.

Finally, click `Save`.

## Step 3. Create a knowledge base

Log in to the control console with the super administrator account. In the top navigation bar, click `Knowledge Base`, then click `New` in the lower-left corner of the list. Enter a name and description for the knowledge base, then click `Save`.

To improve retrieval quality and the model's understanding, use a meaningful name and description. For example, if you are creating a knowledge base for company information, the name could be `Company Overview`, and the description could be `Basic company information, services, contact numbers, addresses, and related details.`

After saving, you will see the knowledge base in the list. Click `View` on the newly created knowledge base to open its detail page.

On the knowledge base detail page, click `New` in the lower-left corner to upload documents into the knowledge base.