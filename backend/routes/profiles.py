"""Voice profile endpoints."""

import io
import json as _json
import logging
import tempfile
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from .. import config, models
from ..app import safe_content_disposition
from ..database import VoiceProfile as DBVoiceProfile, get_db
from ..services import channels, export_import, personality, profiles
from ..services.profiles import _profile_to_response

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/profiles", response_model=models.VoiceProfileResponse)
async def create_profile(
    data: models.VoiceProfileCreate,
    db: Session = Depends(get_db),
):
    """Create a new voice profile."""
    try:
        return await profiles.create_profile(data, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/profiles", response_model=list[models.VoiceProfileResponse])
async def list_profiles(db: Session = Depends(get_db)):
    """List all voice profiles."""
    return await profiles.list_profiles(db)


@router.post("/profiles/import", response_model=models.VoiceProfileResponse)
async def import_profile(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Import a voice profile from a ZIP archive."""
    MAX_FILE_SIZE = 100 * 1024 * 1024

    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, detail=f"File too large. Maximum size is {MAX_FILE_SIZE / (1024 * 1024)}MB"
        )

    try:
        profile = await export_import.import_profile_from_zip(content, db)
        return profile
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Preset Voice Endpoints ───────────────────────────────────────────
# These MUST be declared before /profiles/{profile_id} to avoid the
# wildcard swallowing "presets" as a profile_id.


@router.get("/profiles/presets/{engine}")
async def list_preset_voices(engine: str):
    """List available preset voices for an engine."""
    if engine == "kokoro":
        from ..backends.kokoro_backend import KOKORO_VOICES

        return {
            "engine": engine,
            "voices": [
                {
                    "voice_id": vid,
                    "name": name,
                    "gender": gender,
                    "language": lang,
                }
                for vid, name, gender, lang in KOKORO_VOICES
            ],
        }
    if engine == "qwen_custom_voice":
        from ..backends.qwen_custom_voice_backend import QWEN_CUSTOM_VOICES

        return {
            "engine": engine,
            "voices": [
                {
                    "voice_id": speaker_id,
                    "name": display_name,
                    "gender": gender,
                    "language": lang,
                }
                for speaker_id, display_name, gender, lang, _desc in QWEN_CUSTOM_VOICES
            ],
        }
    if engine == "melotts":
        return {
            "engine": engine,
            "voices": [
                {
                    "voice_id": "KR",
                    "name": "민지 (Korean Female)",
                    "gender": "female",
                    "language": "ko",
                }
            ],
        }
    return {"engine": engine, "voices": []}


@router.get("/profiles/presets/{engine}/{voice_id}/preview")
async def get_preset_voice_preview(engine: str, voice_id: str):
    """Generate and return a short preview audio clip for a preset voice."""
    from ..backends import get_tts_backend_for_engine
    from ..utils.audio import save_audio
    from .. import config

    cache_dir = config.get_data_dir() / "cache" / "preset_previews"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"{engine}_{voice_id}.wav"

    if cache_file.exists() and cache_file.stat().st_size > 0:
        return FileResponse(str(cache_file), media_type="audio/wav")

    preview_text = "Hello! This is a preview of this voice."
    language = "en"

    if engine == "kokoro":
        prefix = voice_id[:2].lower() if len(voice_id) >= 2 else ""
        if prefix.startswith("j"):
            preview_text = "こんにちは！これはサンプルの音声です。"
            language = "ja"
        elif prefix.startswith("z"):
            preview_text = "你好！这是该声音的预览。"
            language = "zh"
        elif prefix.startswith("e"):
            preview_text = "¡Hola! Esta es una vista previa de esta voz."
            language = "es"
        elif prefix.startswith("f"):
            preview_text = "Bonjour! Ceci est un aperçu de cette voix."
            language = "fr"
        elif prefix.startswith("h"):
            preview_text = "नमस्ते! यह इस आवाज़ का नमूना है।"
            language = "hi"
        elif prefix.startswith("i"):
            preview_text = "Ciao! Questa è un'anteprima di questa voce."
            language = "it"
        elif prefix.startswith("p"):
            preview_text = "Olá! Esta é uma prévia desta voz."
            language = "pt"
        else:
            preview_text = "Hello! This is a preview of this voice."
            language = "en"

    elif engine == "qwen_custom_voice":
        from ..backends.qwen_custom_voice_backend import QWEN_CUSTOM_VOICES

        voice_entry = next((v for v in QWEN_CUSTOM_VOICES if v[0] == voice_id), None)
        if voice_entry:
            lang = voice_entry[3]
            language = lang
            if lang == "ko":
                preview_text = "안녕하세요! 반갑습니다. 만나서 반가워요."
            elif lang == "ja":
                preview_text = "こんにちは！これはサンプルの音声です。"
            elif lang == "zh":
                preview_text = "你好！这是该声音的预览。"
            elif lang == "de":
                preview_text = "Hallo! Dies ist eine Vorschau dieser Stimme."
            elif lang == "fr":
                preview_text = "Bonjour! Ceci est un aperçu de cette voix."
            elif lang == "es":
                preview_text = "¡Hola! Esta es una vista previa de esta voz."
            elif lang == "it":
                preview_text = "Ciao! Questa è un'anteprima di questa voce."
            elif lang == "pt":
                preview_text = "Olá! Esta é uma prévia desta voz."
            elif lang == "ru":
                preview_text = "Здравствуйте! Это предварительный просмотр голоса."
            else:
                preview_text = "Hello! This is a preview of this voice."
        else:
            preview_text = "Hello! This is a preview of this voice."

    elif engine == "melotts":
        language = "ko"
        preview_text = "안녕하세요! MeloTTS 한국어 미리듣기 음성입니다."

    backend = get_tts_backend_for_engine(engine)
    voice_prompt = {
        "voice_type": "preset",
        "preset_engine": engine,
        "preset_voice_id": voice_id,
    }

    try:
        audio, sample_rate = await backend.generate(
            text=preview_text,
            voice_prompt=voice_prompt,
            language=language,
        )
        save_audio(audio, str(cache_file), sample_rate=sample_rate)
        return FileResponse(str(cache_file), media_type="audio/wav")
    except Exception as e:
        logger.error(f"Failed to generate preset preview for {engine}/{voice_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {e}")

@router.get("/profiles/{profile_id}/preview")
async def get_profile_preview(
    profile_id: str,
    db: Session = Depends(get_db),
):
    """Generate and return a short preview audio clip with a personalized greeting."""
    from ..backends import get_tts_backend_for_engine
    from ..utils.audio import save_audio
    from .. import config

    profile = await profiles.get_profile(profile_id, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    cache_dir = config.get_data_dir() / "cache" / "profile_previews"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f"{profile_id}.wav"

    if cache_file.exists() and cache_file.stat().st_size > 0:
        return FileResponse(str(cache_file), media_type="audio/wav")

    lang = profile.language or "en"
    if lang == "ko":
        preview_text = f"안녕하세요! 저는 {profile.name}입니다. 만나서 반가워요."
    elif lang == "ja":
        preview_text = f"こんにちは！私は {profile.name} です。よろしくお願いします。"
    elif lang == "zh":
        preview_text = f"你好！我是 {profile.name}。很高兴见到你。"
    elif lang == "es":
        preview_text = f"¡Hola! Soy {profile.name}. ¡Encantado de conocerte!"
    elif lang == "fr":
        preview_text = f"Bonjour! Je suis {profile.name}. Ravi de vous rencontrer!"
    else:
        preview_text = f"Hello! I'm {profile.name}. Nice to meet you."

    engine = getattr(profile, "default_engine", None) or getattr(profile, "preset_engine", None) or "qwen"
    backend = get_tts_backend_for_engine(engine)
    voice_prompt = await profiles.create_voice_prompt_for_profile(profile_id, db)

    try:
        audio, sample_rate = await backend.generate(
            text=preview_text,
            voice_prompt=voice_prompt,
            language=lang,
        )
        save_audio(audio, str(cache_file), sample_rate=sample_rate)
        return FileResponse(str(cache_file), media_type="audio/wav")
    except Exception as e:
        logger.error(f"Failed to generate profile preview for {profile_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {e}")

@router.get("/profiles/{profile_id}", response_model=models.VoiceProfileResponse)
async def get_profile(
    profile_id: str,
    db: Session = Depends(get_db),
):
    """Get a voice profile by ID."""
    profile = await profiles.get_profile(profile_id, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.put("/profiles/{profile_id}", response_model=models.VoiceProfileResponse)
async def update_profile(
    profile_id: str,
    data: models.VoiceProfileCreate,
    db: Session = Depends(get_db),
):
    """Update a voice profile."""
    try:
        profile = await profiles.update_profile(profile_id, data, db)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        return profile
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/profiles/{profile_id}")
async def delete_profile(
    profile_id: str,
    db: Session = Depends(get_db),
):
    """Delete a voice profile."""
    success = await profiles.delete_profile(profile_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"message": "Profile deleted successfully"}


SAMPLE_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
SAMPLE_UPLOAD_CHUNK_SIZE = 1024 * 1024  # 1 MB


@router.post("/profiles/{profile_id}/samples", response_model=models.ProfileSampleResponse)
async def add_profile_sample(
    profile_id: str,
    file: UploadFile = File(...),
    reference_text: str = Form(...),
    db: Session = Depends(get_db),
):
    """Add a sample to a voice profile."""
    _allowed_audio_exts = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac", ".webm", ".opus"}
    _uploaded_ext = Path(file.filename or "").suffix.lower()
    file_suffix = _uploaded_ext if _uploaded_ext in _allowed_audio_exts else ".wav"

    with tempfile.NamedTemporaryFile(suffix=file_suffix, delete=False) as tmp:
        total_size = 0
        while chunk := await file.read(SAMPLE_UPLOAD_CHUNK_SIZE):
            total_size += len(chunk)
            if total_size > SAMPLE_MAX_FILE_SIZE:
                Path(tmp.name).unlink(missing_ok=True)
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large (max {SAMPLE_MAX_FILE_SIZE // (1024 * 1024)} MB)",
                )
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        sample = await profiles.add_profile_sample(
            profile_id,
            tmp_path,
            reference_text,
            db,
        )
        return sample
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process audio file: {str(e)}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@router.get("/profiles/{profile_id}/samples", response_model=list[models.ProfileSampleResponse])
async def get_profile_samples(
    profile_id: str,
    db: Session = Depends(get_db),
):
    """Get all samples for a profile."""
    return await profiles.get_profile_samples(profile_id, db)


@router.delete("/profiles/samples/{sample_id}")
async def delete_profile_sample(
    sample_id: str,
    db: Session = Depends(get_db),
):
    """Delete a profile sample."""
    success = await profiles.delete_profile_sample(sample_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Sample not found")
    return {"message": "Sample deleted successfully"}


@router.put("/profiles/samples/{sample_id}", response_model=models.ProfileSampleResponse)
async def update_profile_sample(
    sample_id: str,
    data: models.ProfileSampleUpdate,
    db: Session = Depends(get_db),
):
    """Update a profile sample's reference text."""
    sample = await profiles.update_profile_sample(sample_id, data.reference_text, db)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    return sample


@router.post("/profiles/{profile_id}/avatar", response_model=models.VoiceProfileResponse)
async def upload_profile_avatar(
    profile_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload or update avatar image for a profile."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename or "").suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        profile = await profiles.upload_avatar(profile_id, tmp_path, db)
        return profile
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@router.get("/profiles/{profile_id}/avatar")
async def get_profile_avatar(
    profile_id: str,
    db: Session = Depends(get_db),
):
    """Get avatar image for a profile."""
    profile = await profiles.get_profile(profile_id, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if not profile.avatar_path:
        raise HTTPException(status_code=404, detail="No avatar found for this profile")

    avatar_path = config.resolve_storage_path(profile.avatar_path)
    if avatar_path is None or not avatar_path.exists():
        raise HTTPException(status_code=404, detail="Avatar file not found")

    return FileResponse(avatar_path)


@router.delete("/profiles/{profile_id}/avatar")
async def delete_profile_avatar(
    profile_id: str,
    db: Session = Depends(get_db),
):
    """Delete avatar image for a profile."""
    success = await profiles.delete_avatar(profile_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found or no avatar to delete")
    return {"message": "Avatar deleted successfully"}


@router.get("/profiles/{profile_id}/export")
async def export_profile(
    profile_id: str,
    db: Session = Depends(get_db),
):
    """Export a voice profile as a ZIP archive."""
    try:
        profile = await profiles.get_profile(profile_id, db)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        zip_bytes = export_import.export_profile_to_zip(profile_id, db)

        safe_name = "".join(c for c in profile.name if c.isalnum() or c in (" ", "-", "_")).strip()
        if not safe_name:
            safe_name = "profile"
        filename = f"profile-{safe_name}.voicebox.zip"

        return StreamingResponse(
            io.BytesIO(zip_bytes),
            media_type="application/zip",
            headers={"Content-Disposition": safe_content_disposition("attachment", filename)},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profiles/{profile_id}/channels")
async def get_profile_channels(
    profile_id: str,
    db: Session = Depends(get_db),
):
    """Get list of channel IDs assigned to a profile."""
    try:
        channel_ids = await channels.get_profile_channels(profile_id, db)
        return {"channel_ids": channel_ids}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/profiles/{profile_id}/channels")
async def set_profile_channels(
    profile_id: str,
    data: models.ProfileChannelAssignment,
    db: Session = Depends(get_db),
):
    """Set which channels a profile is assigned to."""
    try:
        await channels.set_profile_channels(profile_id, data, db)
        return {"message": "Profile channels updated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/profiles/{profile_id}/effects", response_model=models.VoiceProfileResponse)
async def update_profile_effects(
    profile_id: str,
    data: models.ProfileEffectsUpdate,
    db: Session = Depends(get_db),
):
    """Set or clear the default effects chain for a voice profile."""
    profile = db.query(DBVoiceProfile).filter_by(id=profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if data.effects_chain is not None:
        from ..utils.effects import validate_effects_chain

        chain_dicts = [e.model_dump() for e in data.effects_chain]
        error = validate_effects_chain(chain_dicts)
        if error:
            raise HTTPException(status_code=400, detail=error)
        profile.effects_chain = _json.dumps(chain_dicts)
    else:
        profile.effects_chain = None

    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)

    return _profile_to_response(profile)


# ── Personality endpoint ──────────────────────────────────────────────
# Only ``/profiles/{id}/compose`` remains — the UI's compose button
# produces a fresh in-character utterance the user can edit before
# speaking. Rewrite now happens inside ``/generate`` (and ``/speak``)
# when ``personality=true``; there is no standalone rewrite/respond/speak
# endpoint.


@router.post(
    "/profiles/{profile_id}/compose",
    response_model=models.PersonalityTextResponse,
)
async def compose_in_character(
    profile_id: str,
    db: Session = Depends(get_db),
):
    """Produce a fresh utterance in the profile's character voice."""
    profile = db.query(DBVoiceProfile).filter_by(id=profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    try:
        result = await personality.compose_as_profile(profile.personality)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return models.PersonalityTextResponse(
        text=result.text, model_size=result.model_size
    )
