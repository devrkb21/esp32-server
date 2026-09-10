# All-in-One Digital Human Setup Guide

This project deploys a complete digital-human display system on x86 devices such as mini PCs, industrial PCs, and regular desktop computers.

It provides:
- automatic kiosk full-screen browser launch on boot to show a selected webpage
- a background wake-word detection service for voice interaction

> **Note**: This guide uses an **Intel N100 mini PC (Tianhong QN10-100B4)** as the example. You can adapt the steps for other x86 devices, but pay attention to network and audio-device differences.

## Target environment

| Item | Details |
|------|------|
| Example hardware | Tianhong QN10-100B4 (Intel N100) |
| Operating system | Ubuntu 24.04 LTS (Noble Numbat) |
| Example user | xz (replace with your own user) |
| Network | Wi-Fi with a fixed IP (you can switch to wired if needed) |

## Deployment flow

1. System initialization (mirror, networking)
2. Install GUI components and kiosk browser
3. Configure auto-login and graphical session startup
4. Deploy the wake-word service (Python environment + microphone)
5. Optimize boot speed and hide boot messages

---

### System initialization (mirror, networking)

```bash
sudo cp /etc/apt/sources.list /etc/apt/sources.list.bak

sudo tee /etc/apt/sources.list > /dev/null <<EOF
deb http://mirrors.aliyun.com/ubuntu/ noble main restricted universe multiverse
# deb-src http://mirrors.aliyun.com/ubuntu/ noble main restricted universe multiverse

deb http://mirrors.aliyun.com/ubuntu/ noble-security main restricted universe multiverse
# deb-src http://mirrors.aliyun.com/ubuntu/ noble-security main restricted universe multiverse

deb http://mirrors.aliyun.com/ubuntu/ noble-updates main restricted universe multiverse
# deb-src http://mirrors.aliyun.com/ubuntu/ noble-updates main restricted universe multiverse

deb http://mirrors.aliyun.com/ubuntu/ noble-proposed main restricted universe multiverse
# deb-src http://mirrors.aliyun.com/ubuntu/ noble-proposed main restricted universe multiverse

deb http://mirrors.aliyun.com/ubuntu/ noble-backports main restricted universe multiverse
# deb-src http://mirrors.aliyun.com/ubuntu/ noble-backports main restricted universe multiverse
EOF

echo 'Acquire::ForceIPv4 "true";' | sudo tee /etc/apt/apt.conf.d/99force-ipv4
```

Install NetworkManager if it is not already present:

```bash
sudo apt update
sudo apt install network-manager -y
sudo systemctl start NetworkManager
sudo systemctl enable NetworkManager
```

Set Wi-Fi and a fixed IP:

> **Reminder**: Replace the Wi-Fi name, password, and IP address below with your own values.

```bash
sudo nmcli device wifi connect "MERCURY_1812" password "12345678"

sudo nmcli connection modify "MERCURY_1812" ipv4.addresses "192.168.0.86/24" ipv4.gateway "192.168.0.1" ipv4.dns "8.8.8.8,114.114.114.114" ipv4.method "manual"

sudo nmcli connection up "MERCURY_1812"
```

### Step 1: Install the core graphical stack and browser

We keep this minimal: no GNOME/KDE desktop, only the basic drivers, a lightweight window manager (Openbox), a mouse-hiding tool, and Google Chrome.

```bash
sudo timedatectl set-timezone Asia/Shanghai

sudo apt install net-tools vim fonts-wqy-microhei fonts-wqy-zenhei alsa-utils pulseaudio -y
sudo apt install --no-install-recommends xserver-xorg x11-xserver-utils xinit openbox unclutter -y

wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install ./google-chrome-stable_current_amd64.deb -y
rm google-chrome-stable_current_amd64.deb

sudo apt purge snapd -y
```

### Step 2: Configure passwordless auto-login on TTY1

To avoid typing the username and password every time, we modify the systemd service so the machine logs in automatically as `xz` on boot.

**1. Create the override directory:**

