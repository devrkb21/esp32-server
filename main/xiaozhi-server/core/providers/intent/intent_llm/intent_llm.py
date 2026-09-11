import asyncio
from typing import List, Dict, TYPE_CHECKING

if TYPE_CHECKING:
    from core.connection import ConnectionHandler
from ..base import IntentProviderBase
from plugins_func.functions.play_music import initialize_music_handler
from config.logger import setup_logging
from core.utils.util import get_system_error_response
import re
import json
import hashlib
import time


TAG = __name__
logger = setup_logging()


class IntentProvider(IntentProviderBase):
    def __init__(self, config):
        super().__init__(config)
        self.llm = None
        self.promot = ""
        # Import global cache manager
        from core.utils.cache.manager import cache_manager, CacheType

        self.cache_manager = cache_manager
        self.CacheType = CacheType
        self.history_count = 4  # Default to last 4 conversation turns

    def get_intent_system_prompt(self, functions_list: str) -> str:
        """
        Dynamically generate system prompt based on configured intent options and available functions
        Args:
            functions_list: Available functions list
        Returns:
            Formatted system prompt
        """

        # Build function descriptions
        functions_desc = "Available functions:\n"
        for func in functions_list:
            func_info = func.get("function", {})
            name = func_info.get("name", "")
            desc = func_info.get("description", "")
            params = func_info.get("parameters", {})

            functions_desc += f"\nFunction: {name}\n"
            functions_desc += f"Description: {desc}\n"

            if params:
                functions_desc += "Parameters:\n"
                for param_name, param_info in params.get("properties", {}).items():
                    param_desc = param_info.get("description", "")
                    param_type = param_info.get("type", "")
                    functions_desc += f"- {param_name} ({param_type}): {param_desc}\n"

            functions_desc += "---\n"

        prompt = (
            "[STRICT FORMAT REQUIREMENT] You MUST return ONLY valid JSON format. Never return natural language!\n\n"
            "You are an intent recognition assistant. Analyze the user's last sentence, determine intent, and invoke the appropriate function.\n\n"
            "[IMPORTANT RULES] For the following types of queries, return result_for_context directly without calling any function:\n"
            "- Asking current time (e.g., 'what time is it', 'current time')\n"
            "- Asking today's date (e.g., 'what is today's date', 'what day is it today')\n"
            "- Asking current location/city (e.g., 'where am I', 'what city am I in')\n"
            "The system will formulate the response directly from context.\n\n"
            "- If the user asks questions about exiting (e.g., 'how do I exit?', 'why did it exit?'), note this is not asking to exit; return {'function_call': {'name': 'continue_chat'}}\n"
            "- Only trigger handle_exit_intent when user explicitly says commands like 'exit system', 'end conversation', 'goodbye', 'stop talking'\n\n"
            f"{functions_desc}\n"
            "Steps:\n"
            "1. Analyze user input to determine intent\n"
            "2. Check if it is a basic information query (time, date, etc.); if so, return result_for_context\n"
            "3. Select the best matching function from available functions\n"
            "4. If a matching function is found, generate the corresponding function_call format\n"
            '5. If no matching function is found, return {"function_call": {"name": "continue_chat"}}\n\n'
            "Format Requirements:\n"
            "1. Return pure JSON only, no markdown, no other text\n"
            "2. Must include 'function_call' field\n"
            "3. 'function_call' must include 'name' field\n"
            "4. If function requires parameters, must include 'arguments' field\n\n"
            "Examples:\n"
            "```\n"
            "User: What time is it?\n"
            'Return: {"function_call": {"name": "result_for_context"}}\n'
            "```\n"
            "```\n"
            "User: What is the battery level?\n"
            'Return: {"function_call": {"name": "get_battery_level", "arguments": {"response_success": "Current battery level is {value}%", "response_failure": "Unable to get battery percentage"}}}\n'
            "```\n"
            "```\n"
            "User: What is screen brightness?\n"
            'Return: {"function_call": {"name": "self_screen_get_brightness"}}\n'
            "```\n"
            "```\n"
            "User: Set screen brightness to 50%\n"
            'Return: {"function_call": {"name": "self_screen_set_brightness", "arguments": {"brightness": 50}}}\n'
            "```\n"
            "```\n"
            "User: I want to end the conversation\n"
            'Return: {"function_call": {"name": "handle_exit_intent", "arguments": {"say_goodbye": "goodbye"}}}\n'
            "```\n"
            "```\n"
            "User: Hello\n"
            'Return: {"function_call": {"name": "continue_chat"}}\n'
            "```\n\n"
            "Notes:\n"
            "1. Only return JSON format, no other text\n"
            '2. Check first if query is basic info (time, date), if so return {"function_call": {"name": "result_for_context"}} without arguments\n'
            '3. If no matching function, return {"function_call": {"name": "continue_chat"}}\n'
            "4. Ensure JSON is well-formed with all required fields\n"
            "5. result_for_context does not require arguments\n"
            "Special Instructions:\n"
            "- When single user input contains multiple commands (e.g. 'turn on the light and turn up the volume')\n"
            "- Return JSON array with function_calls\n"
            "- Example: {'function_calls': [{'name':'light_on'}, {'name':'volume_up'}]}\n\n"
            "[FINAL WARNING] Never output natural language, emojis, or explanations! Output only valid JSON format!"
        )
        return prompt

    async def replyResult(self, text: str, original_text: str):
        """Use asyncio.to_thread to avoid blocking event loop"""
        try:
            user_prompt = (
                "Based on the above content, reply to the user in a natural human conversational tone, concisely, directly returning the result. The user says: "
                + original_text
            )
            # Use to_thread to execute synchronous blocking call in thread pool
            llm_result = await asyncio.to_thread(
                self.llm.response_no_stream,
                system_prompt=text,
                user_prompt=user_prompt,
            )
            return llm_result
        except Exception as e:
            logger.bind(tag=TAG).error(f"Error in generating reply result: {e}")
            return get_system_error_response(self.config)

    async def detect_intent(
        self, conn: "ConnectionHandler", dialogue_history: List[Dict], text: str
    ) -> str:
        if not self.llm:
            raise ValueError("LLM provider not set")
        if conn.func_handler is None:
            return '{"function_call": {"name": "continue_chat"}}'

        # Record overall start time
        total_start_time = time.time()

        # Print model information used
        model_info = getattr(self.llm, "model_name", str(self.llm.__class__.__name__))
        logger.bind(tag=TAG).debug(f"Using intent recognition model: {model_info}")

        # Compute cache key
        cache_key = hashlib.md5((conn.device_id + text).encode()).hexdigest()

        # Check cache
        cached_intent = self.cache_manager.get(self.CacheType.INTENT, cache_key)
        if cached_intent is not None:
            cache_time = time.time() - total_start_time
            logger.bind(tag=TAG).debug(
                f"Using cached intent: {cache_key} -> {cached_intent}, elapsed: {cache_time:.4f}s"
            )
            return cached_intent

        if self.promot == "":
            functions = conn.func_handler.get_functions()
            if hasattr(conn, "mcp_client"):
                mcp_tools = conn.mcp_client.get_available_tools()
                if mcp_tools is not None and len(mcp_tools) > 0:
                    if functions is None:
                        functions = []
                    functions.extend(mcp_tools)

            self.promot = self.get_intent_system_prompt(functions)

        music_config = initialize_music_handler(conn)
        music_file_names = music_config["music_file_names"]
        prompt_music = f"{self.promot}\n<musicNames>{music_file_names}\n</musicNames>"

        home_assistant_cfg = conn.config["plugins"].get("home_assistant")
        if home_assistant_cfg:
            devices = home_assistant_cfg.get("devices", [])
        else:
            devices = []
        if len(devices) > 0:
            hass_prompt = "\nBelow is the list of smart home devices (location, name, entity_id) controllable via Home Assistant:\n"
            for device in devices:
                hass_prompt += device + "\n"
            prompt_music += hass_prompt

        logger.bind(tag=TAG).debug(f"User prompt: {prompt_music}")

        # Build conversation history prompt
        msgStr = ""

        # Get recent dialogue history
        start_idx = max(0, len(dialogue_history) - self.history_count)
        for i in range(start_idx, len(dialogue_history)):
            msgStr += f"{dialogue_history[i].role}: {dialogue_history[i].content}\n"

        msgStr += f"User: {text}\n"
        user_prompt = f"current dialogue:\n{msgStr}"

        # Record preprocessing elapsed time
        preprocess_time = time.time() - total_start_time
        logger.bind(tag=TAG).debug(f"Intent recognition preprocessing elapsed: {preprocess_time:.4f}s")

        # Use LLM for intent detection
        llm_start_time = time.time()
        logger.bind(tag=TAG).debug(f"Starting LLM intent detection call, model: {model_info}")

        try:
            # Execute synchronous blocking call in thread pool
            intent = await asyncio.to_thread(
                self.llm.response_no_stream,
                system_prompt=prompt_music,
                user_prompt=user_prompt,
            )
        except Exception as e:
            logger.bind(tag=TAG).error(f"Error in intent detection LLM call: {e}")
            return '{"function_call": {"name": "continue_chat"}}'

        # Record LLM call completion time
        llm_time = time.time() - llm_start_time
        logger.bind(tag=TAG).debug(
            f"Intent recognition LLM call completed, model: {model_info}, elapsed: {llm_time:.4f}s"
        )

        # Record postprocessing start time
        postprocess_start_time = time.time()

        # Clean and parse response
        intent = intent.strip()
        # Try extracting JSON portion
        match = re.search(r"\{.*\}", intent, re.DOTALL)
        if match:
            intent = match.group(0)

        # Record total time
        total_time = time.time() - total_start_time
        logger.bind(tag=TAG).debug(
            f"[Intent Recognition Performance] model: {model_info}, total: {total_time:.4f}s, LLM: {llm_time:.4f}s, query: '{text[:20]}...'"
        )

        # Try parsing as JSON
        try:
            intent_data = json.loads(intent)
            if "function_call" in intent_data:
                function_data = intent_data["function_call"]
                function_name = function_data.get("name")
                function_args = function_data.get("arguments", {})

                # Log recognized function call
                logger.bind(tag=TAG).info(
                    f"LLM recognized intent: {function_name}, args: {function_args}"
                )

                # Process different types of intents
                if function_name == "result_for_context":
                    logger.bind(tag=TAG).info(
                        "Detected result_for_context intent, answering directly from context"
                    )

                elif function_name == "continue_chat":
                    # Retain non-tool messages
                    clean_history = [
                        msg
                        for msg in conn.dialogue.dialogue
                        if msg.role not in ["tool", "function"]
                    ]
                    conn.dialogue.dialogue = clean_history

                else:
                    logger.bind(tag=TAG).info(f"Detected function call intent: {function_name}")

            # Store in cache and return
            self.cache_manager.set(self.CacheType.INTENT, cache_key, intent)
            postprocess_time = time.time() - postprocess_start_time
            logger.bind(tag=TAG).debug(f"Intent postprocessing elapsed: {postprocess_time:.4f}s")
            return intent
        except json.JSONDecodeError:
            postprocess_time = time.time() - postprocess_start_time
            logger.bind(tag=TAG).error(
                f"Cannot parse intent JSON: {intent}, postprocessing elapsed: {postprocess_time:.4f}s"
            )
            # Default to continue chat on JSON parse error
            return '{"function_call": {"name": "continue_chat"}}'
