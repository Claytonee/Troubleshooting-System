import sys, json
from faster_whisper import WhisperModel
m = WhisperModel("base.en", device="cpu", compute_type="int8")
out = {}
for p in sys.argv[1:]:
    segs, _ = m.transcribe(p, word_timestamps=True, beam_size=5)
    out[p] = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in s.words]
print(json.dumps(out))
