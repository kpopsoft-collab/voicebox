import asyncio
import logging
import torch
import numpy as np
from typing import Optional, Tuple, Dict, Any
from . import TTSBackend
from .base import get_torch_device, model_load_progress, is_model_cached, manual_seed

logger = logging.getLogger(__name__)


# Default SFX duration in seconds. Stable Audio 3 clips longer generations with
# silence / codec noise; 10s is the natural upper bound for the small-sfx model.
DEFAULT_SFX_DURATION_SEC = 10.0

# Stable Audio 3 internally calls these model names. We resolve them at import
# time so monkey-patches happen exactly once (not per load_model call).
_STABLE_AUDIO_REPO_OVERRIDES = {
    "small-sfx": "cocktailpeanut/stable-audio-3-small-sfx",
}


def _apply_repo_overrides() -> None:
    """Replace gated upstream repo IDs with ungated mirrors.

    Called once at import time (NOT inside load_model) to avoid mutating global
    state during concurrent first-loads. Concurrent loads would otherwise race
    when monkey-patching `stable_audio_3.model_configs.all_models`.
    """
    try:
        import dataclasses
        from stable_audio_3.model_configs import all_models
    except ImportError:
        # Package not installed — leave defaults; load_model will surface a
        # clearer error later.
        logger.debug("stable_audio_3 not importable; skipping repo overrides")
        return

    for short_name, repo_id in _STABLE_AUDIO_REPO_OVERRIDES.items():
        if short_name in all_models:
            all_models[short_name] = dataclasses.replace(
                all_models[short_name],
                repo_id=repo_id,
            )


_apply_repo_overrides()


class StableAudio3Backend(TTSBackend):
    """Stable Audio 3 small-sfx backend for SFX generation.

    Stable Audio 3 does NOT support voice cloning — it generates sound effects
    from a text prompt. Voice prompts are returned as a preset stub so the
    profile system continues to work; the prompt content is the meaningful
    input at generate() time.
    """

    def __init__(self):
        self.model = None
        self.device = get_torch_device()

    async def load_model(self, model_size: str = "default") -> None:
        if self.model is not None:
            return

        def _load():
            # One canonical HF repo id; the import-time override above already
            # redirected `small-sfx` to the ungated mirror, so
            # StableAudioModel.from_pretrained("small-sfx") will resolve it.
            repo_id = _STABLE_AUDIO_REPO_OVERRIDES["small-sfx"]
            is_cached = is_model_cached(repo_id)

            with model_load_progress("stable-audio-3-small-sfx", is_cached):
                from stable_audio_3.model import StableAudioModel

                self.model = StableAudioModel.from_pretrained(
                    "small-sfx",
                    device=self.device,
                )

            self._cleanup_incomplete_blobs(repo_id)

        await asyncio.to_thread(_load)

    @staticmethod
    def _cleanup_incomplete_blobs(repo_id: str) -> None:
        """Remove leftover .incomplete blob files for a HF repo cache.

        Without this, `is_model_cached()` can return False even though the main
        weights are fully present, because sub-model downloads (SAME-S autoencoder)
        leave .incomplete files behind that poison the cache check. Best-effort —
        if anything goes wrong here we log and continue.
        """
        try:
            from pathlib import Path
            from huggingface_hub import constants as hf_constants

            repo_cache = Path(hf_constants.HF_HUB_CACHE) / (
                "models--" + repo_id.replace("/", "--")
            )
            blobs_dir = repo_cache / "blobs"
            if blobs_dir.exists():
                for f in blobs_dir.glob("*.incomplete"):
                    f.unlink(missing_ok=True)
        except Exception as e:
            logger.debug(
                "_cleanup_incomplete_blobs skipped for %s: %s",
                repo_id,
                e,
            )

    async def create_voice_prompt(
        self,
        audio_path: str,
        reference_text: str,
        use_cache: bool = True,
    ) -> Tuple[Dict[str, Any], bool]:
        # Stable Audio 3 has no voice-cloning concept. Return a preset stub that
        # matches the schema `_get_preset_voice_ids` validators expect:
        # {"voice_type": "preset", "preset_engine": ..., "preset_voice_id": ...}.
        # The dict's `preset_voice_id` is the only SFX identifier we ship today.
        return (
            {
                "voice_type": "preset",
                "preset_engine": "stable_audio_3",
                "preset_voice_id": "sfx",
            },
            False,
        )

    async def combine_voice_prompts(
        self,
        audio_paths: list[str],
        ref_texts: list[str],
    ) -> Tuple[np.ndarray, str]:
        raise NotImplementedError("Voice combination not supported for Stable Audio 3")

    async def generate(
        self,
        text: str,
        voice_prompt: Dict[str, Any],
        language: str = "en",
        seed: Optional[int] = None,
        instruct: Optional[str] = None,
    ) -> Tuple[np.ndarray, int]:
        if self.model is None:
            raise RuntimeError("Stable Audio 3 model not loaded")

        def _generate() -> Tuple[np.ndarray, int]:
            if seed is not None:
                # Use the shared helper so CUDA / MPS / XPU seeds stay consistent
                # with the other backends (MPS env reproducible on Apple Silicon).
                manual_seed(seed, self.device)

            # NOTE: `instruct` is accepted for protocol parity but SFX models
            # have no instruct channel. Folded into the prompt only when
            # non-empty so users can pass style hints ("cinematic", "8-bit").
            if instruct:
                prompt = f"{instruct}. {text}"
            else:
                prompt = text

            # StableAudioModel.generate signature:
            # (prompt, negative_prompt, duration, steps, cfg_scale, batch_size)
            result = self.model.generate(
                prompt=prompt,
                duration=DEFAULT_SFX_DURATION_SEC,
                steps=20,
                cfg_scale=7.0,
            )

            # Result layout (per upstream `StableAudioModel`):
            #   3D: (batch=1, channels, samples)  — typical output
            #   2D: (channels, samples)
            #   1D: (samples,)  — mono flatten
            # We always return (samples,) or (channels, samples) for downstream
            # MP3 encoders. Transpose last 2 dims so channels come first.
            arr = result.detach().cpu().numpy()
            if arr.ndim == 3:
                arr = arr[0]  # drop batch
            if arr.ndim == 2 and arr.shape[0] > arr.shape[1]:
                arr = arr.T
            return arr, self.model.sample_rate

        return await asyncio.to_thread(_generate)

    def unload_model(self) -> None:
        if self.model is not None:
            del self.model
            self.model = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    def is_loaded(self) -> bool:
        return self.model is not None

    def _get_model_path(self, model_size: str) -> str:
        # Stable Audio 3 currently ships only one model size; anything else is
        # accepted for protocol parity but resolves to the same path.
        return "stable-audio-3-small-sfx"
