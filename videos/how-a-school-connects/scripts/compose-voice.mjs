#!/usr/bin/env node
/**
 * Voice lines composed from phrases, with designed pauses.
 *
 * One TTS call per line reads a list ("cable, switch, router, provider") in
 * 1.3 s — too fast to teach from, and a picture cannot light four devices in
 * that time. So each line is voiced phrase by phrase, each phrase trimmed of
 * its own silence, and joined with a chosen pause. The result has two things a
 * single take lacks: a teaching pace, and the exact start of every phrase,
 * which the frames use to reveal each device on the word that names it.
 *
 * Writes assets/voice/NN.wav, cues.json (phrase starts per frame) and updates
 * audio_meta.json (durations + word timings from faster-whisper).
 *
 *   node scripts/compose-voice.mjs
 * Needs: ffmpeg on PATH; HYPERFRAMES_PYTHON with kokoro-onnx; WHISPER_PY (a
 * script printing word timings as JSON) — see the project README.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const VOICE = 'af_heart';
const SPEED = '0.94';
const RATE = 24000;
// Silence before and after each frame's line (seconds): the hook needs a beat of picture before the
// first word, and the last frame needs a held ending. Durations still come from the voice files.
const PAD = { 1: [0.7, 0.4], 2: [0.35, 0.45], 3: [0.25, 0.5], 4: [0.25, 0.55], 5: [0.25, 1.9] };

// [frame, [[phrase, pauseAfterSeconds], …]]
const LINES = [
  [1, [['No internet in the lab?', 0.45], ['The fault is in one of four links.', 0]]],
  [2, [['Your computer sends packets,', 0.3], ['down the cable,', 0.3], ['to the switch,', 0.3],
       ['through the router,', 0.3], ['to your provider,', 0.35], ['and out to the internet.', 0]]],
  [3, [['When one link breaks,', 0.3], ['the packets stop right there.', 0]]],
  [4, [['Check them in order, from the computer out.', 0.5], ['Cable.', 0.45], ['Switch.', 0.45],
       ['Router.', 0.45], ['Provider.', 0.6], ['The first dark light is your fault.', 0]]],
  [5, [['Fix that one link,', 0.3], ['and the school is back online.', 0]]],
];

const root = process.cwd();
const tmp = join(root, '.scratch', 'phrases');
mkdirSync(tmp, { recursive: true });
mkdirSync(join(root, 'assets', 'voice'), { recursive: true });

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' && cmd === 'npx', ...opts }).toString();
const dur = (f) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim());

const cues = {};
for (const [frame, phrases] of LINES) {
  const parts = [];
  const starts = [];
  const silence = (sec) => { const g = join(tmp, 'gap-' + sec + '.wav'); if (!existsSync(g)) run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=' + RATE + ':cl=mono', '-t', String(sec), g]); return g; };
  const [lead, tail] = PAD[frame];
  parts.push(silence(lead));
  let t = lead;
  phrases.forEach(([text, pause], i) => {
    const raw = join(tmp, `${frame}-${i}-raw.wav`);
    const cut = join(tmp, `${frame}-${i}.wav`);
    if (!existsSync(raw)) run('npx', ['hyperframes', 'tts', JSON.stringify(text), '-o', `.scratch/phrases/${frame}-${i}-raw.wav`, '--voice', VOICE, '--speed', SPEED]);
    // Trim the phrase's own leading/trailing silence so the pause is exactly the chosen one.
    run('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-af',
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse',
      '-ar', String(RATE), '-ac', '1', cut]);
    starts.push({ text, start: +t.toFixed(3) });
    parts.push(cut);
    t += dur(cut);
    if (pause > 0) {
      const gap = join(tmp, `gap-${pause}.wav`);
      if (!existsSync(gap)) run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `anullsrc=r=${RATE}:cl=mono`, '-t', String(pause), gap]);
      parts.push(gap);
      t += pause;
    }
  });
  parts.push(silence(tail));
  const list = join(tmp, `${frame}-list.txt`);
  writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  const out = join(root, 'assets', 'voice', `0${frame}.wav`);
  run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out]);
  cues[frame] = { duration: +dur(out).toFixed(3), phrases: starts };
  console.log(`frame ${frame}: ${cues[frame].duration}s — ${starts.map((s) => `${s.start}s "${s.text}"`).join(' · ')}`);
}
writeFileSync(join(root, 'cues.json'), JSON.stringify(cues, null, 2));

// Word timings for captions, from the composed files themselves.
const meta = JSON.parse(readFileSync(join(root, 'audio_meta.json'), 'utf8'));
let words = {};
if (process.env.WHISPER_PY) {
  const files = LINES.map(([f]) => join(root, 'assets', 'voice', `0${f}.wav`));
  words = JSON.parse(run(process.env.HYPERFRAMES_PYTHON, [process.env.WHISPER_PY, ...files]));
}
for (const v of meta.voices) {
  v.duration_s = cues[v.frame].duration;
  const key = Object.keys(words).find((k) => k.endsWith(`0${v.frame}.wav`));
  v.words = key ? words[key].map((w, i) => ({ id: `w${v.frame}-${i}`, text: w.w, start: w.s, end: w.e })) : [];
}
writeFileSync(join(root, 'audio_meta.json'), JSON.stringify(meta, null, 2));
// The engine's own sidecar is what fetch-sfx and later engine runs rebuild audio_meta.json from:
// keep it in step, or the next engine pass silently restores the single-take timings.
const engPath = join(root, 'audio_engine_meta.json');
if (existsSync(engPath)) {
  const eng = JSON.parse(readFileSync(engPath, 'utf8'));
  for (const v of eng.voices ?? []) {
    const m = meta.voices.find((x) => x.frame === Number(v.id));
    if (m) { v.duration_s = m.duration_s; v.words = m.words; }
  }
  eng.total_duration_s = +meta.voices.reduce((a, v) => a + v.duration_s, 0).toFixed(3);
  writeFileSync(engPath, JSON.stringify(eng, null, 2));
}
console.log('audio_meta.json updated');
