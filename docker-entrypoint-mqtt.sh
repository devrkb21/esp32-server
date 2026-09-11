#!/bin/bash
set -e

# Ensure config directory exists
mkdir -p /app/config

# Generate default config/mqtt.json if not already mounted/provided
if [ ! -f /app/config/mqtt.json ]; then
  cat << 'EOF' > /app/config/mqtt.json
{
    "production": {
        "chat_servers": [
            "ws://xiaozhi-esp32-server:8000/xiaozhi/v1/?from=mqtt_gateway"
        ]
    },
    "debug": false,
    "max_mqtt_payload_size": 8192,
    "mcp_client": {
        "capabilities": {},
        "client_info": {
            "name": "xiaozhi-mqtt-client",
            "version": "1.0.0"
        },
        "max_tools_count": 128
    }
}
EOF
fi

# Write .env file from Docker environment variables
cat << EOF > /app/.env
PUBLIC_IP=${PUBLIC_IP:-127.0.0.1}
MQTT_PORT=${MQTT_PORT:-1883}
UDP_PORT=${UDP_PORT:-8884}
API_PORT=${API_PORT:-8007}
MQTT_SIGNATURE_KEY=${MQTT_SIGNATURE_KEY:-xiaozhi_mqtt_key}
SERVER_SECRET=${SERVER_SECRET:-}
EOF

exec "$@"
