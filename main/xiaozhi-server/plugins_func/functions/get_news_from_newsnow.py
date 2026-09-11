import random
import httpx
from io import BytesIO
from markitdown import MarkItDown, StreamInfo
from config.logger import setup_logging
from plugins_func.register import register_function, ToolType, ActionResponse, Action
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.connection import ConnectionHandler


TAG = __name__
logger = setup_logging()

CHANNEL_MAP = {
    "v2ex": "v2ex-share",
    "zhihu": "zhihu",
    "weibo": "weibo",
    "zaobao": "zaobao",
    "coolapk": "coolapk",
    "mktnews": "mktnews-flash",
    "wallstreetcn": "wallstreetcn-quick",
    "36kr": "36kr-quick",
    "douyin": "douyin",
    "hupu": "hupu",
    "tieba": "tieba",
    "toutiao": "toutiao",
    "ithome": "ithome",
    "thepaper": "thepaper",
    "sputnik": "sputniknewscn",
    "cankaoxiaoxi": "cankaoxiaoxi",
    "pcbeta": "pcbeta-windows11",
    "cls": "cls-depth",
    "xueqiu": "xueqiu-hotstock",
    "gelonghui": "gelonghui",
    "fastbull": "fastbull-express",
    "solidot": "solidot",
    "hackernews": "hackernews",
    "producthunt": "producthunt",
    "github": "github-trending-today",
    "bilibili": "bilibili-hot-search",
    "kuaishou": "kuaishou",
    "kaopu": "kaopu",
    "jin10": "jin10",
    "baidu": "baidu",
    "nowcoder": "nowcoder",
    "sspai": "sspai",
    "juejin": "juejin",
    "ifeng": "ifeng",
    "chongbuluo": "chongbuluo-latest",
}

# Default news sources used when not specified in configuration
DEFAULT_NEWS_SOURCES = "thepaper;hackernews;github"

def _get_newsnow_config(conn):
    # Retrieve from connection configuration
    plugins = conn.config.get("plugins", {})
    newsnow = plugins.get("get_news_from_newsnow", {})
    sources = newsnow.get("news_sources", "")
    if isinstance(sources, str) and sources.strip():
        return sources

    return ""

def get_news_sources_from_config(conn):
    """Retrieve news sources string from configuration"""
    try:
        result = _get_newsnow_config(conn)
        if result:
            logger.bind(tag=TAG).debug(f"Using configured news sources: {result}")
            return result

        logger.bind(tag=TAG).debug("No news source configuration found, using default")
        return DEFAULT_NEWS_SOURCES

    except Exception as e:
        logger.bind(tag=TAG).error(f"Failed to get news sources config: {e}, using default")
        return DEFAULT_NEWS_SOURCES


example_sources_str = DEFAULT_NEWS_SOURCES.replace(";", ", ")

GET_NEWS_FROM_NEWSNOW_FUNCTION_DESC = {
    "type": "function",
    "function": {
        "name": "get_news_from_newsnow",
        "description": "Called when user asks to view or listen to news (e.g., 'tell me news', 'what news today').",
        "parameters": {
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "description": f"Standard name or ID of the news source, e.g., {example_sources_str}. Optional parameter, default source is used if omitted.",
                },
                "detail": {
                    "type": "boolean",
                    "description": "Whether to get detailed content, default false. If true, retrieves details for the previous news item.",
                },
                "lang": {
                    "type": "string",
                    "description": "Language code used by user, e.g., en_US/zh_CN/ja_JP, default en_US",
                },
            },
            "required": ["lang"],
        },
    },
}


async def fetch_news_from_api(conn: "ConnectionHandler", source="thepaper"):
    """Fetch news list from API"""
    try:
        api_url = f"https://newsnow.busiyi.world/api/s?id={source}"

        news_config = conn.config.get("plugins", {}).get("get_news_from_newsnow", {})
        if news_config.get("url"):
            api_url = news_config["url"] + source

        headers = {"User-Agent": "Mozilla/5.0"}
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=3.0)) as client:
            response = await client.get(api_url, headers=headers)

        data = response.json()

        if "items" in data:
            return data["items"]
        else:
            logger.bind(tag=TAG).error(f"Invalid news API response format: {data}")
            return []

    except Exception as e:
        logger.bind(tag=TAG).error(f"Failed to fetch news from API: {e}")
        return []


