import os
import asyncio
from config.config_loader import read_config, get_project_dir, load_config


default_config_file = "config.yaml"
config_file_valid = False


def check_config_file():
    global config_file_valid
    if config_file_valid:
        return
    """
    Simplified configuration check, notifying user about config file status
    """
    project_dir = get_project_dir()
    data_dir = os.path.join(project_dir, "data")
    os.makedirs(data_dir, exist_ok=True)

    custom_config_file = os.path.join(data_dir, "." + default_config_file)
    if not os.path.exists(custom_config_file):
        template_file = os.path.join(project_dir, "config_from_api.yaml")
        template_content = ""
        if os.path.exists(template_file):
            with open(template_file, "r", encoding="utf-8") as f:
                template_content = f.read()
        else:
            template_content = """server:
  ip: 0.0.0.0
  port: 8000
  http_port: 8003
  vision_explain: http://YOUR_IP_OR_DOMAIN:PORT/mcp/vision/explain
manager-api:
  url: http://xiaozhi-esp32-server-web:8002/xiaozhi
  secret: your_server_secret_value
prompt_template: agent-base-prompt.txt
"""
        env_secret = os.getenv("MANAGER_API_SECRET") or os.getenv("SERVER_SECRET")
        env_url = os.getenv("MANAGER_API_URL")
        if env_secret:
            template_content = template_content.replace("your_server_secret_value", env_secret)
        if env_url:
            template_content = template_content.replace("http://xiaozhi-esp32-server-web:8002/xiaozhi", env_url)

        with open(custom_config_file, "w", encoding="utf-8") as f:
            f.write(template_content)
        print(f"Auto-initialized {custom_config_file} from config_from_api.yaml")

    # Check if configuration is read from API
    config = asyncio.run(load_config())
    if config.get("read_config_from_api", False):
        print("Reading configuration from API")
        old_config_origin = read_config(custom_config_file)
        if old_config_origin.get("selected_module") is not None:
            error_msg = "Your configuration file appears to contain both console and local configurations:\n"
            error_msg += "\nRecommendations:\n"
            error_msg += "1. Copy config_from_api.yaml from the root directory into data/ and rename it to .config.yaml\n"
            error_msg += "2. Configure the API endpoint address and secret key as instructed\n"
            raise ValueError(error_msg)
    config_file_valid = True
