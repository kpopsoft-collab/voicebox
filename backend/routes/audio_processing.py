import logging
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from backend.services.vocal_separator import remove_background_music

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audio", tags=["audio"])


@router.post("/remove-bgm")
async def remove_bgm_endpoint(file: UploadFile = File(...)):
    """
    Separate and remove background music / instruments from an uploaded audio file.
    Returns clean vocal audio in WAV format.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty audio file provided")

        logger.info(f"Received request to remove BGM from file: {file.filename} ({len(content)} bytes)")
        clean_vocal_bytes = remove_background_music(content)

        return Response(
            content=clean_vocal_bytes,
            media_type="audio/wav",
            headers={
                "Content-Disposition": f'attachment; filename="vocals_{file.filename}.wav"',
            },
        )
    except Exception as e:
        logger.exception("Failed to remove background music from audio")
        raise HTTPException(status_code=500, detail=f"Vocal separation failed: {str(e)}")
