"""Server plugin tool executor"""

import asyncio
from typing import Dict, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from core.connection import ConnectionHandler
from ..base import ToolType, ToolDefinition, ToolExecutor
from plugins_func.register import all_function_registry, module_func_map, Action, ActionResponse


class ServerPluginExecutor(ToolExecutor):
    """Server plugin tool executor"""

    def __init__(self, conn: "ConnectionHandler"):
        self.conn = conn
        self.config = conn.config

    async def execute(
        self, conn: "ConnectionHandler", tool_name: str, arguments: Dict[str, Any]
    ) -> ActionResponse:
        """Execute server plugin tool"""
        # Speaker voiceprint security authorization check
        from core.utils.voiceprint_security import verify_speaker_security
        allowed, refusal = await verify_speaker_security(conn, tool_name, arguments)
        if not allowed:
            return ActionResponse(action=Action.REQLLM, result=refusal, response=refusal)

        func_item = all_function_registry.get(tool_name)
        if not func_item:
            return ActionResponse(
                action=Action.NOTFOUND, response=f"Plugin function {tool_name} does not exist"
            )

        try:
            # Decide call method based on tool type
            if hasattr(func_item, "type"):
                func_type = func_item.type
                if func_type.code in [4, 5]:  # SYSTEM_CTL, IOT_CTL (requires conn parameter)
                    result = func_item.func(conn, **arguments)
                elif func_type.code == 2:  # WAIT
                    result = func_item.func(**arguments)
                elif func_type.code == 3:  # CHANGE_SYS_PROMPT
                    result = func_item.func(conn, **arguments)
                else:
                    result = func_item.func(**arguments)
            else:
                # Default without conn parameter
                result = func_item.func(**arguments)

            # Compatible with async def tool functions
            if asyncio.iscoroutine(result):
                result = await result

            return result

        except Exception as e:
            return ActionResponse(
                action=Action.ERROR,
                response=str(e),
            )

    def _expand_plugin_names(self, config_functions):
        """Expand module-level plugin names to specific function names.

        A function file may register multiple @register_function instances.
        If the configuration uses a module name (file name), expand it to the registered function list.
        """
        if not isinstance(config_functions, list):
            try:
                config_functions = list(config_functions)
            except TypeError:
                return []

        expanded = []
        for name in config_functions:
            if name in module_func_map:
                # Module name: expand to all registered function names under that module
                expanded.extend(module_func_map[name])
            elif name in all_function_registry:
                # Exact function name match: keep directly
                expanded.append(name)
            else:
                # Unknown name: keep original value (could be MCP or other tool)
                expanded.append(name)
        return expanded

    def _get_plugin_description(self, func_name):
        """Get plugin function description, matching exact function name first, then module name."""
        plugins = self.config.get("plugins", {})
        # Exact function name match
        if func_name in plugins:
            return plugins[func_name].get("description", "")
        # Reverse lookup module name via module_func_map
        for module_name, func_names in module_func_map.items():
            if func_name in func_names and module_name in plugins:
                return plugins[module_name].get("description", "")
        return ""

    def get_tools(self) -> Dict[str, ToolDefinition]:
        """Get all registered server plugin tools"""
        tools = {}

        # Get necessary functions
        necessary_functions = ["handle_exit_intent", "get_lunar"]

        # Get functions from configuration
        config_functions = self.config["Intent"][
            self.config["selected_module"]["Intent"]
        ].get("functions", [])

        # Expand module-level plugin names to concrete function names
        config_functions = self._expand_plugin_names(config_functions)

        # Merge all required functions
        all_required_functions = list(set(necessary_functions + config_functions))

        for func_name in all_required_functions:
            func_item = all_function_registry.get(func_name)
            if func_item:
                # Get description from function registry (supports module and function name lookup)
                fun_description = self._get_plugin_description(func_name)
                if fun_description is not None and len(fun_description) > 0:
                    if "function" in func_item.description and isinstance(
                        func_item.description["function"], dict
                    ):
                        func_item.description["function"][
                            "description"
                        ] = fun_description

                # News plugin: update news source parameter description based on config
                if func_name == "get_news_from_newsnow":
                    self._init_news_source_description(func_item, func_name)

                tools[func_name] = ToolDefinition(
                    name=func_name,
                    description=func_item.description,
                    tool_type=ToolType.SERVER_PLUGIN,
                )

        return tools

    def has_tool(self, tool_name: str) -> bool:
        """Check if specified server plugin tool exists"""
        return tool_name in all_function_registry

    def _init_news_source_description(self, func_item, func_name):
        """Initialize news tool parameter description according to connection config"""
        news_sources = (
            self.config.get("plugins", {})
            .get(func_name, {})
            .get("news_sources", "")
        )
        if not news_sources:
            news_sources = "thepaper;hackernews;github"
        sources_str = news_sources.replace(";", ", ")
        try:
            func_item.description["function"]["parameters"]["properties"]["source"][
                "description"
            ] = f"Standard name or ID of the news source, e.g., {sources_str}. Optional parameter, default source is used if omitted."
        except (KeyError, TypeError):
            pass
