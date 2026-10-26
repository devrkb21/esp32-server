import httpx
import openai
from openai.types import CompletionUsage
from config.logger import setup_logging
from core.utils.util import check_model_key
from core.providers.llm.base import LLMProviderBase
from urllib.parse import urlparse

TAG = __name__
logger = setup_logging()

# Domains and parameters for disabling thinking mode (disabled by default)
THINKING_DISABLED_DOMAINS = {
    "aliyuncs.com": {"enable_thinking": False},
    "deepseek.com": {"thinking": {"type": "disabled"}},
    "bigmodel.cn": {"thinking": {"type": "disabled"}},
    "moonshot.cn": {"thinking": {"type": "disabled"}},
    "volces.com": {"thinking": {"type": "disabled"}},
}

# APIs that answer stream_options.include_usage with token counts at the end of a stream
USAGE_STREAM_HOSTS = ("api.openai.com", "groq.com", "deepseek.com", "aliyuncs.com", "openrouter.ai",
                      "api.x.ai", "mistral.ai", "together.xyz", "volces.com", "bigmodel.cn", "moonshot.cn")


class LLMProvider(LLMProviderBase):
    def __init__(self, config):
        self.model_name = config.get("model_name")
        self.api_key = config.get("api_key")
        if "base_url" in config:
            self.base_url = config.get("base_url")
        else:
            self.base_url = config.get("url")
        
        timeout_config = config.get("timeout")
        if isinstance(timeout_config, dict):
            # Fine-grained timeout config
            custom_timeout = httpx.Timeout(
                pool=timeout_config.get("pool", 2.0),
                connect=timeout_config.get("connect", 3.0),
                write=timeout_config.get("write", 5.0),
                read=timeout_config.get("read", 60.0)
            )
        elif isinstance(timeout_config, (int, float)) and timeout_config > 0:
            # Backward compatibility for single timeout config (int or float)
            custom_timeout = httpx.Timeout(timeout_config)
        else:
            # Default fallback timeout
            custom_timeout = httpx.Timeout(300)

        param_defaults = {
            "max_tokens": int,
            "temperature": lambda x: round(float(x), 1),
            "top_p": lambda x: round(float(x), 1),
            "frequency_penalty": lambda x: round(float(x), 1),
        }

        for param, converter in param_defaults.items():
            value = config.get(param)
            try:
                setattr(
                    self,
                    param,
                    converter(value) if value not in (None, "") else None,
                )
            except (ValueError, TypeError):
                setattr(self, param, None)

        logger.debug(
            f"Intent recognition params initialized: {self.temperature}, {self.max_tokens}, {self.top_p}, {self.frequency_penalty}"
        )

        # Provider-specific request fields from the config, e.g. {"reasoning_effort": "low"} for
        # reasoning models on Groq, sent as-is in the request body
        extra_body = config.get("extra_body")
        self.extra_body = dict(extra_body) if isinstance(extra_body, dict) else None

        # Ask for token counts at the end of the stream (usage metering). On by default for APIs
        # known to accept stream_options; "stream_usage": true/false in the model config decides
        # for any other. The counts of the last request land in self.last_usage.
        stream_usage = config.get("stream_usage")
        if stream_usage in (None, ""):
            host = urlparse(str(self.base_url or "")).netloc.lower()
            self.stream_usage = any(h in host for h in USAGE_STREAM_HOSTS)
        else:
            self.stream_usage = str(stream_usage).lower() not in ("false", "0", "no")
        self.last_usage = None

        model_key_msg = check_model_key("LLM", self.api_key)
        if model_key_msg:
            logger.bind(tag=TAG).error(model_key_msg)
        self.client = openai.OpenAI(api_key=self.api_key, base_url=self.base_url, timeout=custom_timeout)

    @staticmethod
    def normalize_dialogue(dialogue):
        """Automatically repair messages missing content in dialogue"""
        for msg in dialogue:
            if "role" in msg and "content" not in msg:
                msg["content"] = ""
        return dialogue

    def _remember_usage(self, chunk):
        """Keep the token counts a stream chunk carries (OpenAI `usage`, Groq `x_groq.usage`)."""
        usage = getattr(chunk, "usage", None)
        if usage is None:
            x_groq = getattr(chunk, "x_groq", None)
            usage = x_groq.get("usage") if isinstance(x_groq, dict) else getattr(x_groq, "usage", None)
        if usage is None:
            return
        get = usage.get if isinstance(usage, dict) else (lambda k: getattr(usage, k, None))
        prompt, completion = get("prompt_tokens"), get("completion_tokens")
        if isinstance(prompt, int) or isinstance(completion, int):
            self.last_usage = {"prompt_tokens": int(prompt or 0), "completion_tokens": int(completion or 0)}

    def _apply_thinking_disabled(self, request_params: dict):
        """Automatically disable thinking mode based on domain, then add configured extra_body"""
        if self.extra_body:
            request_params.setdefault("extra_body", {}).update(self.extra_body)
        parsed_url = urlparse(self.base_url)
        domain = parsed_url.netloc
        for disabled_domain, params in THINKING_DISABLED_DOMAINS.items():
            if disabled_domain in domain:
                request_params.setdefault("extra_body", {}).update(params)
                logger.bind(tag=TAG).info(f"Disabling thinking mode for domain {domain}, params: {params}")
                break

    def response(self, session_id, dialogue, **kwargs):
        dialogue = self.normalize_dialogue(dialogue)

        request_params = {
            "model": self.model_name,
            "messages": dialogue,
            "stream": True,
        }

        # Add optional parameters if not None
        optional_params = {
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "temperature": kwargs.get("temperature", self.temperature),
            "top_p": kwargs.get("top_p", self.top_p),
            "frequency_penalty": kwargs.get("frequency_penalty", self.frequency_penalty),
        }

        for key, value in optional_params.items():
            if value is not None:
                request_params[key] = value

        # Disable thinking mode
        self._apply_thinking_disabled(request_params)
        if self.stream_usage:
            request_params["stream_options"] = {"include_usage": True}

        self.last_usage = None
        responses = self.client.chat.completions.create(**request_params)

        is_active = True
        try:            
            for chunk in responses:
                self._remember_usage(chunk)
                try:
                    delta = chunk.choices[0].delta if getattr(chunk, "choices", None) else None
                    content = getattr(delta, "content", "") if delta else ""
                except IndexError:
                    content = ""
                if content:
                    if "<think>" in content:
                        is_active = False
                        content = content.split("<think>")[0]
                    if "</think>" in content:
                        is_active = True
                        content = content.split("</think>")[-1]
                    if is_active:
                        yield content
        finally:
            responses.close()

    def response_with_functions(self, session_id, dialogue, functions=None, **kwargs):
        dialogue = self.normalize_dialogue(dialogue)

        request_params = {
            "model": self.model_name,
            "messages": dialogue,
            "stream": True,
            "tools": functions,
        }

        optional_params = {
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "temperature": kwargs.get("temperature", self.temperature),
            "top_p": kwargs.get("top_p", self.top_p),
            "frequency_penalty": kwargs.get("frequency_penalty", self.frequency_penalty),
        }

        for key, value in optional_params.items():
            if value is not None:
                request_params[key] = value

        # Disable thinking mode
        self._apply_thinking_disabled(request_params)
        if self.stream_usage:
            request_params["stream_options"] = {"include_usage": True}

        self.last_usage = None
        stream = self.client.chat.completions.create(**request_params)

        try:
            for chunk in stream:
                self._remember_usage(chunk)
                if getattr(chunk, "choices", None):
                    delta = chunk.choices[0].delta
                    content = getattr(delta, "content", "")
                    tool_calls = getattr(delta, "tool_calls", None)
                    yield content, tool_calls
                elif isinstance(getattr(chunk, "usage", None), CompletionUsage):
                    usage_info = getattr(chunk, "usage", None)
                    logger.bind(tag=TAG).info(
                        f"Token usage: prompt {getattr(usage_info, 'prompt_tokens', 'unknown')}, "
                        f"completion {getattr(usage_info, 'completion_tokens', 'unknown')}, "
                        f"total {getattr(usage_info, 'total_tokens', 'unknown')}"
                    )
        finally:
            stream.close()
