import httpx
from bs4 import BeautifulSoup
from config.logger import setup_logging
from plugins_func.register import register_function, ToolType, ActionResponse, Action
from core.utils.util import get_ip_info
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.connection import ConnectionHandler

TAG = __name__
logger = setup_logging()

GET_WEATHER_FUNCTION_DESC = {
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": (
            "Get weather for a location. User should provide a location name, e.g. London or New York. "
            "Important: Local 7-day weather is already provided in the context; do not call this tool unless user requests another city."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "Location name, e.g. London. Optional parameter",
                },
                "lang": {
                    "type": "string",
                    "description": "Language code, e.g. en_US, zh_CN, default en_US",
                },
            },
            "required": ["lang"],
        },
    },
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36"
    )
}

# Weather codes https://dev.qweather.com/docs/resource/icons/#weather-icons
WEATHER_CODE_MAP = {
    "100": "Sunny",
    "101": "Cloudy",
    "102": "Few Clouds",
    "103": "Partly Cloudy",
    "104": "Overcast",
    "150": "Clear",
    "151": "Cloudy",
    "152": "Few Clouds",
    "153": "Partly Cloudy",
    "300": "Shower Rain",
    "301": "Heavy Shower Rain",
    "302": "Thundershower",
    "303": "Heavy Thundershower",
    "304": "Thundershower with Hail",
    "305": "Light Rain",
    "306": "Moderate Rain",
    "307": "Heavy Rain",
    "308": "Extreme Rain",
    "309": "Drizzle",
    "310": "Storm",
    "311": "Heavy Storm",
    "312": "Severe Storm",
    "313": "Freezing Rain",
    "314": "Light to Moderate Rain",
    "315": "Moderate to Heavy Rain",
    "316": "Heavy to Storm Rain",
    "317": "Heavy Storm Rain",
    "318": "Severe Storm Rain",
    "350": "Shower Rain",
    "351": "Heavy Shower Rain",
    "399": "Rain",
    "400": "Light Snow",
    "401": "Moderate Snow",
    "402": "Heavy Snow",
    "403": "Snowstorm",
    "404": "Sleet",
    "405": "Rain and Snow",
    "406": "Shower Snow",
    "407": "Snow Flurry",
    "408": "Light to Moderate Snow",
    "409": "Moderate to Heavy Snow",
    "410": "Heavy to Snowstorm",
    "456": "Shower Sleet",
    "457": "Snow Flurry",
    "499": "Snow",
    "500": "Mist",
    "501": "Fog",
    "502": "Haze",
    "503": "Sand",
    "504": "Dust",
    "507": "Duststorm",
    "508": "Sandstorm",
    "509": "Dense Fog",
    "510": "Strong Dense Fog",
    "511": "Moderate Haze",
    "512": "Heavy Haze",
    "513": "Severe Haze",
    "514": "Heavy Fog",
    "515": "Extra Heavy Dense Fog",
    "900": "Hot",
    "901": "Cold",
    "999": "Unknown",
}


async def fetch_city_info(location, api_key, api_host):
    url = f"https://{api_host}/geo/v2/city/lookup?key={api_key}&location={location}&lang=en"
    async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=3.0)) as client:
        response = await client.get(url, headers=HEADERS)
    data = response.json()
    if data.get("error") is not None:
        logger.bind(tag=TAG).error(
            f"Failed to get weather, reason: {data.get('error', {}).get('detail')}"
        )
        return None
    return data.get("location", [])[0] if data.get("location") else None


async def fetch_weather_page(url):
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=3.0)) as client:
        response = await client.get(url, headers=HEADERS)
    return BeautifulSoup(response.text, "html.parser") if response.status_code == 200 else None


def parse_weather_info(soup):
    city_name = soup.select_one("h1.c-submenu__location").get_text(strip=True)

    current_abstract = soup.select_one(".c-city-weather-current .current-abstract")
    current_abstract = (
        current_abstract.get_text(strip=True) if current_abstract else "Unknown"
    )

    current_basic = {}
    for item in soup.select(
        ".c-city-weather-current .current-basic .current-basic___item"
    ):
        parts = item.get_text(strip=True, separator=" ").split(" ")
        if len(parts) == 2:
            key, value = parts[1], parts[0]
            current_basic[key] = value

    temps_list = []
    for row in soup.select(".city-forecast-tabs__row")[:7]:  # Take first 7 days
        date = row.select_one(".date-bg .date").get_text(strip=True)
        weather_code = (
            row.select_one(".date-bg .icon")["src"].split("/")[-1].split(".")[0]
        )
        weather = WEATHER_CODE_MAP.get(weather_code, "Unknown")
        temps = [span.get_text(strip=True) for span in row.select(".tmp-cont .temp")]
        high_temp, low_temp = (temps[0], temps[-1]) if len(temps) >= 2 else (None, None)
        temps_list.append((date, weather, high_temp, low_temp))

    return city_name, current_abstract, current_basic, temps_list


@register_function("get_weather", GET_WEATHER_FUNCTION_DESC, ToolType.SYSTEM_CTL)
async def get_weather(conn: "ConnectionHandler", location: str = None, lang: str = "en"):
    from core.utils.cache.manager import cache_manager, CacheType

    weather_config = conn.config.get("plugins", {}).get("get_weather", {})
    api_host = weather_config.get("api_host", "mj7p3y7naa.re.qweatherapi.com")
    api_key = weather_config.get("api_key", "a861d0d5e7bf4ee1a83d9a9e4f96d4da")
    default_location = weather_config.get("default_location", "London")
    client_ip = conn.client_ip

    # Prefer user-provided location
    if not location:
        if client_ip:
            cached_ip_info = cache_manager.get(CacheType.IP_INFO, client_ip)
            if cached_ip_info:
                location = cached_ip_info.get("city")
            else:
                ip_info = get_ip_info(client_ip, logger)
                if ip_info:
                    cache_manager.set(CacheType.IP_INFO, client_ip, ip_info)
                    location = ip_info.get("city")

            if not location:
                location = default_location
        else:
            location = default_location

    weather_cache_key = f"full_weather_{location}_{lang}"
    cached_weather_report = cache_manager.get(CacheType.WEATHER, weather_cache_key)
    if cached_weather_report:
        return ActionResponse(Action.REQLLM, cached_weather_report, None)

    # Fetch live weather data
    city_info = await fetch_city_info(location, api_key, api_host)
    if not city_info:
        return ActionResponse(
            Action.REQLLM, f"City not found: {location}, please verify location", None
        )
    soup = await fetch_weather_page(city_info["fxLink"])
    if not soup:
        return ActionResponse(Action.REQLLM, None, "Request failed")
    city_name, current_abstract, current_basic, temps_list = parse_weather_info(soup)

    weather_report = f"Queried location: {city_name}\n\nCurrent weather: {current_abstract}\n"

    if current_basic:
        weather_report += "Parameters:\n"
        for key, value in current_basic.items():
            if value != "0":
                weather_report += f"  · {key}: {value}\n"

    weather_report += "\n7-Day Forecast:\n"
    for date, weather, high, low in temps_list:
        weather_report += f"{date}: {weather}, Temperature {low}~{high}\n"

    weather_report += "\n(For specific date weather, please specify the date)"

    cache_manager.set(CacheType.WEATHER, weather_cache_key, weather_report)

    return ActionResponse(Action.REQLLM, weather_report, None)
