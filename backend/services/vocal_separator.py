import io
import logging
import torch
import torchaudio
import soundfile as sf
from demucs.apply import apply_model
from demucs.pretrained import get_model
from demucs.audio import convert_audio

logger = logging.getLogger(__name__)

_demucs_model = None

def get_vocal_separator_model():
    """Lazy-load the Demucs htdemucs model on demand."""
    global _demucs_model
    if _demucs_model is None:
        logger.info("Loading Demucs htdemucs model for vocal isolation...")
        _demucs_model = get_model('htdemucs')
        _demucs_model.eval()
        logger.info("Demucs htdemucs model loaded successfully.")
    return _demucs_model

def remove_background_music(audio_bytes: bytes, target_sr: int = 44100) -> bytes:
    """
    Remove background music, beats, and instruments from the input audio bytes,
    leaving only clean vocal speech.
    
    Returns:
        WAV audio bytes containing only isolated vocals.
    """
    model = get_vocal_separator_model()
    
    # Apple Silicon M3 Ultra handles 32-thread CPU inference extremely fast and reliably
    device = "cpu"
    model.to(device)
    
    # Load input audio bytes with torchaudio or soundfile
    try:
        wav, sr = torchaudio.load(io.BytesIO(audio_bytes))
    except Exception:
        # Fallback to soundfile if torchaudio load fails on some formats
        data, sr = sf.read(io.BytesIO(audio_bytes), dtype='float32')
        wav = torch.from_numpy(data)
        if wav.dim() == 1:
            wav = wav.unsqueeze(0)
        else:
            wav = wav.t()

    # Convert audio to model expected sample rate and stereo channels
    wav = convert_audio(wav, sr, model.samplerate, model.audio_channels)
    wav = wav.to(device)
    
    # Normalize
    ref = wav.mean(0)
    std = ref.std()
    if std == 0:
        std = 1.0
    wav = (wav - ref.mean()) / std
    
    logger.info(f"Running AI vocal isolation on audio ({wav.shape[-1] / model.samplerate:.2f}s)...")
    with torch.no_grad():
        # apply_model takes batch (1, channels, time)
        sources = apply_model(model, wav[None], device=device, shifts=1, split=True, progress=False)[0]
    
    # Denormalize
    sources = sources * std + ref.mean()
    
    # In htdemucs, sources = ['drums', 'bass', 'other', 'vocals']
    vocal_idx = model.sources.index('vocals')
    vocals = sources[vocal_idx].cpu()
    
    # Convert stereo vocals to mono if desired, or keep stereo
    # For voice cloning / TTS, high quality stereo or mono WAV is supported
    vocals_np = vocals.numpy().T # Shape: (time, channels)
    
    out_io = io.BytesIO()
    sf.write(out_io, vocals_np, model.samplerate, format='WAV', subtype='PCM_16')
    return out_io.getvalue()
