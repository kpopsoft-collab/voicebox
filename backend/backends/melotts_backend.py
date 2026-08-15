"""
MeloTTS backend implementation for Korean and multilingual speech synthesis.
"""

import asyncio
import logging
from typing import ClassVar, List, Optional, Tuple
import numpy as np

from . import TTSBackend, ModelConfig
from .base import (
    is_model_cached,
    get_torch_device,
    model_load_progress,
)

logger = logging.getLogger(__name__)

MELOTTS_HF_REPO = "myshell-ai/MeloTTS-Korean"


class MeloTTSBackend:
    """MeloTTS backend for crisp, clear Korean TTS."""

    MODEL_CONFIGS: ClassVar[list[ModelConfig]] = [
        ModelConfig(
            model_name="melotts",
            display_name="MeloTTS (Korean, Clear Pronunciation)",
            engine="melotts",
            hf_repo_id=MELOTTS_HF_REPO,
            size_mb=450,
            languages=["ko"],
        ),
    ]

    def __init__(self):
        self.model = None
        self.model_size = "default"
        self.device = self._get_device()
        self._current_language = "KR"

    def _get_device(self) -> str:
        return get_torch_device(allow_mps=False, allow_xpu=True)

    def is_loaded(self) -> bool:
        return self.model is not None

    def _get_model_path(self, model_size: str = "default") -> str:
        return MELOTTS_HF_REPO

    def _is_model_cached(self, model_size: str = "default") -> bool:
        return True

    async def load_model(self, model_size: str = "default") -> None:
        if self.model is not None:
            return
        await asyncio.to_thread(self._load_model_sync)

    def _load_model_sync(self):
        model_name = "melotts"
        with model_load_progress(model_name, True):
            from melo.api import TTS
            logger.info("Loading MeloTTS Korean on %s...", self.device)
            self.model = TTS(language="KR", device=self.device)
            logger.info("MeloTTS Korean loaded successfully")

    def unload_model(self) -> None:
        if self.model is not None:
            del self.model
            self.model = None
            logger.info("MeloTTS unloaded")

    async def create_voice_prompt(
        self,
        audio_path: str,
        reference_text: str,
        use_cache: bool = True,
    ) -> Tuple[dict, bool]:
        return {
            "voice_type": "preset",
            "preset_engine": "melotts",
            "preset_voice_id": "KR",
        }, False

    async def combine_voice_prompts(
        self,
        audio_paths: List[str],
        reference_texts: List[str],
    ) -> Tuple[np.ndarray, str]:
        return np.array([], dtype=np.float32), ""

    async def generate(
        self,
        text: str,
        voice_prompt: dict,
        language: str = "ko",
        seed: Optional[int] = None,
        instruct: Optional[str] = None,
    ) -> Tuple[np.ndarray, int]:
        await self.load_model()

        def _generate_sync():
            import torch
            if seed is not None:
                torch.manual_seed(seed)

            speaker_ids = self.model.hps.data.spk2id
            if hasattr(speaker_ids, "KR"):
                spk_id = getattr(speaker_ids, "KR")
            elif hasattr(speaker_ids, "__getitem__"):
                spk_id = speaker_ids["KR"]
            else:
                spk_id = 0
            sample_rate = self.model.hps.data.sampling_rate

            # tts_to_file with output_path=None returns the raw numpy array
            audio_array = self.model.tts_to_file(
                text=text,
                speaker_id=spk_id,
                output_path=None,
                speed=1.0,
            )
            # Normalize to 1D float32
            audio_array = np.asarray(audio_array, dtype=np.float32)
            if audio_array.ndim > 1:
                audio_array = audio_array.squeeze()

            return audio_array, sample_rate

        return await asyncio.to_thread(_generate_sync)
