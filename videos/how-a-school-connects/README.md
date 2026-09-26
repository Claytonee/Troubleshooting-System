# How a School Connects to the Internet — explainer prototype

The first OE Support explainer video, and the evaluation of **HyperFrames** (HeyGen, Apache-2.0) as the
engine for them. 31.9 s, 1920×1080, 60 fps, English narration, captions, sound effects. Decision and
reasoning: `docs/engineering/security-program/DECISIONS.md` D36.

This folder is **not part of the web app**. The server serves only `frontend/`; the app's in-page
explainers stay drawn live (commit 5be4f8f: ~45 KB vs ~8 MB, and they play offline). The MP4 is for
staff WhatsApp groups, training sessions and a channel.

## Files, in the order they are made

| File | What it is |
|---|---|
| `BRIEF.md` | the confirmed brief: message, audience, every decision with its reason |
| `frame.md` | the design system: HyperFrames' *Blue Professional* preset remixed onto the OE brand (dark `#0f1117`, `#4f7cff`, DM Sans) |
| `STORYBOARD.md` | five frames on one stage, each a time-coded shot sequence paced to the voice |
| `SCRIPT.md` | the locked narration |
| `scripts/compose-voice.mjs` | voices each line **phrase by phrase** with designed pauses (a single take read "cable, switch, router, provider" in 1.3 s); writes `assets/voice/*.wav`, `cues.json` and word timings |
| `scripts/place-sfx.mjs` | puts each sound effect on the phrase it belongs to (from `cues.json`) |
| `scripts/build-frames.mjs` | emits all five `compositions/frames/*.html` from **one** stage definition, so every cut is invisible; packets run on a global clock so one in flight at a cut continues in the next frame |
| `scripts/finish-index.mjs` | marks the caption track the assembler leaves unmarked (hyperframes 0.8.77) |

## Rebuild

Needs Node 22+, Chrome, FFmpeg on `PATH`, and for the voice a Python with `kokoro-onnx` and
`faster-whisper` (a `uv` venv with Python 3.12 works; the system Python 3.14 has no wheels).

```bash
export HYPERFRAMES_PYTHON=/path/to/venv/python WHISPER_PY=/path/to/words.py   # words.py: faster-whisper base.en → JSON word timings
S=~/.claude/skills/faceless-explainer/scripts
node $S/audio.mjs fetch-sfx --storyboard ./STORYBOARD.md --hyperframes .   # FIRST: it rebuilds audio_meta.json
node scripts/compose-voice.mjs          # then the voice (overwrites the timings fetch-sfx reset)
node $S/audio.mjs sync-durations --audio-meta ./audio_meta.json --storyboard ./STORYBOARD.md
node scripts/place-sfx.mjs
node scripts/build-frames.mjs
node $S/captions.mjs build --storyboard ./STORYBOARD.md --audio-meta ./audio_meta.json --hyperframes . --out ./caption_groups.json
node $S/assemble-index.mjs --storyboard ./STORYBOARD.md --hyperframes .
node scripts/finish-index.mjs
npx hyperframes check
npx hyperframes render --fps 60 --quality high --output renders/video.mp4
```

The order matters once: `fetch-sfx` rebuilds `audio_meta.json` from the engine's sidecar, so voice
composition runs after it (and now keeps the sidecar in step).

## Licences

DM Sans and DM Mono: SIL Open Font License (`assets/fonts/OFL-*.txt`). Voice: Kokoro-82M (Apache-2.0),
voice `af_heart`. Sound effects: the HyperFrames bundled library. All drawings are original SVG.
