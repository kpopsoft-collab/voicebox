"""Generation history endpoints."""

import io
import logging

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from .. import config, models
from ..services import export_import, history
from ..app import safe_content_disposition
from ..database import Generation as DBGeneration, VoiceProfile as DBVoiceProfile, get_db

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/history", response_model=models.HistoryListResponse)
async def list_history(
    profile_id: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """List generation history with optional filters."""
    query = models.HistoryQuery(
        profile_id=profile_id,
        search=search,
        limit=limit,
        offset=offset,
    )
    return await history.list_generations(query, db)


@router.get("/history/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get generation statistics."""
    return await history.get_generation_stats(db)


@router.post("/history/import")
async def import_generation(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Import a generation from a ZIP archive."""
    MAX_FILE_SIZE = 50 * 1024 * 1024

    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, detail=f"File too large. Maximum size is {MAX_FILE_SIZE / (1024 * 1024)}MB"
        )

    try:
        result = await export_import.import_generation_from_zip(content, db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/history/failed")
async def clear_failed_generations(db: Session = Depends(get_db)):
    """Delete every generation with status='failed'. Used by the UI's 'Clear failed' button (#410)."""
    count = await history.delete_failed_generations(db)
    return {"deleted": count}


@router.get("/history/{generation_id}", response_model=models.HistoryResponse)
async def get_generation(
    generation_id: str,
    db: Session = Depends(get_db),
):
    """Get a generation by ID."""
    result = (
        db.query(DBGeneration, DBVoiceProfile.name.label("profile_name"))
        .join(DBVoiceProfile, DBGeneration.profile_id == DBVoiceProfile.id)
        .filter(DBGeneration.id == generation_id)
        .first()
    )

    if not result:
        raise HTTPException(status_code=404, detail="Generation not found")

    gen, profile_name = result
    return models.HistoryResponse(
        id=gen.id,
        profile_id=gen.profile_id,
        profile_name=profile_name,
        text=gen.text,
        language=gen.language,
        audio_path=gen.audio_path,
        duration=gen.duration,
        seed=gen.seed,
        instruct=gen.instruct,
        engine=gen.engine or "qwen",
        model_size=gen.model_size,
        status=gen.status or "completed",
        error=gen.error,
        is_favorited=bool(gen.is_favorited),
        created_at=gen.created_at,
    )


@router.post("/history/{generation_id}/favorite")
async def toggle_favorite(
    generation_id: str,
    db: Session = Depends(get_db),
):
    """Toggle the favorite status of a generation."""
    gen = db.query(DBGeneration).filter_by(id=generation_id).first()
    if not gen:
        raise HTTPException(status_code=404, detail="Generation not found")
    gen.is_favorited = not gen.is_favorited
    db.commit()
    return {"is_favorited": gen.is_favorited}


@router.delete("/history/{generation_id}")
async def delete_generation(
    generation_id: str,
    db: Session = Depends(get_db),
):
    """Delete a generation."""
    success = await history.delete_generation(generation_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Generation not found")
    return {"message": "Generation deleted successfully"}


@router.get("/history/{generation_id}/export")
async def export_generation(
    generation_id: str,
    db: Session = Depends(get_db),
):
    """Export a generation as a ZIP archive."""
    generation = db.query(DBGeneration).filter_by(id=generation_id).first()
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")

    try:
        zip_bytes = export_import.export_generation_to_zip(generation_id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    profile = db.query(DBVoiceProfile).filter_by(id=generation.profile_id).first()
    profile_name = profile.name if profile else "voice"
    safe_profile = "".join(c for c in profile_name if c not in r'/\:*?"<>|').strip().replace(" ", "_") or "voice"

    created_time = generation.created_at
    if created_time:
        time_str = created_time.strftime("%Y%m%d_%H%M%S")
    else:
        from datetime import datetime
        time_str = datetime.now().strftime("%Y%m%d_%H%M%S")

    filename = f"{safe_profile}_{time_str}.voicebox.zip"

    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": safe_content_disposition("attachment", filename)},
    )


@router.get("/history/{generation_id}/export-audio")
async def export_generation_audio(
    generation_id: str,
    format: str = "wav",
    db: Session = Depends(get_db),
):
    """Export only the audio file from a generation in WAV or MP3 format."""
    generation = db.query(DBGeneration).filter_by(id=generation_id).first()
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")

    if not generation.audio_path:
        raise HTTPException(status_code=404, detail="Generation has no audio file")

    audio_path = config.resolve_storage_path(generation.audio_path)
    if audio_path is None or not audio_path.is_file():
        raise HTTPException(status_code=404, detail="Audio file not found")

    # Build filename: "음성프로필_시간.ext"
    profile = db.query(DBVoiceProfile).filter_by(id=generation.profile_id).first()
    profile_name = profile.name if profile else "voice"
    safe_profile = "".join(c for c in profile_name if c not in r'/\:*?"<>|').strip().replace(" ", "_") or "voice"

    created_time = generation.created_at
    if created_time:
        time_str = created_time.strftime("%Y%m%d_%H%M%S")
    else:
        from datetime import datetime
        time_str = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Support MP3 conversion
    if format.lower() == "mp3":
        try:
            import soundfile as sf
            data, sr = sf.read(str(audio_path), dtype="float32")
            mp3_io = io.BytesIO()
            sf.write(mp3_io, data, sr, format="MP3")
            mp3_bytes = mp3_io.getvalue()
        except Exception as e:
            # Fallback using pydub if soundfile lacks MP3 backend on certain systems
            try:
                from pydub import AudioSegment
                seg = AudioSegment.from_file(str(audio_path))
                mp3_io = io.BytesIO()
                seg.export(mp3_io, format="mp3", bitrate="320k")
                mp3_bytes = mp3_io.getvalue()
            except Exception as inner_e:
                logger.error(f"Failed to convert WAV to MP3: {e}, fallback error: {inner_e}")
                raise HTTPException(status_code=500, detail=f"MP3 conversion failed: {e}")

        filename = f"{safe_profile}_{time_str}.mp3"
        return Response(
            content=mp3_bytes,
            media_type="audio/mpeg",
            headers={"Content-Disposition": safe_content_disposition("attachment", filename)},
        )

    # Default WAV export
    filename = f"{safe_profile}_{time_str}.wav"
    return FileResponse(
        audio_path,
        media_type="audio/wav",
        headers={"Content-Disposition": safe_content_disposition("attachment", filename)},
    )
