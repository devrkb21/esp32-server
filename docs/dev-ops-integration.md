# Full-module source deployment auto-update method

This guide is for users who run the project from source in full-module mode and want an automatic workflow to pull source code, compile it, and restart the services on the right ports with the highest possible update efficiency.

The project's test platform, `https://2662r3426b.vicp.fun`, has used this method since launch and it has worked well.

You can also refer to the video tutorial by the Bilibili creator `Bile Labs`: ["Open-source Xiaozhi server xiaozhi-server automatic updates and latest-version MCP endpoint configuration complete guide"](https://www.bilibili.com/video/BV15H37zHE7Q).

# Prerequisites

- Your computer or server runs Linux.
- You have already completed the full setup successfully.
- You like keeping up with the latest features, but find manual deployment updates annoying and want an automatic update method.

The second condition is mandatory because some files mentioned in this guide, such as JDK, Node.js, and Conda environments, only exist after you have completed the full setup. If you have not done that yet, some file references here may not make sense.

# What this workflow does

- Solves the problem of not being able to pull the latest source code in some regions.
- Automatically pulls code and builds the frontend.
- Automatically pulls code and builds the Java backend, kills the process on port 8002, and restarts it on port 8002.
- Automatically pulls the Python code, kills the process on port 8000, and restarts it on port 8000.

# Step 1: Choose your project directory

For example, I use the following fresh empty directory. If you want to avoid mistakes, you can use the same one:

```text
/home/system/xiaozhi
```

# Step 2: Clone the repository

First, run the following command to pull the source code. This command works on servers and computers with domestic network access and does not require a VPN:

```bash
cd /home/system/xiaozhi
git clone https://ghproxy.net/https://github.com/xinnan-tech/xiaozhi-esp32-server.git
```

After it finishes, a new folder named `xiaozhi-esp32-server` will appear in your project directory. That folder contains the source code.

# Step 3: Copy the base files

If you have already completed the full setup, the FunASR model file `xiaozhi-server/models/SenseVoiceSmall/model.pt` and your private config file `xiaozhi-server/data/.config.yaml` should already be familiar.

Now you need to copy the `model.pt` file into the new directory. You can do it like this:

```bash
# Create the required directories
mkdir -p /home/system/xiaozhi/xiaozhi-esp32-server/main/xiaozhi-server/data/

cp /path/to/your/original/.config.yaml /home/system/xiaozhi/xiaozhi-esp32-server/main/xiaozhi-server/data/.config.yaml
cp /path/to/your/original/model.pt /home/system/xiaozhi/xiaozhi-esp32-server/main/xiaozhi-server/models/SenseVoiceSmall/model.pt
```

# Step 4: Create three auto-build scripts

## 4.1 Auto-build the manager-web module

In `/home/system/xiaozhi/`, create a file named `update_8001.sh` with the following content:

```bash
cd /home/system/xiaozhi/xiaozhi-esp32-server
git fetch --all
git reset --hard
git pull origin main

cd /home/system/xiaozhi/xiaozhi-esp32-server/main/manager-web
npm install
npm run build
rm -rf /home/system/xiaozhi/manager-web
mv /home/system/xiaozhi/xiaozhi-esp32-server/main/manager-web/dist /home/system/xiaozhi/manager-web
```

Then make it executable:

```bash
chmod 777 update_8001.sh
```

Continue to the next step after that.

## 4.2 Auto-build and run the manager-api module

In `/home/system/xiaozhi/`, create a file named `update_8002.sh` with the following content:

```bash
cd /home/system/xiaozhi/xiaozhi-esp32-server
git pull origin main

cd /home/system/xiaozhi/xiaozhi-esp32-server/main/manager-api
rm -rf target
mvn clean package -Dmaven.test.skip=true
cd /home/system/xiaozhi/

# Find the process ID using port 8002
PID=$(sudo netstat -tulnp | grep 8002 | awk '{print $7}' | cut -d'/' -f1)

rm -rf /home/system/xiaozhi/xiaozhi-esp32-api.jar
mv /home/system/xiaozhi/xiaozhi-esp32-server/main/manager-api/target/xiaozhi-esp32-api.jar /home/system/xiaozhi/xiaozhi-esp32-api.jar

# Check whether a process was found
if [ -z "$PID" ]; then
  echo "No process found on port 8002"
else
  echo "Found process on port 8002: $PID"
  # Kill the process
  kill -9 $PID
  kill -9 $PID
  echo "Killed process $PID"
fi

nohup java -jar xiaozhi-esp32-api.jar --spring.profiles.active=dev &

tail -f nohup.out
```

Then make it executable:

```bash
chmod 777 update_8002.sh
```

Continue to the next step after that.

## 4.3 Auto-build and run the Python project

In `/home/system/xiaozhi/`, create a file named `update_8000.sh` with the following content:

```bash
cd /home/system/xiaozhi/xiaozhi-esp32-server
git pull origin main

# Find the process ID using port 8000
PID=$(sudo netstat -tulnp | grep 8000 | awk '{print $7}' | cut -d'/' -f1)

# Check whether a process was found
if [ -z "$PID" ]; then
  echo "No process found on port 8000"
else
  echo "Found process on port 8000: $PID"
  # Kill the process
  kill -9 $PID
  kill -9 $PID
  echo "Killed process $PID"
fi

cd main/xiaozhi-server
# Initialize the conda environment
source ~/.bashrc
conda activate xiaozhi-esp32-server
pip install -r requirements.txt
nohup python app.py >/dev/null &
tail -f /home/system/xiaozhi/xiaozhi-esp32-server/main/xiaozhi-server/tmp/server.log
```

Then make it executable:

```bash
chmod 777 update_8000.sh
```

Continue to the next step after that.

# Daily updates

After those scripts are created, daily updates are just a matter of running the following commands:

```bash
cd /home/system/xiaozhi
# Update and start the Java program
./update_8001.sh
# Update the web program
./update_8002.sh
# Update and start the Python program
./update_8000.sh

# Check the Java log later

tail -f nohup.out
# Check the Python log later
tail -f /home/system/xiaozhi/xiaozhi-esp32-server/main/xiaozhi-server/tmp/server.log
```

# Notes

The test platform `https://2662r3426b.vicp.fun` uses Nginx as a reverse proxy. You can [refer to this Nginx configuration](https://github.com/xinnan-tech/xiaozhi-esp32-server/issues/791).

## FAQ

### 1. Why don't I see port 8001?

Answer: 8001 is used for the development environment and is the port for running the frontend locally. If you are deploying to a server, it is not recommended to use `npm run serve` to run the frontend on port 8001. Instead, compile it into static HTML files like this guide describes, and let Nginx handle access.

### 2. Do I need to manually update SQL statements every time?

Answer: No. The project uses **Liquibase** to manage database versions, so new SQL scripts are executed automatically.
