# Context Provider Guide

## Overview

A **context provider** adds external data sources to Xiaozhi’s system prompt context.

When Xiaozhi wakes up, it fetches data from external systems and dynamically injects it into the model’s System Prompt.
This lets it perceive the state of something in the real world at wake-up time.

It is fundamentally different from MCP and memory:
- **Context provider**: forces Xiaozhi to perceive real-world data.
- **Memory (Mem)**: remembers what was discussed earlier.
- **MCP (function_call)**: used when a capability or knowledge source needs to be called.

With this feature, at the moment Xiaozhi wakes up, it can perceive things like:
- Human health sensor status (temperature, blood pressure, blood oxygen, and so on)
- Real-time business system data (server load, to-do items, stock information, and more)
- Any text information available through an HTTP API

**Note:** This feature is mainly for letting Xiaozhi perceive the state of something at wake-up time. If you want Xiaozhi to fetch the latest state after waking up, it is recommended to combine this feature with MCP tool calls.

## How it works

1. **Configure sources**: the user sets one or more HTTP API endpoints.
2. **Trigger requests**: when the system builds the prompt, if the template contains the `{{ dynamic_context }}` placeholder, it requests all configured APIs.
3. **Automatic injection**: the system formats the API response as a Markdown list and replaces the `{{ dynamic_context }}` placeholder.

## API requirements

For Xiaozhi to parse the data correctly, your API must follow these rules:

- **Method**: `GET`
- **Request header**: the system automatically adds a `device-id` field to the request header.
- **Response format**: must return JSON and include `code` and `data` fields.

### Response examples

**Case 1: key-value data**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "Living room temperature": "26°C",
    "Living room humidity": "45%",
    "Front door status": "Closed"
  }
}
```
*Injection result:*
```markdown
<context>
- **Living room temperature:** 26°C
- **Living room humidity:** 45%
- **Front door status:** Closed
</context>
```

**Case 2: list data**
```json
{
  "code": 0,
  "data": [
    "You have 10 pending tasks",
    "The car is currently moving at 100 km/h"
  ]
}
```
*Injection result:*
```markdown
<context>
- You have 10 pending tasks
- The car is currently moving at 100 km/h
</context>
```

## Configuration guide

### Option 1: Configure from the console (full-module deployment)

1. Log in to the console and open the **Role Configuration** page.
2. Find the **Context Provider** item (click the **Edit Source** button).
3. Click **Add** and enter your API URL.
4. If the API requires authentication, add `Authorization` or another header in the **Request Headers** section.
5. Save the configuration.

### Option 2: Configure in a file (single-module deployment)

Edit `xiaozhi-server/data/.config.yaml` and add a `context_providers` section:

```yaml
# Context provider configuration
context_providers:
  - url: "http://api.example.com/data"
    headers:
      Authorization: "Bearer your-token"
  - url: "http://another-api.com/data"
```

## Enable the feature

By default, the system prompt template file (`data/.agent-base-prompt.txt`) already includes the `{{ dynamic_context }}` placeholder, so you do not need to add it manually.

**Example:**

```markdown
<context>
[Important! The following information is provided in real time. No tool calls are needed; use it directly:]
- **Device ID:** {{device_id}}
- **Current time:** {{current_time}}
...
{{ dynamic_context }}
</context>
```

**Note:** If you do not need this feature, you can choose to **not configure any context providers**, or you can **remove** the `{{ dynamic_context }}` placeholder from the prompt template file.

## Appendix: Mock test server example

To make testing and development easier, we provide a simple Python mock server script. You can run it locally to simulate API endpoints.

**mock_api_server.py**

```python
import http.server
import socketserver
import json
from urllib.parse import urlparse, parse_qs

# Port number
PORT = 8081

class MockRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Parse path and query parameters
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        query = parse_qs(parsed_path.query)

        response_data = {}
        status_code = 200

        print(f"Received request: {path}, params: {query}")

        # Case 1: mock health data (returns a dict)
        # Path style: /health
        # device_id is read from the header
        if path == "/health":
            device_id = self.headers.get("device-id", "unknown_device")
            print(f"device_id: {device_id}")
            response_data = {
                "code": 0,
                "msg": "success",
                "data": {
                    "Test device ID": device_id,
                    "Heart rate": "80 bpm",
                    "Blood pressure": "120/80 mmHg",
                    "Status": "Good"
                }
            }

        # Case 2: mock news list (returns a list)
        # No parameters: /news/list
        elif path == "/news/list":
            response_data = {
                "code": 0,
                "msg": "success",
                "data": [
                    "Headline: Python 3.14 released",
                    "Tech news: AI assistants are changing daily life",
                    "Local news: Heavy rain tomorrow, remember to take an umbrella"
                ]
            }

        # Case 3: mock weather briefing (returns a string)
        # No parameters: /weather/simple
        elif path == "/weather/simple":
            response_data = {
                "code": 0,
                "msg": "success",
                "data": "Sunny turning cloudy today, 20-25°C, air quality is excellent, suitable for going out."
            }

        # Case 4: mock device details (query style)
        # Parameters: /device/info
        # device_id is read from the header
        elif path == "/device/info":
            device_id = self.headers.get("device-id", "unknown_device")
            response_data = {
                "code": 0,
                "msg": "success",
                "data": {
                    "Query method": "Header parameter",
                    "Device ID": device_id,
                    "Battery": "85%",
                    "Firmware": "v2.0.1"
                }
            }
        
        # Case 5: 404 Not Found
        else:
            status_code = 404
            response_data = {"error": "Endpoint does not exist"}

        # Send response
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode('utf-8'))

# Start server
# Allow address reuse to avoid restart errors
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), MockRequestHandler) as httpd:
    print(f"==================================================")
    print(f"Mock API Server started: http://localhost:{PORT}")
    print(f"Available endpoints:")
    print(f"1. [Dict]  http://localhost:{PORT}/health")
    print(f"2. [List]  http://localhost:{PORT}/news/list")
    print(f"3. [Text]  http://localhost:{PORT}/weather/simple")
    print(f"4. [Param] http://localhost:{PORT}/device/info")
    print(f"==================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")
```
