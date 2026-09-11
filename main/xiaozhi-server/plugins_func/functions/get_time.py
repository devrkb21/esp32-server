from datetime import datetime
import cnlunar
from plugins_func.register import register_function, ToolType, ActionResponse, Action

get_lunar_function_desc = {
    "type": "function",
    "function": {
        "name": "get_lunar",
        "description": (
            "Used to query lunar calendar and solar terms information for a specific date. "
            "Users can specify what to query such as lunar date, solar terms, zodiac, horoscope, etc. "
            "If no query is specified, defaults to querying the lunar date. "
            "For basic queries like today's date, use the information in context directly."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "Date to query, format YYYY-MM-DD, e.g. 2024-01-01. Uses current date if omitted.",
                },
                "query": {
                    "type": "string",
                    "description": "Information to query, such as lunar date, solar terms, zodiac, horoscope, etc.",
                },
            },
            "required": [],
        },
    },
}


@register_function("get_lunar", get_lunar_function_desc, ToolType.WAIT)
def get_lunar(date=None, query=None):
    """
    Get lunar calendar and solar term information for a specific date
    """
    from core.utils.cache.manager import cache_manager, CacheType

    # Use specified date if provided, otherwise current date
    if date:
        try:
            now = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            return ActionResponse(
                Action.REQLLM,
                "Date format error, please use YYYY-MM-DD format, e.g. 2024-01-01",
                None,
            )
    else:
        now = datetime.now()

    current_date = now.strftime("%Y-%m-%d")

    if query is None:
        query = "Default query for lunar calendar date"

    # Try cache
    lunar_cache_key = f"lunar_info_{current_date}"
    cached_lunar_info = cache_manager.get(CacheType.LUNAR, lunar_cache_key)
    if cached_lunar_info:
        return ActionResponse(Action.REQLLM, cached_lunar_info, None)

    response_text = f"Respond to user query based on the following lunar calendar info regarding {query}:\n"

    lunar = cnlunar.Lunar(now, godType="8char")
    response_text += (
        f"Lunar Date: Year {lunar.lunarYear}, Month {lunar.lunarMonth}, Day {lunar.lunarDay}\n"
        f"Zodiac: {lunar.chineseYearZodiac}\n"
        f"Horoscope / Star Sign: {lunar.starZodiac}\n"
        f"Solar Term Today: {lunar.todaySolarTerms}\n"
        f"Next Solar Term: {lunar.nextSolarTerm}\n"
    )

    # Cache lunar info
    cache_manager.set(CacheType.LUNAR, lunar_cache_key, response_text)

    return ActionResponse(Action.REQLLM, response_text, None)
