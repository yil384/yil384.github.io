# Regenerates the intro video's voice lines (hey.wav, name.wav, great.wav) with Kokoro TTS, offline on the CPU.
#   pip install kokoro-onnx soundfile
#   curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
#   curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
#   python3 gen.py <dir with the two model files>       (writes the wavs next to this script)
# Each line must fit its slot in the clip (render.mjs LINES): hey <= 1.0 s, name <= 3.4 s, great <= 2.3 s.
# After synthesis every line is lifted ~2 semitones (a younger, more heroic read), high-passed and lightly compressed.
import os, subprocess, sys
import soundfile as sf
from kokoro_onnx import Kokoro

models = sys.argv[1] if len(sys.argv) > 1 else '.'
here = os.path.dirname(os.path.abspath(__file__))
k = Kokoro(os.path.join(models, 'kokoro-v1.0.onnx'), os.path.join(models, 'voices-v1.0.bin'))
LINES = {
    'hey': 'Hey, everyone!',
    'name': "I'm Yichen Lin... and yes, also the Green Ninja!",
    'great': "It's great to be here at U C San Diego!",
}
for key, text in LINES.items():
    audio, sr = k.create(text, voice='am_puck', speed=1.05, lang='en-us')
    raw = os.path.join(here, f'{key}.raw.wav')
    sf.write(raw, audio, sr)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af',
                    f'asetrate={sr}*1.12,aresample={sr},atempo=1/1.12,highpass=f=90,'
                    'acompressor=threshold=-20dB:ratio=3:attack=5:release=80',
                    '-ar', '48000', '-ac', '1', os.path.join(here, f'{key}.wav')], check=True)
    os.remove(raw)
    print(key, round(len(audio) / sr, 2), 's')
