"""Per-person memory: notes filed under the family member the voiceprint check recognised."""

import json
from datetime import date

from core.companion.memory import MemoryBook, transcript
from core.utils.dialogue import Message

TODAY = date(2026, 10, 26)


class FakeLLM:
    def __init__(self, answer):
        self.answer = answer
        self.prompts = []

    def response_no_stream(self, system, user, **kw):
        self.prompts.append(user)
        return json.dumps(self.answer)


CHAT = [
    Message(role="system", content="You are TinyBot"),
    Message(role="user", content='{"speaker": "রাফি", "content": "আমি ক্রিকেট খেলতে খুব ভালোবাসি"}'),
    Message(role="assistant", content="দারুণ!"),
    Message(role="user", content="কাল আমার অংক পরীক্ষা আছে"),
]
SPEAKERS = {1: "রাফি", 3: "রাফি"}


def book(tmp_path):
    return MemoryBook(str(tmp_path), today=lambda: TODAY)


def test_transcript_names_recognised_speakers_only():
    t = transcript(CHAT, SPEAKERS)
    assert "User (রাফি): আমি ক্রিকেট খেলতে খুব ভালোবাসি" in t
    assert "User (রাফি): কাল আমার অংক পরীক্ষা আছে" in t
    # without a speakers map the claimed JSON name is never trusted
    assert "User: আমি ক্রিকেট" in transcript(CHAT)


def test_single_speaker_notes_are_filed_under_them(tmp_path):
    b = book(tmp_path)
    llm = FakeLLM({"add": [{"text": "রাফি ক্রিকেট ভালোবাসে", "kind": "like"},
                           {"text": "রাফির অংক পরীক্ষা", "kind": "event", "until": "2026-10-27", "person": "রাফি"}],
                   "update": [], "remove": []})
    assert b.learn("d1", CHAT, llm, speakers=SPEAKERS)["add"] == 2
    assert {m["person"] for m in b.items("d1")} == {"রাফি"}
    assert "Recognised by voice in this chat: রাফি" in llm.prompts[0]


def test_person_must_be_a_recognised_name(tmp_path):
    b = book(tmp_path)
    speakers = {1: "রাফি", 3: "মা"}
    llm = FakeLLM({"add": [{"text": "মা চা পছন্দ করে", "kind": "like", "person": "মা"},
                           {"text": "দাদু আসবেন", "kind": "fact", "person": "দাদু"},
                           {"text": "বাড়িতে একটা বিড়াল আছে", "kind": "fact"}],
                   "update": [], "remove": []})
    b.learn("d1", CHAT, llm, speakers=speakers)
    people = {m["text"]: m.get("person") for m in b.items("d1")}
    assert people == {"মা চা পছন্দ করে": "মা", "দাদু আসবেন": None, "বাড়িতে একটা বিড়াল আছে": None}


def test_no_voiceprint_means_no_person_backward_compatible(tmp_path):
    b = book(tmp_path)
    llm = FakeLLM({"add": [{"text": "ক্রিকেট পছন্দ", "kind": "like", "person": "রাফি"}], "update": [], "remove": []})
    b.learn("d1", CHAT, llm)
    assert "person" not in b.items("d1")[0]
    assert "Nobody was recognised" in llm.prompts[0]


def test_context_puts_the_speakers_notes_first_and_greets_by_name(tmp_path):
    b = book(tmp_path)
    b.apply("d1", {"add": [{"text": "মা চা পছন্দ করে", "kind": "like", "person": "মা"},
                           {"text": "রাফি ক্রিকেট ভালোবাসে", "kind": "like", "person": "রাফি"},
                           {"text": "বাড়িতে একটা বিড়াল আছে", "kind": "fact"}]}, people=["মা", "রাফি"])
    ctx = b.context("d1", speaker="রাফি")
    assert "Greet রাফি by name" in ctx
    own = ctx.index("What you remember about রাফি")
    assert own < ctx.index("রাফি ক্রিকেট ভালোবাসে") < ctx.index("Other things you remember")
    assert "মা চা পছন্দ করে (about মা)" in ctx
    # nobody recognised: one list as before, people named
    plain = b.context("d1")
    assert "Greet" not in plain and "(about রাফি)" in plain
    # a recognised speaker with no notes yet is still greeted
    assert "Greet নীলা" in book(tmp_path / "x").context("d2", speaker="নীলা")
    assert book(tmp_path / "y").context("d3") == ""


def test_old_notes_without_person_still_load(tmp_path):
    (tmp_path / "memories.json").write_text(json.dumps({"d1": [
        {"id": "m1", "text": "পুরনো নোট", "kind": "fact", "created": "2026-10-01T10:00:00", "updated": "2026-10-01T10:00:00"}]}),
        encoding="utf-8")
    b = book(tmp_path)
    assert b.items("d1")[0]["text"] == "পুরনো নোট"
    assert "পুরনো নোট" in b.context("d1", speaker="রাফি")


def test_service_passes_the_speaker(make_service):
    svc = make_service()
    svc.memory.apply("aa:bb", {"add": [{"text": "রাফি ক্রিকেট ভালোবাসে", "kind": "like", "person": "রাফি"}]},
                     people=["রাফি"])
    svc.memory_enabled = lambda device_id: True
    ctx = svc.ai_context("AA:BB", speaker="রাফি")
    assert "Greet রাফি" in ctx and "রাফি ক্রিকেট ভালোবাসে" in ctx
