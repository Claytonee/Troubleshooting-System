#!/usr/bin/env node
/**
 * OE explainer engine — one command from an episode spec to a finished MP4.
 *
 *   node videos/_engine/make.mjs <slug> [--only=init,docs,voice,sfx,build,assemble,check,snap,render]
 *
 * The spec is videos/_episodes/<slug>.mjs; the HyperFrames project it produces is
 * videos/<slug>/. Each step is the faceless-explainer workflow's own step or a
 * documented replacement for it (see videos/_engine/README.md):
 *
 *   init      hyperframes init (once), then the shared design system, fonts, logo
 *   docs      BRIEF.md, SCRIPT.md, STORYBOARD.md written from the spec
 *   voice     each line voiced phrase by phrase (Kokoro), pauses designed, word timings
 *             (faster-whisper) → assets/voice, cues.json, audio_meta.json
 *   sfx       the spec's sound cues, placed on their phrases (bundled library, offline)
 *   build     the stage + flows + timelines → compositions/frames/*.html
 *   assemble  captions, index.html (+ the caption-track kind the 0.8.77 assembler omits)
 *   check     hyperframes lint + check — any error stops the run
 *   snap      snapshots at every frame's middle and both sides of every cut
 *   render    60 fps, high quality → loudness -16 LUFS / -1.5 dBTP → renders/video.mp4
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { Stage } from './lib/stage.mjs';
import { frameFile, anchoredZoom, lessonCard, callout } from './lib/frame.mjs';
import * as geo from './lib/geometry.mjs';
import * as flows from './lib/stage.mjs';
import { C, CAM } from './lib/palette.mjs';
import { LIB } from './lib/devices.mjs';

const ENGINE = dirname(fileURLToPath(import.meta.url));
const VIDEOS = resolve(ENGINE, '..');
const SKILL = join(homedir(), '.claude', 'skills', 'faceless-explainer', 'scripts');
const SFX_LIB = join(homedir(), '.claude', 'skills', 'media-use', 'audio', 'assets', 'sfx');
const HF = 'hyperframes@0.8.77';
const FFMPEG_DIR = process.env.OE_FFMPEG_DIR || 'C:/Users/clayt/tools/ffmpeg-n8.1-latest-win64-gpl-8.1/bin';
const PY = process.env.OE_VIDEO_PYTHON || 'C:/Users/clayt/tools/kokoro-venv/Scripts/python.exe';
const env = { ...process.env, PATH: `${FFMPEG_DIR}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`, HYPERFRAMES_PYTHON: PY };

const slug = process.argv[2];
if (!slug) { console.error('usage: make.mjs <slug> [--only=a,b]'); process.exit(2); }
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (s) => !ONLY.length || ONLY.includes(s);
const spec = (await import(pathToFileURL(join(VIDEOS, '_episodes', `${slug}.mjs`)).href)).default;
const DIR = join(VIDEOS, slug);
const R = (f) => join(DIR, f);

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: DIR, env, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' && cmd === 'npx', maxBuffer: 1 << 28, ...opts }).toString();
const dur = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { env }).toString().trim());
const pad2 = (n) => String(n).padStart(2, '0');
const step = (name) => console.log(`\n▸ ${name}`);

// ── init ───────────────────────────────────────────────────────────────────────
if (want('init')) {
  step('init');
  if (!existsSync(R('hyperframes.json'))) {
    execFileSync('npx', ['-y', HF, 'init', `videos/${slug}`, '--non-interactive', '--example=blank', '--skill=faceless-explainer'], { cwd: resolve(VIDEOS, '..'), env, stdio: 'ignore', shell: process.platform === 'win32' });
  }
  for (const d of ['assets/fonts', 'assets/brand', 'assets/voice', 'assets/sfx', '.hyperframes', 'capture/extracted', 'compositions/frames', 'renders']) mkdirSync(R(d), { recursive: true });
  for (const f of readdirSync(join(ENGINE, 'shared', 'fonts'))) copyFileSync(join(ENGINE, 'shared', 'fonts', f), R(`assets/fonts/${f}`));
  for (const f of readdirSync(join(ENGINE, 'shared', 'brand'))) copyFileSync(join(ENGINE, 'shared', 'brand', f), R(`assets/brand/${f}`));
  copyFileSync(join(ENGINE, 'shared', 'frame.md'), R('frame.md'));
  copyFileSync(join(ENGINE, 'shared', 'caption-skin.html'), R('.hyperframes/caption-skin.html'));
  writeFileSync(R('.gitignore'), 'renders/\nsnapshots/\n.scratch/\nnode_modules/\n.hyperframes/frame-packets/\n');
  writeFileSync(R('capture/extracted/tokens.json'), JSON.stringify({ title: spec.title, description: spec.message, colors: ['#0f1117', '#e8eaf0', '#4f7cff', '#FFAE00'], fonts: ['DM Sans', 'DM Mono'] }, null, 2));
  writeFileSync(R('capture/extracted/visible-text.txt'), `${spec.title}\n\n${spec.source || spec.message}\n`);
  console.log(`  project: videos/${slug}`);
}

// ── voice ──────────────────────────────────────────────────────────────────────
const RATE = 24000, VOICE = spec.voice || 'af_heart', SPEED = String(spec.speed || 0.94);
if (want('voice')) {
  step('voice');
  const cache = join(ENGINE, '.cache', 'tts'); mkdirSync(cache, { recursive: true });
  const tmp = R('.scratch/phrases'); mkdirSync(tmp, { recursive: true });
  const silence = (s) => { const g = join(cache, `gap-${s}.wav`); if (!existsSync(g)) execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `anullsrc=r=${RATE}:cl=mono`, '-t', String(s), g], { env }); return g; };
  const cues = {};
  spec.frames.forEach((fr, fi) => {
    const f = fi + 1, [lead, tail] = fr.pad || [0.3, 0.45];
    const parts = [silence(lead)], phrases = []; let t = lead;
    fr.phrases.forEach(([text, pause], i) => {
      const key = createHash('sha1').update(`${VOICE}|${SPEED}|${text}`).digest('hex').slice(0, 16);
      const raw = join(cache, `${key}.wav`);
      if (!existsSync(raw)) {
        const rel = `.scratch/phrases/${key}.wav`;   // relative: the CLI is run through a shell
        sh('npx', ['-y', HF, 'tts', JSON.stringify(text), '-o', rel, '--voice', VOICE, '--speed', SPEED]);
        copyFileSync(R(rel), raw);
      }
      const cut = join(tmp, `${f}-${i}.wav`);
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse', '-ar', String(RATE), '-ac', '1', cut], { env });
      phrases.push({ text, start: geo.r3(t) });
      parts.push(cut); t += dur(cut);
      if (pause > 0) { parts.push(silence(pause)); t += pause; }
    });
    parts.push(silence(tail));
    const list = join(tmp, `${f}-list.txt`);
    writeFileSync(list, parts.map((q) => `file '${q.replace(/\\/g, '/')}'`).join('\n'));
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', R(`assets/voice/${pad2(f)}.wav`)], { env });
    cues[f] = { duration: geo.r3(dur(R(`assets/voice/${pad2(f)}.wav`))), phrases };
    console.log(`  ${pad2(f)} ${cues[f].duration}s · ${phrases.map((q) => `${q.start}s "${q.text}"`).join(' · ')}`);
  });
  writeFileSync(R('cues.json'), JSON.stringify(cues, null, 2));
  const files = spec.frames.map((_, i) => R(`assets/voice/${pad2(i + 1)}.wav`));
  const words = JSON.parse(execFileSync(PY, [join(ENGINE, 'tools', 'words.py'), ...files], { env, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }).toString());
  const old = existsSync(R('audio_meta.json')) ? JSON.parse(readFileSync(R('audio_meta.json'), 'utf8')) : {};
  const meta = { bgm: null, bgm_pending: false, sfx: old.sfx || [], voices: spec.frames.map((_, i) => {
    const key = Object.keys(words).find((k) => k.replace(/\\/g, '/').endsWith(`assets/voice/${pad2(i + 1)}.wav`));
    return { frame: i + 1, path: `assets/voice/${pad2(i + 1)}.wav`, duration_s: cues[i + 1].duration,
      words: (words[key] || []).map((w, j) => ({ id: `w${i + 1}-${j}`, text: w.w, start: w.s, end: w.e })) };
  }) };
  writeFileSync(R('audio_meta.json'), JSON.stringify(meta, null, 2));
  console.log(`  total ${geo.r3(meta.voices.reduce((a, v) => a + v.duration_s, 0))}s`);
}

// ── timing context (after voice) ───────────────────────────────────────────────
function context() {
  const cues = JSON.parse(readFileSync(R('cues.json'), 'utf8'));
  const meta = JSON.parse(readFileSync(R('audio_meta.json'), 'utf8'));
  const DUR = {}, OFF = {}; let o = 0;
  spec.frames.forEach((_, i) => { const f = i + 1; DUR[f] = cues[f].duration; OFF[f] = geo.r3(o); o += DUR[f]; });
  const cue = (f, i, plus = 0) => geo.r3(cues[f].phrases[i].start + plus);
  const word = (f, w, plus = 0) => { const v = meta.voices.find((x) => x.frame === f); const h = v && v.words.find((x) => x.text.toLowerCase().replace(/[^a-z0-9]/g, '') === w); return h ? geo.r3(h.start + plus) : null; };
  const G = (f, t) => geo.r3(OFF[f] + t);
  return { cues, meta, DUR, OFF, cue, word, G, total: geo.r3(o), C, CAM, geo, flows, LIB, Stage, anchoredZoom, lessonCard, callout, J: JSON.stringify };
}

// ── docs ───────────────────────────────────────────────────────────────────────
function writeDocs(ctx) {
  const d = (i) => (ctx ? `${ctx.DUR[i + 1]}s` : `${spec.frames[i].est || 5}s`);
  writeFileSync(R('BRIEF.md'), `---
workflow: faceless-explainer
flow: automation
storyboard: no
message: ${JSON.stringify(spec.message)}
destination: youtube
aspect: 1920x1080
language: en
audience: ${JSON.stringify(spec.audience || 'Teachers and school ICT admins in Tanzania, non-specialists, often on a phone over a slow link')}
length: ${spec.length || '30s'}
angle: how-to
---

## Intent

OE Support explainer series — ${spec.kicker}: ${spec.title}. Fault type in the system: ${spec.category} / ${spec.subcategory}.
Built with the OE explainer engine (videos/_engine) on the visual system the owner approved on 2026-09-26
(the prototype, videos/how-a-school-connects).

## Customizations

- The engine's shared look: one continuous technical drawing, camera moves, the official OE logo, captions.
${(spec.creative || []).map((c) => `- ${c}`).join('\n')}

## Notes

${(spec.facts || []).map((c) => `- ${c}`).join('\n')}
`);
  writeFileSync(R('SCRIPT.md'), `# SCRIPT — ${slug}\n\n**Voice:** ${VOICE} (Kokoro-82M, local)\n**Voice settings:** speed ${SPEED}\n**Voice direction:** Calm, clear, practical. A colleague showing you something useful.\n\n---\n\n` +
    spec.frames.map((fr, i) => `## Line ${i + 1} — ${fr.title} (Frame ${i + 1})\n\n**Delivery:** ${fr.delivery || 'Steady.'}\n\n    ${fr.phrases.map((x) => x[0]).join(' ')}\n`).join('\n'));
  writeFileSync(R('STORYBOARD.md'), `---
format: 1920x1080
duration: ${spec.length || '30s'}
message: ${JSON.stringify(spec.message)}
arc: ${spec.arc || 'how-to-process'}
audience: ${JSON.stringify(spec.audience || 'Teachers and school ICT admins in Tanzania')}
mode: autonomous
music: none
fps: 60
---

# ${spec.title}

## Video direction

${readFileSync(join(ENGINE, 'shared', 'video-direction.md'), 'utf8').trim()}

**This episode's stage.** ${spec.stageNote || ''}

` + spec.frames.map((fr, i) => `## Frame ${i + 1} — ${fr.title}

- scene: ${fr.scene}
- voiceover: ${JSON.stringify(fr.phrases.map((x) => x[0]).join(' '))}
- duration: ${d(i)}
- transition_in: cut
- status: ${ctx ? 'animated' : 'outline'}
- src: compositions/frames/${fr.id}.html
- type: ${fr.type || 'feature_showcase'}
- persuasion: ${fr.persuasion || 'Progressive disclosure'}
- beat: ${fr.beat || 'Clarity'}
- blueprint: ${fr.blueprint || 'compose'}

${fr.shots || ''}
`).join('\n'));
}
if (want('docs')) { step('docs'); writeDocs(existsSync(R('cues.json')) ? context() : null); }

// ── sfx ────────────────────────────────────────────────────────────────────────
if (want('sfx')) {
  step('sfx');
  const ctx = context();
  const manifest = JSON.parse(readFileSync(join(SFX_LIB, 'manifest.json'), 'utf8'));
  const plan = spec.sfx ? spec.sfx(ctx) : [];
  const meta = JSON.parse(readFileSync(R('audio_meta.json'), 'utf8'));
  meta.sfx = plan.map(([frame, name, offset_s, volume = 0.26]) => {
    const m = manifest[name]; if (!m) throw new Error(`sfx: "${name}" is not in the bundled library`);
    copyFileSync(join(SFX_LIB, m.file), R(`assets/sfx/${m.file}`));
    return { frame, file: `assets/sfx/${m.file}`, offset_s: geo.r3(offset_s), duration_s: m.duration, volume };
  });
  writeFileSync(R('audio_meta.json'), JSON.stringify(meta, null, 2));
  console.log(`  ${meta.sfx.length} cues`);
}

// ── build ──────────────────────────────────────────────────────────────────────
if (want('build')) {
  step('build');
  const ctx = context();
  const st = spec.stage(ctx);
  ctx.st = st;
  const all = spec.flows ? spec.flows(ctx) : [];
  spec.frames.forEach((fr, i) => {
    const f = i + 1;
    const body = fr.timeline({ ...ctx, f, dur: ctx.DUR[f], off: ctx.OFF[f], c: (k, plus) => ctx.cue(f, k, plus), w: (x, plus) => ctx.word(f, x, plus), g: (t) => geo.r3(t - ctx.OFF[f]) });
    writeFileSync(R(`compositions/frames/${fr.id}.html`), frameFile({ id: fr.id, f, dur: ctx.DUR[f], off: ctx.OFF[f], stage: st, flows: all, slate: { kicker: spec.kicker, title: spec.title }, lesson: spec.lesson, body, first: f === 1 }));
  });
  writeDocs(ctx);
  console.log(`  ${spec.frames.length} frames · ${all.length} flow items · ${ctx.total}s`);
}

// ── assemble ───────────────────────────────────────────────────────────────────
if (want('assemble')) {
  step('assemble');
  sh('node', [join(SKILL, 'captions.mjs'), 'build', '--storyboard', './STORYBOARD.md', '--audio-meta', './audio_meta.json', '--hyperframes', '.', '--out', './caption_groups.json']);
  console.log('  ' + sh('node', [join(SKILL, 'assemble-index.mjs'), '--storyboard', './STORYBOARD.md', '--hyperframes', '.']).trim().split('\n').pop());
  let s = readFileSync(R('index.html'), 'utf8');
  if (!/id="el-captions"[^>]*data-track-kind/.test(s)) s = s.replace('id="el-captions"', 'id="el-captions" data-track-kind="captions"');
  writeFileSync(R('index.html'), s);
}

// ── check ──────────────────────────────────────────────────────────────────────
if (want('check')) {
  step('check');
  const lint = sh('npx', ['-y', HF, 'lint']);
  const last = lint.trim().split('\n').pop(); console.log('  lint: ' + last.trim());
  if (!/0 error/.test(last)) { console.log(lint); process.exit(1); }
  let out = '';
  try { out = sh('npx', ['-y', HF, 'check', '--timeout', '20000']); } catch (e) { out = (e.stdout || '').toString() + (e.stderr || '').toString(); }
  const lines = out.split('\n').filter((l) => /✗|error\(s\)|text checks|Check (passed|failed)|⚠/.test(l));
  lines.forEach((l) => console.log('  ' + l.trim()));
  if (/Check failed|✗/.test(out)) { console.log(out); process.exit(1); }
}

// ── snap ───────────────────────────────────────────────────────────────────────
if (want('snap')) {
  step('snap');
  const ctx = context();
  const at = [];
  spec.frames.forEach((_, i) => { const f = i + 1; at.push(geo.r3(ctx.OFF[f] + ctx.DUR[f] * 0.3), geo.r3(ctx.OFF[f] + ctx.DUR[f] * 0.75)); if (f > 1) at.push(geo.r3(ctx.OFF[f] - 0.03), geo.r3(ctx.OFF[f] + 0.03)); });
  rmSync(R('snapshots'), { recursive: true, force: true });
  sh('npx', ['-y', HF, 'snapshot', '--at', [...new Set(at)].sort((a, b) => a - b).join(',')]);
  console.log(`  ${at.length} snapshots → videos/${slug}/snapshots/`);
}

// ── render ─────────────────────────────────────────────────────────────────────
if (want('render')) {
  step('render');
  sh('npx', ['-y', HF, 'render', '--skill=faceless-explainer', '--fps', '60', '--quality', 'high', '--output', 'renders/draft.mp4']);
  const ff = (args) => execFileSync('ffmpeg', args, { cwd: DIR, env, stdio: ['ignore', 'pipe', 'pipe'] });
  // ffmpeg reports loudness on stderr: measure, then apply in a second, linear pass.
  const meas = spawnSync('ffmpeg', ['-hide_banner', '-i', 'renders/draft.mp4', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { cwd: DIR, env }).stderr.toString();
  const stats = JSON.parse(/\{[\s\S]*\}/.exec(meas)[0]);
  ff(['-y', '-v', 'error', '-i', 'renders/draft.mp4', '-c:v', 'copy', '-af', `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true,aresample=48000`, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', 'renders/video.mp4']);
  const ctx = context();
  const n = Math.round(ctx.total * 60), picks = [...Array(12)].map((_, k) => Math.round(((k + 0.5) / 12) * n));
  ff(['-y', '-v', 'error', '-i', 'renders/video.mp4', '-vf', `select='${picks.map((q) => `eq(n\\,${q})`).join('+')}',scale=480:-1,tile=4x3:padding=6:color=0x1b1d24`, '-frames:v', '1', '-fps_mode', 'vfr', 'renders/contact-sheet.jpg']);
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=r_frame_rate,nb_frames:format=duration,size', '-of', 'compact', 'renders/video.mp4'], { cwd: DIR, env }).toString().trim().replace(/\n/g, ' · ');
  console.log(`  renders/video.mp4 · ${probe}`);
}
