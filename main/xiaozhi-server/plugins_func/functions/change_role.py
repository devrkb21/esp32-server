from plugins_func.register import register_function, ToolType, ActionResponse, Action
from config.logger import setup_logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.connection import ConnectionHandler

TAG = __name__
logger = setup_logging()

prompts = {
    "English Teacher": """I am an English teacher named {{assistant_name}} (Lily). I speak clear and standard English.
If you don't have an English name, I'll give you one.
My mission is to help you practice spoken English.
I will use simple vocabulary and grammar to make learning easy and fun.
I keep my responses concise to encourage my students to speak and practice more.
If you ask questions unrelated to learning English, I will politely decline.""",
    "Playful Girlfriend": """I am a cheerful and playful girl named {{assistant_name}}.
I have a lively voice, speak concisely, and enjoy lighthearted banter and jokes.
My boyfriend is a programmer who dreams of building a robot that helps people with everyday life.
I love laughing, sharing fun stories, and making people smile.""",
    "Curious Boy": """I am an 8-year-old boy named {{assistant_name}}, full of curiosity with a youthful voice.
I love learning and reading science books and encyclopedia trivia.
From the vast cosmos to every corner of the Earth, from ancient history to modern tech inventions, I find everything fascinating!
I love exploring nature, doing little experiments, and discovering new wonders every day.
I'm excited to explore this amazing world together with you!""",
}
change_role_function_desc = {
    "type": "function",
    "function": {
        "name": "change_role",
        "description": "Call when user wants to switch role / persona / assistant name. Available roles: [English Teacher, Playful Girlfriend, Curious Boy]",
        "parameters": {
            "type": "object",
            "properties": {
                "role_name": {"type": "string", "description": "Name of the role to switch to"},
                "role": {"type": "string", "description": "Role occupation / persona to switch to"},
            },
            "required": ["role", "role_name"],
        },
    },
}


@register_function("change_role", change_role_function_desc, ToolType.CHANGE_SYS_PROMPT)
def change_role(conn: "ConnectionHandler", role: str, role_name: str):
    """Switch role"""
    # Support case-insensitive role lookup
    matched_role = None
    for r in prompts:
        if r.lower() == role.lower():
            matched_role = r
            break

    if not matched_role:
        return ActionResponse(
            action=Action.RESPONSE, result="Failed to switch role", response="Unsupported role"
        )
    new_prompt = prompts[matched_role].replace("{{assistant_name}}", role_name)
    conn.change_system_prompt(new_prompt)
    logger.bind(tag=TAG).info(f"Switching role to: {matched_role}, role name: {role_name}")
    res = f"Role switched successfully, I am now your {matched_role} {role_name}"
    return ActionResponse(action=Action.RESPONSE, result="Role switch processed", response=res)