async def fetch_news_detail(url):
    """Fetch news detail page content and clean HTML using MarkItDown"""
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=3.0)) as client:
            response = await client.get(url, headers=headers)

        # Clean HTML content with MarkItDown
        md = MarkItDown(enable_plugins=False)
        result = md.convert_stream(
            BytesIO(response.content),
            stream_info=StreamInfo(
                mimetype="text/html",
                extension=".html",
                charset=response.encoding or "utf-8",
            ),
        )

        clean_text = result.text_content

        # Return hint if cleaned content is empty
        if not clean_text or len(clean_text.strip()) == 0:
            logger.bind(tag=TAG).warning(f"Cleaned news content is empty: {url}")
            return "Unable to parse news details. Site structure may be unusual or content restricted."

        return clean_text
    except Exception as e:
        logger.bind(tag=TAG).error(f"Failed to fetch news details: {e}")
        return "Unable to fetch detailed content"


@register_function(
    "get_news_from_newsnow",
    GET_NEWS_FROM_NEWSNOW_FUNCTION_DESC,
    ToolType.SYSTEM_CTL,
)
async def get_news_from_newsnow(
    conn: "ConnectionHandler",
    source: str = "thepaper",
    detail: bool = False,
    lang: str = "en_US",
):
    """Fetch news and randomly select one to broadcast, or fetch details of the previous news item"""
    try:
        # Get configured news sources
        news_sources = get_news_sources_from_config(conn)

        # If detail is True, fetch details of the previous news item
        detail = str(detail).lower() == "true"
        if detail:
            if (
                not hasattr(conn, "last_newsnow_link")
                or not conn.last_newsnow_link
                or "url" not in conn.last_newsnow_link
            ):
                return ActionResponse(
                    Action.REQLLM,
                    "Sorry, no recently queried news found. Please fetch a news item first.",
                    None,
                )

            url = conn.last_newsnow_link.get("url")
            title = conn.last_newsnow_link.get("title", "Unknown Title")
            source_id = conn.last_newsnow_link.get("source_id", "thepaper")
            source_name = source_id

            if not url or url == "#":
                return ActionResponse(
                    Action.REQLLM, "Sorry, this news item does not have a valid link to get detailed content.", None
                )

            logger.bind(tag=TAG).debug(
                f"Fetching news details: {title}, source: {source_name}, URL={url}"
            )

            # Fetch news details
            detail_content = await fetch_news_detail(url)

            if not detail_content or detail_content == "Unable to fetch detailed content":
                return ActionResponse(
                    Action.REQLLM,
                    f"Sorry, unable to get details for \"{title}\". The link may have expired or the site structure changed.",
                    None,
                )

            # Build detail report
            detail_report = (
                f"According to the following data, respond to the user's news detail query in {lang}:\n\n"
                f"News Title: {title}\n"
                f"Detailed Content: {detail_content}\n\n"
                f"(Please summarize the above news content, extract key points, and broadcast naturally and smoothly without mentioning that this is a summary.)"
            )

            return ActionResponse(Action.REQLLM, detail_report, None)

        # Otherwise, fetch news list and randomly select one
        normalized_source = source.lower().strip() if source else "thepaper"
        english_source_id = CHANNEL_MAP.get(normalized_source, normalized_source)

        if not english_source_id:
            logger.bind(tag=TAG).warning(f"Invalid news source: {source}, using default thepaper")
            english_source_id = "thepaper"
            source = "thepaper"

        logger.bind(tag=TAG).info(f"Fetching news: source={source}({english_source_id})")

        # Fetch news items
        news_items = await fetch_news_from_api(conn, english_source_id)

        if not news_items:
            return ActionResponse(
                Action.REQLLM,
                f"Sorry, failed to get news from {source}. Please try again later or try another source.",
                None,
            )

        # Randomly select one news item
        selected_news = random.choice(news_items)

        # Save current news link for subsequent detail queries
        if not hasattr(conn, "last_newsnow_link"):
            conn.last_newsnow_link = {}
        conn.last_newsnow_link = {
            "url": selected_news.get("url", "#"),
            "title": selected_news.get("title", "Unknown Title"),
            "source_id": english_source_id,
        }

        # Build news report
        news_report = (
            f"According to the following data, respond to the user's news query in {lang}:\n\n"
            f"News Title: {selected_news['title']}\n"
            f"(Please broadcast this news title naturally and smoothly, "
            f"and prompt the user that they can ask for details to get the full story.)"
        )

        return ActionResponse(Action.REQLLM, news_report, None)

    except Exception as e:
        logger.bind(tag=TAG).error(f"Error fetching news: {e}")
        return ActionResponse(
            Action.REQLLM, "Sorry, an error occurred while fetching news. Please try again later.", None
        )
