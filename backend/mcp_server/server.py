"""Construct the FastMCP server and mount it on the FastAPI app.

The MCP endpoint lives at ``/mcp`` (Streamable HTTP transport). Modern MCP
clients (Claude Desktop, Cursor, Windsurf, Antigravity, VS Code MCP extensions)
connect directly via URL; older stdio-only clients use the ``voicebox-mcp`` shim
binary bundled with the desktop app.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from contextlib import AsyncExitStack, asynccontextmanager

from fastapi import FastAPI
from fastmcp import FastMCP

from .context import ClientIdMiddleware
from .tools import register_tools

logger = logging.getLogger(__name__)


def build_mcp_server() -> FastMCP:
    """Create the FastMCP instance with Voicebox tools, resources, and prompts."""
    mcp = FastMCP(
        name="voicebox",
        instructions=(
            "Voicebox is a high-performance local AI Voice engine (M3 Ultra 32-core accelerated). "
            "Available tools: "
            "1) `voicebox.generate_audio`: Synthesizes speech and waits for completion, returning the audio path and duration. "
            "2) `voicebox.speak`: Asynchronous TTS playback. "
            "3) `voicebox.create_profile`: Create a new voice cloning profile from reference audio. "
            "4) `voicebox.remove_bgm`: Remove background music using Demucs AI, isolating clean vocal speech. "
            "5) `voicebox.trim_audio`: Slice audio files by start/end seconds. "
            "6) `voicebox.transcribe`: Speech-to-text transcription via local Whisper. "
            "7) `voicebox.list_profiles`: List all active voice profiles and character personalities. "
            "8) `voicebox.get_status`: Get system, hardware, and model engine status."
        ),
    )
    register_tools(mcp)
    _register_resources_and_prompts(mcp)
    return mcp


def _register_resources_and_prompts(mcp: FastMCP) -> None:
    """Attach FastMCP resources and prompts for AI client discovery."""
    from ..database import get_db
    from ..services import profiles as profiles_service

    @mcp.resource("voicebox://profiles")
    async def get_profiles_resource() -> str:
        """Get all available Voicebox voice profiles as a JSON resource."""
        db = next(get_db())
        try:
            profiles = await profiles_service.list_profiles(db)
            return json.dumps(
                [
                    {
                        "id": p.id,
                        "name": p.name,
                        "language": p.language,
                        "voice_type": p.voice_type,
                        "personality": getattr(p, "personality", None),
                    }
                    for p in profiles
                ],
                ensure_ascii=False,
                indent=2,
            )
        finally:
            db.close()

    @mcp.prompt()
    def korean_storyteller(topic: str) -> str:
        """Prompt template for generating Korean story text for Voicebox TTS."""
        return (
            f"주제 '{topic}'에 대해 7세 아동에게 들려줄 따뜻하고 재미있는 한국어 전래동화 이야기를 3~5문장으로 작성해줘. "
            "낭독 캐릭터가 소리 내어 읽기 좋게 생생하고 친근한 어투로 구성해줘."
        )


def mount_into(
    app: FastAPI,
    *,
    extra_startup: Callable[[], None] | None = None,
) -> None:
    """Attach the MCP app to ``app`` at ``/mcp`` and install the client-id middleware."""
    mcp = build_mcp_server()
    mcp_app = mcp.http_app(path="/", transport="http")

    app.add_middleware(ClientIdMiddleware)
    app.mount("/mcp", mcp_app)
    app.state.mcp_lifespan = mcp_app.router.lifespan_context
    logger.info("MCP: mounted at /mcp (FastMCP %s)", getattr(mcp, "version", ""))


def compose_lifespan(*lifespans):
    """Combine multiple async context managers into a single FastAPI lifespan."""

    @asynccontextmanager
    async def _combined(app):
        async with AsyncExitStack() as stack:
            for cm_factory in lifespans:
                cm = cm_factory(app) if callable(cm_factory) else cm_factory
                await stack.enter_async_context(cm)
            yield

    return _combined