```bash
sudo mkdir -p /etc/systemd/system/getty@tty1.service.d/
```

**2. Write the auto-login rule:**

```bash
echo -e "[Service]\nExecStart=\nExecStart=-/sbin/agetty --autologin xz --noclear %I \$TERM" | sudo tee /etc/systemd/system/getty@tty1.service.d/override.conf
```

**3. Reload systemd and set the default target:**

```bash
sudo systemctl daemon-reload
sudo systemctl set-default multi-user.target
```

### Step 3: Start the graphical session automatically after login

After auto-login, the system stays in the terminal by default. We need a script that immediately launches the X11 graphical session.

**1. Add the `startx` trigger to your shell profile:**

```bash
cat << 'EOF' >> ~/.bash_profile
if [ -z "$DISPLAY" ] && [ "$(fgconsole)" -eq 1 ]; then
    exec startx
fi
EOF
```

**2. Tell `startx` to launch Openbox:**

```bash
echo "exec openbox-session" > ~/.xinitrc
```

### Step 4: Configure a hardened Openbox + browser setup

This is the core part: disable screen blanking, hide the mouse, lock Chrome into kiosk mode, and keep it in a loop so it restarts instantly if closed.

**1. Create the Openbox config directory:**

```bash
mkdir -p ~/.config/openbox
```

**2. Write the autostart script (`autostart`):**

```bash
cat << 'EOF' > ~/.config/openbox/autostart
# Disable screen blanking
xset -dpms
xset s noblank
xset s off

# Hide the mouse cursor
unclutter -idle 0.1 -root &

# Keep Chromium in a restart loop
while true; do
    google-chrome \
        --kiosk \
        --no-first-run \
        --no-default-browser-check \
        --disable-infobars \
        --disable-session-crashed-bubble \
        --disable-translate \
        --disable-external-intent-requests \
        --autoplay-policy=no-user-gesture-required \
        --use-fake-ui-for-media-stream \
        "https://www.douyin.com"
    sleep 2
done &
EOF
```

**3. Disable the `Alt+F4` exit shortcut:**

```bash
cp /etc/xdg/openbox/rc.xml ~/.config/openbox/
sed -i '/<keybind key="A-F4">/,/<\/keybind>/d' ~/.config/openbox/rc.xml
```

### Step 5: Reboot and verify

If you do not want the system to wait for all network services, disable the online-wait services to speed up boot:

```bash
sudo systemctl mask systemd-networkd-wait-online.service
sudo systemctl mask NetworkManager-wait-online.service
```

Hide boot messages (GRUB):

```bash
sudo sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT=.*/GRUB_CMDLINE_LINUX_DEFAULT="quiet loglevel=3 systemd.show_status=false vt.global_cursor_default=0"/g' /etc/default/grub

echo 'GRUB_TIMEOUT_STYLE="hidden"' | sudo tee -a /etc/default/grub
echo 'GRUB_RECORDFAIL_TIMEOUT=0' | sudo tee -a /etc/default/grub

sudo update-grub
```

Set the volume to 100%, then reboot:

```bash
amixer -q sset Master 100% unmute
sudo reboot
```

## Deploy the wake-word service

To run the wake-word detection service on the all-in-one machine, you need to install Python, upload the project files, configure the camera microphone, and enable boot autostart.

### 1. Install Miniconda

```bash
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh -b -p $HOME/miniconda3
~/miniconda3/bin/conda init bash
source ~/.bashrc
rm Miniconda3-latest-Linux-x86_64.sh
```

Make sure conda is entered automatically after login:

```bash
if ! grep -q '.bashrc' ~/.bash_profile; then
    cat << 'EOF' >> ~/.bash_profile

if [ -f ~/.bashrc ]; then
    . ~/.bashrc
fi
EOF
fi
```

### 2. Create a Python virtual environment

```bash
conda create -n test python=3.10 -y
conda activate test
```

If you see a `Terms of Service have not been accepted` error, run:

```bash
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r
```

### 3. Upload the project files

