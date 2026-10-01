# The intro video's extra line in the clip's own voice (mission.wav), cloned with F5-TTS on the CPU.
#   pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu && pip install --no-deps f5-tts
#   (+ its runtime deps: vocos x_transformers cached_path transformers librosa ema_pytorch omegaconf hydra-core ...)
#   ffmpeg -i ../source.mp4 -t 4.55 -ac 1 -ar 24000 ref1.wav && python3 clone.py
# Picks: seed 1 of the pizza line (median pitch ~209 Hz vs the clip's ~197 Hz; other seeds drifted 2-6 semitones up).
# Then: trim to the speech (+30 / 80 ms), match the clip's speech RMS, 48 kHz mono -> mission.wav.
import soundfile as sf, torch, torchaudio, numpy as np, librosa, sys
def _load(p, *a, **k):
    d, sr = sf.read(p, dtype='float32', always_2d=True); return torch.from_numpy(np.ascontiguousarray(d.T)), sr
torchaudio.load = _load
from f5_tts.api import F5TTS
tts = F5TTS(device="cpu")
REF = {'ref1.wav': "Hey everyone! I'm Lloyd Garmadon, the Green Ninja, Protector of Ninjago."}
lines = {"c3": "Mission: survive grad school. Status: ongoing!", "c2": "Secret mission: find free pizza at Geisel!"}
def pitch(w, sr):
    y = librosa.resample(w, orig_sr=sr, target_sr=16000); f0, v, _ = librosa.pyin(y, fmin=70, fmax=450, sr=16000); return float(np.median(f0[v]))
for ref, rt in REF.items():
  for key, t in lines.items():
    for seed in [1, 2, 3, 4]:
        w, sr, _ = tts.infer(ref_file=ref, ref_text=rt, gen_text=t, nfe_step=32, speed=1.1, seed=seed, cfg_strength=2.0)
        f = f"{key}_s{seed}.wav"; sf.write(f, w, sr)
        print(f, round(len(w)/sr, 2), 'f0', round(pitch(w, sr)), flush=True)
