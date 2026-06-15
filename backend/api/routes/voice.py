from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status
from loguru import logger
import httpx
import os
from dotenv import load_dotenv

from api.middleware.auth_guard import get_current_user

load_dotenv()

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")

router = APIRouter(prefix="/api/voice", tags=["Voice"])


# ── POST /api/voice/transcribe ─────────────────────────────────────
@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Transcribes audio to text using Sarvam ASR.
    Accepts WAV, MP3, M4A, WebM audio files.
    Returns transcribed text ready for brief input.
    """
    try:
        audio_content = await file.read()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sarvam.ai/speech-to-text",
                headers={
                    "api-subscription-key": SARVAM_API_KEY,
                },
                files={
                    "file": (file.filename, audio_content, file.content_type),
                },
                data={
                    "language_code": "unknown",
                    "model": "saaras:v2",
                    "with_timestamps": "false",
                    "with_diarization": "false",
                },
                timeout=30.0,
            )

            if response.status_code != 200:
                logger.error(f"Sarvam ASR error: {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Transcription failed. Please try again.",
                )

            data = response.json()
            transcript = data.get("transcript", "")

            logger.info(
                f"Transcription complete | "
                f"Length: {len(transcript)} chars | "
                f"User: {current_user['email']}"
            )

            return {"transcript": transcript}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )