"""Voicebox MCP tool implementations.

Provides comprehensive local Voice AI capabilities for external AI agents (Claude,
Cursor, Windsurf, Antigravity, AutoGPT, etc.).
"""

from __future__ import annotations

import asyncio
import base64 as b64
import io
import logging
import os
import tempfile
import uuid
from pathlib import Path
from typing import Any, Literal

import soundfile as sf
from fastmcp import FastMCP

from .. import config, models
from ..database import Generation as DBGeneration, VoiceProfile as DBVoiceProfile, get_db
from ..services import captures as captures_service
from ..services import history as history_service
from ..services import profiles as profiles_service
from ..services.vocal_separator import remove_background_music
from ..utils.audio import load_audio
from . import events as mcp_events
from .context import current_client_id, request_is_loopback
from .resolve import resolve_profile

logger = logging.getLogger(__name__)

# Absolute-path transcribes are bounded to keep a bad client from
# asking us to ingest a 200 MB+ file.
MAX_TRANSCRIBE_BYTES = 200 * 1024 * 1024  # 200 MB


def register_tools(mcp: FastMCP) -> None:
    """Attach all Voicebox tools to the given FastMCP instance."""

    # ── 1. voicebox.speak (Async generation with immediate return) ───────────
    @mcp.tool(
        name="voicebox.speak",
        description=(
            "Speak text in a Voicebox voice profile. Initiates generation and returns "
            "immediately with a generation ID. Audio is played and saved to history."
        ),
    )
    async def voicebox_speak(
        text: str,
        profile: str | None = None,
        engine: str | None = None,
        personality: bool | None = None,
        language: str = "ko",
        instruct: str | None = None,
        model_size: Literal["1.7B", "0.6B", "1B", "3B"] | None = None,
    ) -> dict[str, Any]:
        """Speak ``text`` in a voice profile asynchronously."""
        from ..database.models import MCPClientBinding

        db = next(get_db())
        try:
            client_id = current_client_id.get()
            vp = resolve_profile(profile, client_id, db)
            if vp is None:
                raise ValueError(
                    "No voice profile resolved. Pass `profile=` with a "
                    "voice profile name or id (e.g. '소희', '이야기 할머니', '하츄핑'), "
                    "or call `voicebox.list_profiles` to view available voices."
                )

            binding = None
            if client_id:
                binding = (
                    db.query(MCPClientBinding)
                    .filter(MCPClientBinding.client_id == client_id)
                    .first()
                )

            resolved_personality = personality
            if resolved_personality is None and binding is not None:
                resolved_personality = bool(binding.default_personality)

            resolved_engine = engine
            if resolved_engine is None and binding is not None:
                resolved_engine = binding.default_engine

            use_persona = bool(resolved_personality) and bool(vp.personality)
            return await _speak(
                profile_id=vp.id,
                profile_name=vp.name,
                text=text,
                engine=resolved_engine,
                language=language,
                personality=use_persona,
                instruct=instruct,
                model_size=model_size,
                db=db,
            )
        finally:
            db.close()

    # ── 2. voicebox.generate_audio (Synchronous/Blocking TTS generation) ──────
    @mcp.tool(
        name="voicebox.generate_audio",
        description=(
            "Generate speech from text and WAIT until audio synthesis is complete. "
            "Returns the final audio file path, duration, and optional base64 audio data. "
            "Pass `instruct=` to control tone, emotion, pitch, and character style (e.g. '높고 귀여운 하이톤 요정 목소리')."
        ),
    )
    async def voicebox_generate_audio(
        text: str,
        profile: str | None = None,
        language: str = "ko",
        engine: str | None = None,
        personality: bool | None = None,
        instruct: str | None = None,
        return_base64: bool = False,
        timeout_seconds: float = 60.0,
        model_size: Literal["1.7B", "0.6B", "1B", "3B"] | None = None,
    ) -> dict[str, Any]:
        """Synthesize speech and block until audio is ready."""
        from ..database.models import MCPClientBinding

        db = next(get_db())
        try:
            client_id = current_client_id.get()
            vp = resolve_profile(profile, client_id, db)
            if vp is None:
                raise ValueError(
                    "No voice profile resolved. Pass `profile=` with a "
                    "voice profile name or id, or call `voicebox.list_profiles`."
                )

            binding = None
            if client_id:
                binding = (
                    db.query(MCPClientBinding)
                    .filter(MCPClientBinding.client_id == client_id)
                    .first()
                )

            resolved_personality = personality
            if resolved_personality is None and binding is not None:
                resolved_personality = bool(binding.default_personality)

            resolved_engine = engine
            if resolved_engine is None and binding is not None:
                resolved_engine = binding.default_engine

            use_persona = bool(resolved_personality) and bool(vp.personality)

            # Start generation
            speak_res = await _speak(
                profile_id=vp.id,
                profile_name=vp.name,
                text=text,
                engine=resolved_engine,
                language=language,
                personality=use_persona,
                instruct=instruct,
                model_size=model_size,
                db=db,
            )

            gen_id = speak_res.get("generation_id")
            if not gen_id:
                raise RuntimeError("Failed to obtain generation ID.")

            # Wait for generation to complete
            start_time = asyncio.get_event_loop().time()
            completed_gen = None

            while (asyncio.get_event_loop().time() - start_time) < timeout_seconds:
                db.expire_all()
                db_row = db.query(DBGeneration).filter(DBGeneration.id == gen_id).first()
                if db_row and db_row.status == "completed":
                    completed_gen = db_row
                    break
                elif db_row and db_row.status == "failed":
                    raise RuntimeError(f"Audio generation failed: {db_row.error or 'Unknown error'}")

                await asyncio.sleep(0.3)

            if not completed_gen:
                raise TimeoutError(f"Audio generation timed out after {timeout_seconds}s.")

            data_dir = config.get_data_dir()
            audio_path = os.path.join(data_dir, completed_gen.audio_path) if completed_gen.audio_path else None

            result: dict[str, Any] = {
                "generation_id": gen_id,
                "status": "completed",
                "profile": vp.name,
                "text": completed_gen.text,
                "duration": completed_gen.duration,
                "audio_path": audio_path,
                "audio_url": f"/audio/{gen_id}",
            }

            if return_base64 and audio_path and os.path.exists(audio_path):
                with open(audio_path, "rb") as f:
                    result["audio_base64"] = b64.b64encode(f.read()).decode("utf-8")

            return result
        finally:
            db.close()

    def _resolve_hachuping(lang: str, session: Session) -> DBVoiceProfile | None:
        if lang.lower() in ("en", "english"):
            for candidate in ("하츄핑-영어", "하츄핑 (영어)", "하츄핑 영어", "하츄핑_영어", "하츄핑-en", "하츄핑 (English)", "하츄핑"):
                p = resolve_profile(candidate, None, session)
                if p is not None:
                    return p
        return resolve_profile("하츄핑", None, session) or resolve_profile("하츄핑-영어", None, session)

    # ── 3. voicebox.hachuping (하츄핑 프로필 웹 UI와 100% 동일 발화) ────────────
    @mcp.tool(
        name="voicebox.hachuping",
        description=(
            "Speak directly in the registered 'Hachuping' (하츄핑) profile. "
            "If language is 'en', automatically uses the '하츄핑-영어' profile. 100% identical to web UI."
        ),
    )
    async def voicebox_hachuping(
        text: str,
        language: str = "ko",
    ) -> dict[str, Any]:
        """Speak using the exact Hachuping profile identical to web UI."""
        db = next(get_db())
        try:
            vp = _resolve_hachuping(language, db)
            if vp is None:
                raise ValueError(
                    "하츄핑 프로필을 찾을 수 없습니다. Voicebox 프로필에 '하츄핑' 또는 '하츄핑-영어'가 등록되어 있는지 확인해주세요."
                )

            return await _speak(
                profile_id=vp.id,
                profile_name=vp.name,
                text=text,
                engine="qwen",
                language=language,
                personality=False,
                instruct=None,
                effects_chain=None,
                model_size="1.7B",
                db=db,
            )
        finally:
            db.close()

    # ── 4. voicebox.hachuping_generate (하츄핑 프로필 웹 UI와 100% 동일 파일 생성) ──
    @mcp.tool(
        name="voicebox.hachuping_generate",
        description=(
            "Generate 'Hachuping' (하츄핑) audio file exactly like web UI and WAIT until complete. "
            "If language is 'en', automatically uses '하츄핑-영어'. Returns audio file path and optional base64."
        ),
    )
    async def voicebox_hachuping_generate(
        text: str,
        language: str = "ko",
        return_base64: bool = False,
        timeout_seconds: float = 60.0,
    ) -> dict[str, Any]:
        """Synthesize Hachuping audio exactly identical to web UI."""
        db = next(get_db())
        try:
            vp = _resolve_hachuping(language, db)
            if vp is None:
                raise ValueError(
                    "하츄핑 프로필을 찾을 수 없습니다. Voicebox 프로필에 '하츄핑' 또는 '하츄핑-영어'가 등록되어 있는지 확인해주세요."
                )

            speak_res = await _speak(
                profile_id=vp.id,
                profile_name=vp.name,
                text=text,
                engine="qwen",
                language=language,
                personality=False,
                instruct=None,
                effects_chain=None,
                model_size="1.7B",
                db=db,
            )

            gen_id = speak_res.get("generation_id")
            if not gen_id:
                raise RuntimeError("Failed to obtain generation ID.")

            start_time = asyncio.get_event_loop().time()
            completed_gen = None

            while (asyncio.get_event_loop().time() - start_time) < timeout_seconds:
                db.expire_all()
                db_row = db.query(DBGeneration).filter(DBGeneration.id == gen_id).first()
                if db_row and db_row.status == "completed":
                    completed_gen = db_row
                    break
                elif db_row and db_row.status == "failed":
                    raise RuntimeError(f"Audio generation failed: {db_row.error or 'Unknown error'}")

                await asyncio.sleep(0.3)

            if not completed_gen:
                raise TimeoutError(f"Hachuping generation timed out after {timeout_seconds}s.")

            data_dir = config.get_data_dir()
            audio_path = os.path.join(data_dir, completed_gen.audio_path) if completed_gen.audio_path else None

            result: dict[str, Any] = {
                "generation_id": gen_id,
                "status": "completed",
                "character": vp.name,
                "text": completed_gen.text,
                "duration": completed_gen.duration,
                "audio_path": audio_path,
                "audio_url": f"/audio/{gen_id}",
            }

            if return_base64 and audio_path and os.path.exists(audio_path):
                with open(audio_path, "rb") as f:
                    result["audio_base64"] = b64.b64encode(f.read()).decode("utf-8")

            return result
        finally:
            db.close()

    # ── 5. voicebox.hachuping_en (하츄핑-영어 프로필 전용 발화) ───────────────
    @mcp.tool(
        name="voicebox.hachuping_en",
        description=(
            "Speak directly in English using the dedicated '하츄핑-영어' (Hachuping English) profile. "
            "100% identical to generating English audio from the Voicebox web UI."
        ),
    )
    async def voicebox_hachuping_en(
        text: str,
    ) -> dict[str, Any]:
        """Speak English using the dedicated '하츄핑-영어' profile."""
        return await voicebox_hachuping(text=text, language="en")

    # ── 6. voicebox.hachuping_en_generate (하츄핑-영어 전용 파일 생성 및 대기) ────
    @mcp.tool(
        name="voicebox.hachuping_en_generate",
        description=(
            "Generate English audio file using '하츄핑-영어' (Hachuping English) profile and WAIT until complete. "
            "Returns audio file path and optional base64. 100% identical to web generation."
        ),
    )
    async def voicebox_hachuping_en_generate(
        text: str,
        return_base64: bool = False,
        timeout_seconds: float = 60.0,
    ) -> dict[str, Any]:
        """Synthesize English Hachuping audio and block until complete."""
        return await voicebox_hachuping_generate(
            text=text,
            language="en",
            return_base64=return_base64,
            timeout_seconds=timeout_seconds,
        )

    # ── 3. voicebox.create_profile (AI Voice Profile Creator) ────────────────
    @mcp.tool(
        name="voicebox.create_profile",
        description=(
            "Create a new voice cloning profile from a reference audio file or base64. "
            "Allows AI to autonomously register characters and voices."
        ),
    )
    async def voicebox_create_profile(
        name: str,
        audio_path: str | None = None,
        audio_base64: str | None = None,
        language: str = "ko",
        description: str | None = None,
        personality: str | None = None,
        reference_text: str | None = None,
    ) -> dict[str, Any]:
        """Create a new Voice Profile in Voicebox."""
        if bool(audio_path) == bool(audio_base64):
            raise ValueError("Pass exactly one of `audio_path` or `audio_base64`.")

        raw_bytes: bytes
        if audio_path is not None:
            path = Path(audio_path)
            if not path.is_file():
                raise ValueError(f"Sample audio file not found: {audio_path}")
            raw_bytes = path.read_bytes()
        else:
            try:
                raw_bytes = b64.b64decode(audio_base64 or "", validate=True)
            except Exception as e:
                raise ValueError(f"Invalid audio_base64: {e}") from e

        db = next(get_db())
        try:
            data = models.VoiceProfileCreate(
                name=name,
                language=language,
                description=description or f"Created via MCP for {name}",
                personality=personality,
            )
            profile = await profiles_service.create_profile(data=data, db=db)

            # Update reference text if provided
            if reference_text:
                update_req = models.ProfileUpdateRequest(
                    reference_text=reference_text,
                )
                await profiles_service.update_profile(profile.id, update_req, db)

            # Attach audio sample
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(raw_bytes)
                tmp_path = tmp.name
            try:
                sample = await profiles_service.add_profile_sample(
                    profile_id=profile.id,
                    audio_path=tmp_path,
                    reference_text=reference_text or "",
                    db=db,
                )
            finally:
                Path(tmp_path).unlink(missing_ok=True)

            return {
                "id": profile.id,
                "name": profile.name,
                "language": profile.language,
                "voice_type": profile.voice_type,
                "personality": personality,
                "sample_id": sample.id if sample else None,
                "sample_duration": sample.duration if sample else None,
                "status": "created",
            }
        finally:
            db.close()

    # ── 4. voicebox.remove_bgm (AI Vocal & BGM Isolation) ───────────────────
    @mcp.tool(
        name="voicebox.remove_bgm",
        description=(
            "Remove background music (BGM), beats, and instruments from an audio file "
            "using Meta Demucs AI, isolating clean vocal speech."
        ),
    )
    async def voicebox_remove_bgm(
        audio_path: str | None = None,
        audio_base64: str | None = None,
        output_path: str | None = None,
        return_base64: bool = False,
    ) -> dict[str, Any]:
        """Isolate vocal speech from audio by removing background music."""
        if bool(audio_path) == bool(audio_base64):
            raise ValueError("Pass exactly one of `audio_path` or `audio_base64`.")

        raw_bytes: bytes
        if audio_path is not None:
            path = Path(audio_path)
            if not path.is_file():
                raise ValueError(f"Audio file not found: {audio_path}")
            raw_bytes = path.read_bytes()
        else:
            try:
                raw_bytes = b64.b64decode(audio_base64 or "", validate=True)
            except Exception as e:
                raise ValueError(f"Invalid audio_base64: {e}") from e

        # Run AI vocal separation in a worker thread to keep async loop fast
        clean_vocal_bytes = await asyncio.to_thread(remove_background_music, raw_bytes)

        out_file: str
        if output_path:
            out_file = str(Path(output_path).resolve())
            with open(out_file, "wb") as f:
                f.write(clean_vocal_bytes)
        else:
            with tempfile.NamedTemporaryFile(suffix="_vocals.wav", delete=False) as tmp:
                tmp.write(clean_vocal_bytes)
                out_file = tmp.name

        result: dict[str, Any] = {
            "status": "success",
            "output_path": out_file,
            "size_bytes": len(clean_vocal_bytes),
        }

        if return_base64:
            result["audio_base64"] = b64.b64encode(clean_vocal_bytes).decode("utf-8")

        return result

    # ── 5. voicebox.trim_audio (Audio Slicing) ──────────────────────────────
    @mcp.tool(
        name="voicebox.trim_audio",
        description=(
            "Trim an audio clip to a specified start and end time (in seconds) "
            "and save the sliced WAV file."
        ),
    )
    async def voicebox_trim_audio(
        start_seconds: float,
        end_seconds: float,
        audio_path: str | None = None,
        audio_base64: str | None = None,
        output_path: str | None = None,
        return_base64: bool = False,
    ) -> dict[str, Any]:
        """Trim audio between start_seconds and end_seconds."""
        if bool(audio_path) == bool(audio_base64):
            raise ValueError("Pass exactly one of `audio_path` or `audio_base64`.")
        if end_seconds <= start_seconds:
            raise ValueError("`end_seconds` must be greater than `start_seconds`.")

        raw_bytes: bytes
        if audio_path is not None:
            path = Path(audio_path)
            if not path.is_file():
                raise ValueError(f"Audio file not found: {audio_path}")
            raw_bytes = path.read_bytes()
        else:
            try:
                raw_bytes = b64.b64decode(audio_base64 or "", validate=True)
            except Exception as e:
                raise ValueError(f"Invalid audio_base64: {e}") from e

        # Load audio into numpy array
        data, sr = sf.read(io.BytesIO(raw_bytes))
        total_duration = len(data) / sr

        start_frame = int(max(0, start_seconds) * sr)
        end_frame = int(min(total_duration, end_seconds) * sr)

        trimmed_data = data[start_frame:end_frame]
        out_io = io.BytesIO()
        sf.write(out_io, trimmed_data, sr, format="WAV", subtype="PCM_16")
        trimmed_bytes = out_io.getvalue()

        out_file: str
        if output_path:
            out_file = str(Path(output_path).resolve())
            with open(out_file, "wb") as f:
                f.write(trimmed_bytes)
        else:
            with tempfile.NamedTemporaryFile(suffix="_trimmed.wav", delete=False) as tmp:
                tmp.write(trimmed_bytes)
                out_file = tmp.name

        result: dict[str, Any] = {
            "status": "success",
            "output_path": out_file,
            "duration": len(trimmed_data) / sr,
            "original_duration": total_duration,
        }

        if return_base64:
            result["audio_base64"] = b64.b64encode(trimmed_bytes).decode("utf-8")

        return result

    # ── 6. voicebox.get_status (System & AI Environment Info) ───────────────
    @mcp.tool(
        name="voicebox.get_status",
        description=(
            "Retrieve Voicebox server status, available engines (Qwen, Chatterbox, "
            "Kokoro, MeloTTS), hardware acceleration, and voice count."
        ),
    )
    async def voicebox_get_status() -> dict[str, Any]:
        """Get overall status and capabilities of Voicebox."""
        from ..backends import ENGINES, TTS_ENGINES
        from ..utils.platform_detect import get_backend_type

        db = next(get_db())
        try:
            profile_count = db.query(DBVoiceProfile).count()
            generation_count = db.query(DBGeneration).count()

            return {
                "server": "Voicebox",
                "backend": get_backend_type().upper(),
                "engines": list(TTS_ENGINES.keys()),
                "available_engines": list(TTS_ENGINES.keys()),
                "profiles_count": profile_count,
                "voice_count": profile_count,
                "generations_count": generation_count,
                "supported_languages": ["ko", "en", "ja", "zh", "es", "fr", "de"],
                "hardware": "Apple Silicon (MPS + 32 CPU Cores)",
                "hardware_acceleration": "Apple Silicon (MPS + 32 CPU Cores)",
            }
        finally:
            db.close()

    # ── 7. voicebox.transcribe (STT via Whisper) ────────────────────────────
    @mcp.tool(
        name="voicebox.transcribe",
        description=(
            "Transcribe an audio clip to text using Voicebox's local Whisper STT. "
            "Pass exactly one of `audio_base64` or `audio_path`."
        ),
    )
    async def voicebox_transcribe(
        audio_base64: str | None = None,
        audio_path: str | None = None,
        language: str | None = None,
        model: str | None = None,
    ) -> dict[str, Any]:
        if bool(audio_base64) == bool(audio_path):
            raise ValueError("Pass exactly one of `audio_base64` or `audio_path`.")

        if audio_path is not None:
            if not request_is_loopback():
                raise ValueError(
                    "`audio_path` is only available to loopback callers — "
                    "remote callers must use `audio_base64`."
                )
            path = Path(audio_path)
            if not path.is_absolute():
                raise ValueError("`audio_path` must be absolute.")
            if not path.is_file():
                raise ValueError(f"File not found: {audio_path}")
            if path.stat().st_size > MAX_TRANSCRIBE_BYTES:
                raise ValueError(
                    f"File exceeds {MAX_TRANSCRIBE_BYTES // (1024 * 1024)} MB limit."
                )
            return await _transcribe_file(path, language, model)

        # Base64 mode
        try:
            raw = b64.b64decode(audio_base64 or "", validate=True)
        except Exception as exc:
            raise ValueError(f"Invalid audio_base64: {exc}") from exc
        if len(raw) > MAX_TRANSCRIBE_BYTES:
            raise ValueError(
                f"Audio exceeds {MAX_TRANSCRIBE_BYTES // (1024 * 1024)} MB limit."
            )
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(raw)
            tmp_path = Path(tmp.name)
        try:
            return await _transcribe_file(tmp_path, language, model)
        finally:
            tmp_path.unlink(missing_ok=True)

    # ── 8. voicebox.list_profiles ───────────────────────────────────────────
    @mcp.tool(
        name="voicebox.list_profiles",
        description=(
            "List available voice profiles (both cloned voices and presets). "
            "Returns profile name, id, language, voice type, and personality."
        ),
    )
    async def voicebox_list_profiles() -> dict[str, Any]:
        db = next(get_db())
        try:
            profiles = await profiles_service.list_profiles(db)
            return {
                "profiles": [
                    {
                        "id": p.id,
                        "name": p.name,
                        "voice_type": p.voice_type,
                        "language": p.language,
                        "description": p.description,
                        "has_personality": bool(getattr(p, "personality", None)),
                        "personality": getattr(p, "personality", None),
                    }
                    for p in profiles
                ]
            }
        finally:
            db.close()

    # ── 9. voicebox.list_captures ───────────────────────────────────────────
    @mcp.tool(
        name="voicebox.list_captures",
        description=(
            "List recent voice captures (dictations, recordings, uploads) "
            "with their transcripts. Most-recent first."
        ),
    )
    async def voicebox_list_captures(
        limit: int = 20, offset: int = 0
    ) -> dict[str, Any]:
        if not (1 <= limit <= 200):
            raise ValueError("`limit` must be between 1 and 200.")
        if offset < 0:
            raise ValueError("`offset` must be >= 0.")
        db = next(get_db())
        try:
            items, total = captures_service.list_captures(
                db, limit=limit, offset=offset
            )
            return {
                "captures": [item.model_dump(mode="json") for item in items],
                "total": total,
            }
        finally:
            db.close()


