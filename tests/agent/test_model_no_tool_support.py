"""Omit-tools recovery for models that reject the tools field.

Houdry fabric (and some Ollama/llama.cpp tags) return HTTP 400
``does not support tools`` even on a plain chat turn because Hermes always
sends tool schemas. Recovery is: remember the pinned model, omit tools,
retry the same model — never switch to model=auto.
"""

from types import SimpleNamespace

from agent.chat_completion_helpers import (
    mark_model_tools_unsupported,
    resolve_tools_for_api,
)


def _agent(model="lfm2.5-thinking:1.2b"):
    return SimpleNamespace(
        model=model,
        tools=[{"type": "function", "function": {"name": "terminal"}}],
    )


def test_resolve_tools_unchanged_until_model_is_marked():
    agent = _agent()
    assert resolve_tools_for_api(agent) is agent.tools
    assert resolve_tools_for_api(agent, [{"type": "function"}]) == [
        {"type": "function"}
    ]


def test_marked_model_omits_tools_on_later_turns():
    agent = _agent()
    mark_model_tools_unsupported(agent)
    assert resolve_tools_for_api(agent) == []
    assert resolve_tools_for_api(agent, agent.tools) == []


def test_switching_models_restores_tools():
    agent = _agent()
    mark_model_tools_unsupported(agent)
    agent.model = "qwen2.5-coder:1.5b"
    assert resolve_tools_for_api(agent) is agent.tools


def test_mark_is_a_no_op_without_a_model():
    agent = SimpleNamespace(model="", tools=[{"name": "terminal"}])
    mark_model_tools_unsupported(agent)
    assert resolve_tools_for_api(agent) is agent.tools
