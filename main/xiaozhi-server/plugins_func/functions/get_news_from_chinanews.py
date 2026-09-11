import random
import httpx
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from config.logger import setup_logging
from plugins_func.register import register_function, ToolType, ActionResponse, Action
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.connection import ConnectionHandler


TAG = __name__
logger = setup_logging()

GET_NEWS_FROM_CHINANEWS_FUNCTION_DESC = {
    "type": "function",
    "function": {
        "name": "get_news_from_chinanews",
        "description": (
            "Called when user asks to view or listen to news (e.g., 'tell me news', 'what news today'). "
            "User can specify news category, such as society, technology, world, etc. "
            "If not specified, society news is broadcast by default."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "News category, e.g., society, tech, world. Optional parameter, defaults if omitted.",
                },
                "detail": {
                    "type": "boolean",
                    "description": "Whether to get detailed content, default false. If true, retrieves details for the previous news item.",
                },
                "lang": {
                    "type": "string",
                    "description": "Language code used by the user, e.g. zh_CN/zh_HK/en_US/ja_JP, default en_US",
                },
            },
            "required": ["lang"],
        },
    },
}


async def fetch_news_from_rss(rss_url):
    """Fetch news list from RSS source"""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=3.0)) as client:
            response = await client.get(rss_url)

        # Parse XML
        root = ET.fromstring(response.content)

        # Find all item elements (news items)
        news_items = []
        for item in root.findall(".//item"):
            title = (
                item.find("title").text if item.find("title") is not None else "No Title"
            )
            link = item.find("link").text if item.find("link") is not None else "#"
            description = (
                item.find("description").text
                if item.find("description") is not None
                else "No Description"
            )
            pubDate = (
                item.find("pubDate").text
                if item.find("pubDate") is not None
                else "Unknown Time"
            )

            news_items.append(
                {
                    "title": title,
                    "link": link,
                    "description": description,
                    "pubDate": pubDate,
                }
            )

        return news_items
    except Exception as e:
        logger.bind(tag=TAG).error(f"Failed to fetch RSS news: {e}")
        return []


async def fetch_news_detail(url):
    """Fetch news detail page content and summarize"""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=3.0)) as client:
            response = await client.get(url)

        soup = BeautifulSoup(response.content, "html.parser")

        # Try extracting main content (selector can be adjusted based on site structure)
        content_div = soup.select_one(
            ".content_desc, .content, article, .article-content"
        )
        if content_div:
            paragraphs = content_div.find_all("p")
            content = "\n".join(
                [p.get_text().strip() for p in paragraphs if p.get_text().strip()]
            )
            return content
        else:
            # If no specific container found, get all paragraphs
            paragraphs = soup.find_all("p")
            content = "\n".join(
                [p.get_text().strip() for p in paragraphs if p.get_text().strip()]
            )
            return content[:2000]  # Limit length
    except Exception as e:
        logger.bind(tag=TAG).error(f"Failed to fetch news details: {e}")
        return "Unable to fetch detailed content"


def map_category(category_text):
    """Map user input category to config key"""
    if not category_text:
        return None

    # Category mapping dictionary, currently supports society, world, finance news
    category_map = {
        # Society news
        "society": "society_rss_url",
        "society news": "society_rss_url",
        # World news
        "world": "world_rss_url",
        "world news": "world_rss_url",
        "international": "world_rss_url",
        "international news": "world_rss_url",
        # Finance news
        "finance": "finance_rss_url",
        "finance news": "finance_rss_url",
        "financial": "finance_rss_url",
        "economy": "finance_rss_url",
    }

    # Normalize category text
    normalized_category = category_text.lower().strip()

    # Return mapped result or original input
    return category_map.get(normalized_category, category_text)


@register_function(
    "get_news_from_chinanews",
    GET_NEWS_FROM_CHINANEWS_FUNCTION_DESC,
    ToolType.SYSTEM_CTL,
)
async def get_news_from_chinanews(
    conn: "ConnectionHandler",
    category: str = None,
    detail: bool = False,
    lang: str = "en_US",
):
    """Fetch news and randomly select one to broadcast, or fetch details of the previous news item"""
    try:
        # If detail is True, fetch details of the previous news item
        if detail:
            if (
                not hasattr(conn, "last_news_link")
                or not conn.last_news_link
                or "link" not in conn.last_news_link
            ):
                return ActionResponse(
                    Action.REQLLM,
                    "Sorry, no recently queried news found. Please fetch a news item first.",
                    None,
                )

            link = conn.last_news_link.get("link")
            title = conn.last_news_link.get("title", "Unknown Title")

            if link == "#":
                return ActionResponse(
                    Action.REQLLM, "Sorry, this news item does not have a valid link to get detailed content.", None
                )

            logger.bind(tag=TAG).debug(f"Fetching news details: {title}, URL={link}")

            # Fetch news details
            detail_content = await fetch_news_detail(link)

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
        # Get RSS URL from configuration
        rss_config = conn.config.get("plugins", {}).get("get_news_from_chinanews", {})
        default_rss_url = rss_config.get(
            "default_rss_url", "https://www.chinanews.com.cn/rss/society.xml"
        )

        # Map user input category to config key
        mapped_category = map_category(category)

        # If category provided, attempt to get corresponding URL from config
        rss_url = default_rss_url
        if mapped_category and mapped_category in rss_config:
            rss_url = rss_config[mapped_category]

        logger.bind(tag=TAG).info(
            f"Fetching news: original_category={category}, mapped_category={mapped_category}, URL={rss_url}"
        )

        # Fetch news items
        news_items = await fetch_news_from_rss(rss_url)

        if not news_items:
            return ActionResponse(
                Action.REQLLM, "Sorry, failed to get news information. Please try again later.", None
            )

        # Randomly choose one news item
        selected_news = random.choice(news_items)

        # Save current news link to connection object for subsequent detail queries
        if not hasattr(conn, "last_news_link"):
            conn.last_news_link = {}
        conn.last_news_link = {
            "link": selected_news.get("link", "#"),
            "title": selected_news.get("title", "Unknown Title"),
        }

        # Build news report
        news_report = (
            f"According to the following data, respond to the user's news query in {lang}:\n\n"
            f"News Title: {selected_news['title']}\n"
            f"Published Time: {selected_news['pubDate']}\n"
            f"News Content: {selected_news['description']}\n"
            f"(Please broadcast this news naturally and smoothly to the user, reading the news directly without redundant text. "
            f"If the user asks for more details, inform them they can say 'Please tell me more details about this news')"
        )

        return ActionResponse(Action.REQLLM, news_report, None)

    except Exception as e:
        logger.bind(tag=TAG).error(f"Error fetching news: {e}")
        return ActionResponse(
            Action.REQLLM, "Sorry, an error occurred while fetching news. Please try again later.", None
        )
