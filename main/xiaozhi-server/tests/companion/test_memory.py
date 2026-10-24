import json
from datetime import date

from core.companion import schema
from core.companion.memory import MAX_ITEMS, MemoryBook, transcript
from core.utils.dialogue import Message

TODAY = date(2026, 10, 25)


def book(tmp_path):
    return MemoryBook(str(tmp_path), today=lambda: TODAY)


class FakeLLM:
    def __init__(self, answer):
        self.answer = answer
        self.prompts = []

    def response_no_stream(self, system, user, **kw):
        self.prompts.append(user)
        return self.answer


CHAT = [
    Message(role="system", content="You are TinyBot"),
    Message(role="user", content="আমার নাম রাফি, আমি ক্লাস থ্রিতে পড়ি"),
    Message(role="assistant", content="বাহ রাফি!"),
    Message(role="user", content='{"speaker": "x", "content": "মঙ্গলবার আমার অংক পরীক্ষা"}'),
]


def test_transcript_keeps_turns_and_hides_instructions():
    t = transcript(CHAT + [Message(role="user", content="[TinyBot starts this chat by itself; ...]")])
    assert "You are TinyBot" not in t
    assert "User: মঙ্গলবার আমার অংক পরীক্ষা" in t
    assert t.endswith("(TinyBot greeted first)")


def test_learn_adds_updates_removes_and_persists(tmp_path):
    b = book(tmp_path)
    llm = FakeLLM(json.dumps({"add": [
        {"text": "রাফি ক্লাস থ্রিতে পড়ে", "kind": "person"},
        {"text": "রাফির অংক পরীক্ষা মঙ্গলবার", "kind": "event", "until": "2026-10-27"},
        {"text": "রাফি ক্লাস থ্রিতে পড়ে", "kind": "person"},  # duplicate
    ], "update": [], "remove": []}))
    assert b.learn("d1", CHAT, llm) == {"add": 2, "update": 0, "remove": 0}
    items = MemoryBook(str(tmp_path), today=lambda: TODAY).items("d1")
    assert [m["kind"] for m in items] == ["person", "event"]
    first = items[0]["id"]
    llm.answer = "<think>x</think>```json\n" + json.dumps(
        {"add": [], "update": [{"id": first, "text": "রাফি ক্লাস ফোরে উঠেছে"}], "remove": [items[1]["id"]]}) + "\n```"
    assert b.learn("d1", CHAT, llm) == {"add": 0, "update": 1, "remove": 1}
    assert [m["text"] for m in b.items("d1")] == ["রাফি ক্লাস ফোরে উঠেছে"]
    assert first in llm.prompts[-1]  # the model sees the ids of current notes


def test_short_chats_and_bad_answers_change_nothing(tmp_path):
    b = book(tmp_path)
    assert b.learn("d1", [Message(role="user", content="হাই")], FakeLLM("{}")) is None
    assert b.learn("d1", CHAT, FakeLLM("sorry, no json")) is None
    assert b.items("d1") == []


def test_events_expire_and_notebook_is_capped(tmp_path):
    b = book(tmp_path)
    b.apply("d1", {"add": [{"text": "old exam", "kind": "event", "until": "2026-10-20"}]})
    b.apply("d1", {"add": [{"text": "trip", "kind": "event"}]})  # gets a default end date
    texts = [m["text"] for m in b.items("d1")]
    assert texts == ["trip"] and b.items("d1")[0]["until"] == "2026-11-08"
    b.apply("d1", {"add": [{"text": f"fact {i}"} for i in range(MAX_ITEMS + 5)]})
    assert len(b.items("d1")) == MAX_ITEMS


def test_context_block(tmp_path):
    b = book(tmp_path)
    assert b.context("d1") == ""
    b.apply("d1", {"add": [{"text": "Rafi likes red", "kind": "like"}]})
    ctx = b.context("d1")
    assert ctx.startswith("<tinybot_memory>") and "- Rafi likes red [" in ctx


def test_delete_and_clear(tmp_path):
    b = book(tmp_path)
    b.apply("d1", {"add": [{"text": "a"}, {"text": "b"}]})
    ids = [m["id"] for m in b.items("d1")]
    assert b.delete("d1", ids[:1]) == 1
    assert [m["text"] for m in b.items("d1")] == ["b"]
    b.clear("d1")
    assert b.items("d1") == []


def test_memory_setting():
    out = schema.settings({}, {"memory": {"enabled": False}})
    assert out["memory"] == {"enabled": False}
