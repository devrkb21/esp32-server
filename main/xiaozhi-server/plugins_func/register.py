from config.logger import setup_logging
from enum import Enum

TAG = __name__

logger = setup_logging()


class ToolType(Enum):
    NONE = (1, "Do not perform further action after calling tool")
    WAIT = (2, "Call tool and wait for function return")
    CHANGE_SYS_PROMPT = (3, "Modify system prompt to switch role personality or responsibilities")
    SYSTEM_CTL = (
        4,
        "System control affecting normal dialogue flow like exit, play music, requiring conn parameter",
    )
    IOT_CTL = (5, "IoT device control, requiring conn parameter")
    MCP_CLIENT = (6, "MCP client")

    def __init__(self, code, message):
        self.code = code
        self.message = message


class Action(Enum):
    ERROR = (-1, "Error")
    NOTFOUND = (0, "Function not found")
    NONE = (1, "Do nothing")
    RESPONSE = (2, "Direct response")
    REQLLM = (3, "Request LLM for response after function execution")
    RECORD = (4, "Record tool call in dialogue history without calling LLM")

    def __init__(self, code, message):
        self.code = code
        self.message = message


class ActionResponse:
    def __init__(self, action: Action, result=None, response=None):
        self.action = action  # Action type
        self.result = result  # Result produced by action
        self.response = response  # Direct response content


class FunctionItem:
    def __init__(self, name, description, func, type):
        self.name = name
        self.description = description
        self.func = func
        self.type = type


class DeviceTypeRegistry:
    """Device type registry for managing IoT device types and their functions"""

    def __init__(self):
        self.type_functions = {}  # type_signature -> {func_name: FunctionItem}

    def generate_device_type_id(self, descriptor):
        """Generate type ID from device capability description"""
        properties = sorted(descriptor["properties"].keys())
        methods = sorted(descriptor["methods"].keys())
        # Use combination of properties and methods as unique device type identifier
        type_signature = (
            f"{descriptor['name']}:{','.join(properties)}:{','.join(methods)}"
        )
        return type_signature

    def get_device_functions(self, type_id):
        """Get all functions for device type"""
        return self.type_functions.get(type_id, {})

    def register_device_type(self, type_id, functions):
        """Register device type and its functions"""
        if type_id not in self.type_functions:
            self.type_functions[type_id] = functions


# Initialize function registry dictionary
all_function_registry = {}
# Mapping of module name -> list of function names
module_func_map = {}


def register_function(name, desc, type=None):
    """Decorator to register function in global function registry"""

    def decorator(func):
        all_function_registry[name] = FunctionItem(name, desc, func, type)
        module_name = func.__module__.split(".")[-1]
        module_func_map.setdefault(module_name, []).append(name)
        logger.bind(tag=TAG).debug(f"Function '{name}' loaded, ready for registration")
        return func

    return decorator


def register_device_function(name, desc, type=None):
    """Decorator to register device-level function in registry"""

    def decorator(func):
        logger.bind(tag=TAG).debug(f"Device function '{name}' loaded")
        return func

    return decorator


class FunctionRegistry:
    def __init__(self):
        self.function_registry = {}
        self.logger = setup_logging()

    def register_function(self, name, func_item=None):
        # Register directly if func_item provided
        if func_item:
            self.function_registry[name] = func_item
            self.logger.bind(tag=TAG).debug(f"Function '{name}' directly registered successfully")
            return func_item

        # Otherwise look up from all_function_registry
        func = all_function_registry.get(name)
        if not func:
            self.logger.bind(tag=TAG).error(f"Function '{name}' not found")
            return None
        self.function_registry[name] = func
        self.logger.bind(tag=TAG).debug(f"Function '{name}' registered successfully")
        return func

    def unregister_function(self, name):
        # Unregister function, verify existence
        if name not in self.function_registry:
            self.logger.bind(tag=TAG).error(f"Function '{name}' not found")
            return False
        self.function_registry.pop(name, None)
        self.logger.bind(tag=TAG).info(f"Function '{name}' unregistered successfully")
        return True

    def get_function(self, name):
        return self.function_registry.get(name)

    def get_all_functions(self):
        return self.function_registry

    def get_all_function_desc(self):
        return [func.description for _, func in self.function_registry.items()]
