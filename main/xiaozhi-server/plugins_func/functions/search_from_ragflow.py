import json
import httpx
from config.logger import setup_logging
from plugins_func.register import register_function, ToolType, ActionResponse, Action
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.connection import ConnectionHandler

TAG = __name__
logger = setup_logging()

# Base function description template
SEARCH_FROM_RAGFLOW_FUNCTION_DESC = {
    "type": "function",
    "function": {
        "name": "search_from_ragflow",
        "description": "Query information from the knowledge base.",
        "parameters": {
            "type": "object",
            "properties": {"question": {"type": "string", "description": "Question to query"}},
            "required": ["question"],
        },
    },
}


@register_function(
    "search_from_ragflow", SEARCH_FROM_RAGFLOW_FUNCTION_DESC, ToolType.SYSTEM_CTL
)
async def search_from_ragflow(conn: "ConnectionHandler", question=None):
    if question and isinstance(question, str):
        pass
    else:
        question = str(question) if question is not None else ""

    ragflow_config = conn.config.get("plugins", {}).get("search_from_ragflow", {})
    base_url = ragflow_config.get("base_url", "")
    api_key = ragflow_config.get("api_key", "")
    dataset_ids = ragflow_config.get("dataset_ids", [])

    url = base_url + "/api/v1/retrieval"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    payload = {"question": question, "dataset_ids": dataset_ids}

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=3.0), verify=False) as client:
            response = await client.post(url, json=payload, headers=headers)

        response.encoding = "utf-8"
        response.raise_for_status()

        response_text = response.text
        result = json.loads(response_text)

        if result.get("code") != 0:
            error_detail = result.get("error", {}).get("detail", "Unknown error")
            error_message = result.get("error", {}).get("message", "")
            error_code = result.get("code", "")

            logger.bind(tag=TAG).error(
                f"RAGFlow API call failed, status code: {error_code}, detail: {error_detail}, full response: {result}"
            )

            error_response = f"RAG interface returned exception (error code: {error_code})"
            if error_message:
                error_response += f": {error_message}"
            if error_detail:
                error_response += f"\nDetail: {error_detail}"

            return ActionResponse(Action.RESPONSE, None, error_response)

        chunks = result.get("data", {}).get("chunks", [])
        contents = []
        for chunk in chunks:
            content = chunk.get("content", "")
            if content:
                if isinstance(content, str):
                    contents.append(content)
                elif isinstance(content, bytes):
                    contents.append(content.decode("utf-8", errors="replace"))
                else:
                    contents.append(str(content))

        if contents:
            context_text = f"# Knowledge base results for [{question}]:\n"
            context_text += "```\n\n\n".join(contents[:5])
            context_text += "\n```"
        else:
            context_text = "According to knowledge base query results, no relevant information was found."
        return ActionResponse(Action.REQLLM, context_text, None)

    except httpx.TimeoutException:
        error_response = "RAG interface request timed out\nPossible cause: RAGFlow service slow response or network delay\nSolution: Please try again later or check RAGFlow service status"
        return ActionResponse(Action.RESPONSE, None, error_response)

    except httpx.HTTPStatusError as e:
        if hasattr(e.response, "status_code"):
            status_code = e.response.status_code
            error_response = f"RAG interface HTTP error (status code: {status_code})"
            try:
                error_detail = e.response.json().get("error", {}).get("message", "")
                if error_detail:
                    error_response += f"\nDetail: {error_detail}"
            except Exception:
                pass
        else:
            error_response = f"RAG interface HTTP exception: {str(e)}"
        return ActionResponse(Action.RESPONSE, None, error_response)

    except httpx.HTTPError:
        error_response = "Cannot connect to RAG interface\nPossible cause: RAGFlow service address is incorrect or service is not running\nSolution: Please check RAGFlow service address configuration and service status"
        return ActionResponse(Action.RESPONSE, None, error_response)

    except Exception as e:
        error_type = type(e).__name__
        logger.bind(tag=TAG).error(
            f"RAGFlow processing exception, type: {error_type}, detail: {str(e)}"
        )
        error_response = f"RAG interface processing exception ({error_type}): {str(e)}"
        return ActionResponse(Action.RESPONSE, None, error_response)
