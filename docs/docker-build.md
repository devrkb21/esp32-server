# Build Docker Images Locally

The project now uses GitHub's automatic Docker image build feature. If you are using the released images and do not need to build your own image, you can ignore this document.

If you modify the source code and want to deploy and run it with Docker, follow these steps:

## 1. Prepare the environment

Install Docker:
```bash
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

## 2. Build the images

After you finish modifying the code and need to build new images, do the following:

Prepare your `username` and `new version number`.
- `username` is the name you registered on Docker Hub, for example `xiaozhi`. If you do not plan to push to Docker Hub, you can choose any name.
- `new version number` is the image version you build, for example `1.2.3`. You can customize it as needed, or use a date format such as `20260609`. This makes it easy to distinguish it from the currently running version and also helps you remember when it was built. Do not use the same version number as the one currently running locally.

Go to the root directory of the `xiaozhi-esp32-server` project and build both the server and web images:

```bash
cd project-root

# Build the server image
docker build -f Dockerfile-server -t your-username/xiaozhi-esp32-server:new-version .

# Build the web image
docker build -f Dockerfile-web -t your-username/xiaozhi-esp32-server-web:new-version .
```

## 3. Update the docker-compose configuration

```bash
cd main/xiaozhi-server
```

Edit `docker-compose_all.yml` and replace the image versions with the ones you just built:

```yaml
services:
  xiaozhi-esp32-server:
    image: your-username/xiaozhi-esp32-server:new-version   # Change to your image address
    ...

  xiaozhi-esp32-server-web:
    image: your-username/xiaozhi-esp32-server-web:new-version   # Change to your image address
    ...
```

## 4. Restart the services

```bash
# Stop the old containers
docker compose -f docker-compose_all.yml down

# Start the new containers
docker compose -f docker-compose_all.yml up -d
```

## 5. Verify

Check the logs to confirm the services started correctly:

```bash
# Check server logs
docker logs -f -n 50 xiaozhi-esp32-server

# Check web logs
docker logs -f -n 50 xiaozhi-esp32-server-web
```