"""Unit tests for the ClientIdMiddleware path predicate.

Locks down which endpoints advance ``last_seen_at`` on the
``MCPClientBinding`` row. Getting this wrong is silent: the Settings UI
just shows a stale "last heard from" timestamp and bindings never get
auto-created for new REST callers.
"""

import pytest

from backend.mcp_server.context import _is_stamped_path, is_valid_client_id


@pytest.mark.parametrize(
    "path",
    [
        "/mcp",
        "/mcp/",
        "/mcp/tools/call",
        "/mcp/bindings",  # admin REST; benign — frontend never sets the header
        "/speak",
        "/speak/",
    ],
)
def test_mcp_semantic_paths_are_stamped(path: str) -> None:
    assert _is_stamped_path(path) is True


@pytest.mark.parametrize(
    "path",
    [
        "/",
        "/health",
        "/generate",
        "/captures",
        "/profiles",
        "/profiles/abc/compose",
        "/events/speak",
        "/tasks/active",
        "/llm/generate",
        # Prefix overlap should not match — /speakers is a hypothetical
        # future endpoint that shouldn't leak the stamp.
        "/speakers",
        # Same for anything starting with /mcpfoo.
        "/mcpfoo",
    ],
)
def test_other_paths_are_not_stamped(path: str) -> None:
    assert _is_stamped_path(path) is False


@pytest.mark.parametrize(
    "value",
    [
        None,
        "",
        "claude-code",
        "antigravity-a1b2c3",
        "test",
        "a",
        "a:b:c",
        "foo_bar.baz",
        "a" * 128,  # exactly MAX_CLIENT_ID_LEN — boundary
    ],
)
def test_client_id_validator_accepts_safe(value: str | None) -> None:
    assert is_valid_client_id(value) is True


@pytest.mark.parametrize(
    "value",
    [
        "has space",
        "<script>alert(1)</script>",
        "a" * 129,  # one past MAX_CLIENT_ID_LEN
        "foo\nbar",  # newline
        "foo\x00bar",  # NUL
        "foo/bar",  # path separator
        "../etc/passwd",  # path traversal
        "한국어",  # non-ASCII
        "foo bar",  # internal whitespace
    ],
)
def test_client_id_validator_rejects_unsafe(value: str) -> None:
    assert is_valid_client_id(value) is False