Upload the entire `main/digital-human/` directory from your development machine to the all-in-one machine’s `~/digital-human/` directory:

```bash
# Run on the development machine (replace <machine-IP> with the actual IP)
scp -r main/digital-human/ xz@<machine-IP>:~/digital-human/
```

### 4. Install system dependencies

The wake-word service needs audio capture libraries and ALSA/PulseAudio plugins:

```bash
sudo apt install libportaudio2 portaudio19-dev libasound2-plugins -y
```

### 5. Install Python dependencies

```bash
cd ~/digital-human/wakeword_runtime
pip install numpy
pip install -r requirements.txt
```

### 6. Download the wake-word model

The model files are not included in the repository and must be downloaded separately. See the model download section in [docs/digital-human-wakeword.md](digital-human-wakeword.md).

### 7. Modify the Openbox autostart script

Add PulseAudio and camera microphone setup to `autostart`, and change the Chrome URL to the test page.

First, check the camera microphone device name in PulseAudio:

```bash
pulseaudio --start
pactl list sources short
```

Find the line containing `USB_Camera` and copy the full device name, for example:

```bash
alsa_input.usb-SN0002_2K_USB_Camera_46435000_P030D00_SN0002-02.mono-fallback
```

Then replace the `autostart` file completely (replace `TARGET_MIC` with your actual device name):

```bash
cat << 'EOF' > ~/.config/openbox/autostart
# 1. Start the audio service and wait briefly
pulseaudio --start
sleep 1

# 2. Lock the camera microphone (replace with your actual device name)
TARGET_MIC="alsa_input.usb-SN0002_2K_USB_Camera_46435000_P030D00_SN0002-02.mono-fallback"

# 3. Set it as the system default microphone
pactl set-default-source "$TARGET_MIC"

# 4. Unmute it
pactl set-source-mute "$TARGET_MIC" 0

# 5. Set volume to 100%
pactl set-source-volume "$TARGET_MIC" 100%

# --- Minimal desktop and browser environment setup ---

# Disable screen blanking
xset -dpms
xset s noblank
xset s off

# Hide the mouse cursor
unclutter -idle 0.1 -root &

# Keep the browser in a restart loop
while true; do
    google-chrome \
        --kiosk \
        --no-first-run \
        --no-default-browser-check \
        --disable-infobars \
        --disable-session-crashed-bubble \
        --disable-translate \
        --disable-external-intent-requests \
        --autoplay-policy=no-user-gesture-required \
        --use-fake-ui-for-media-stream \
        "http://127.0.0.1:8006/index.html"
    sleep 2
done &
EOF
```

### 8. Enable boot autostart for the wake-word service

Create a systemd service file so the wake-word service starts automatically on boot.

First, check the current user UID:

```bash
id -u $(whoami)
```

Then replace `1000` below with the UID you got (the first user is usually `1000`):

```bash
sudo tee /etc/systemd/system/digital-human.service << 'EOF'
[Unit]
Description=Digital Human Runtime
After=network.target sound.target

[Service]
Type=simple
User=xz
Environment=XDG_RUNTIME_DIR=/run/user/1000
Environment=PULSE_SERVER=unix:/run/user/1000/pulse/native
WorkingDirectory=/home/xz/digital-human
ExecStartPre=/bin/sleep 10
ExecStart=/home/xz/miniconda3/envs/test/bin/python start.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
```

> **Important**:
> - `User=xz` — replace with your actual username
> - `/run/user/1000` — replace with your actual UID
> - the paths in `WorkingDirectory` and `ExecStart` — replace with your real deployment paths
> - the PulseAudio environment variables in `Environment` **must be kept**; otherwise the wake-word service and the browser will not be able to use the camera microphone at the same time

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable digital-human
sudo systemctl start digital-human
```

### 9. Common service management commands

```bash
sudo systemctl start digital-human     # Start now
sudo systemctl stop digital-human      # Stop
sudo systemctl restart digital-human   # Restart
sudo systemctl status digital-human    # Check status
journalctl -u digital-human -f         # Follow live logs
```