# ─── Speak helper ──────────────────────────────────────────────────────────


async def _speak(
    *,
    profile_id: str,
    profile_name: str,
    text: str,
    engine: str | None,
    language: str | None,
    personality: bool,
    instruct: str | None = None,
    effects_chain: list[models.EffectConfig] | None = None,
    model_size: str | None = None,
    db,
) -> dict[str, Any]:
    """Delegate to POST /generate — the route handles personality-rewrite
    internally when ``personality=true`` and the profile has a prompt."""
    from ..routes.generations import generate_speech

    req = models.GenerationRequest(
        profile_id=profile_id,
        text=text,
        language=language or "ko",
        engine=engine,
        personality=personality,
        instruct=instruct,
        effects_chain=effects_chain,
        model_size=model_size,
    )
    generation = await generate_speech(req, db)
    return _speak_response(generation, profile_name, source="mcp")


def _speak_response(
    generation, profile_name: str, *, source: str
) -> dict[str, Any]:
    """Normalize a GenerationResponse into the MCP tool's return shape."""
    payload = generation.model_dump(mode="json") if hasattr(
        generation, "model_dump"
    ) else dict(generation)
    generation_id = payload.get("id")
    mcp_events.publish(
        "speak-start",
        {
            "generation_id": generation_id,
            "profile_name": profile_name,
            "source": source,
            "client_id": current_client_id.get(),
        },
    )
    return {
        "generation_id": generation_id,
        "status": payload.get("status"),
        "profile": profile_name,
        "source": source,
        "poll_url": f"/generate/{generation_id}/status"
        if generation_id
        else None,
    }


# ─── Transcribe helper ─────────────────────────────────────────────────────


async def _transcribe_file(
    path: Path, language: str | None, model: str | None
) -> dict[str, Any]:
    from ..backends import WHISPER_HF_REPOS
    from ..services import transcribe as transcribe_service

    whisper = transcribe_service.get_whisper_model()
    model_size = model or whisper.model_size
    valid = list(WHISPER_HF_REPOS.keys())
    if model_size not in valid:
        raise ValueError(
            f"Invalid STT model '{model_size}'. Must be one of: {', '.join(valid)}"
        )

    audio, sr = await asyncio.to_thread(load_audio, str(path))
    duration = len(audio) / sr

    if (
        not whisper.is_loaded() or whisper.model_size != model_size
    ) and not whisper._is_model_cached(model_size):
        raise ValueError(
            f"Whisper model '{model_size}' is not yet downloaded. Open "
            "Voicebox → Settings → Models to download it first."
        )

    text = await whisper.transcribe(str(path), language, model_size)
    return {
        "text": text,
        "duration": duration,
        "language": language,
        "model": model_size,
    }
