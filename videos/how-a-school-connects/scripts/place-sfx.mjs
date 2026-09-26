#!/usr/bin/env node
/**
 * Put each sound effect on the phrase it belongs to.
 *
 * fetch-sfx copies the named files and mounts each one at its frame's start
 * (offset 0). A click that should land as the router lights would then play
 * seconds early. Offsets here are read from cues.json (written by
 * compose-voice.mjs), so re-voicing a line moves its sounds with it.
 *
 *   node scripts/place-sfx.mjs      (after fetch-sfx and compose-voice)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const cues = JSON.parse(readFileSync('cues.json', 'utf8'));
const at = (frame, phraseIndex, lead = 0.04) => +(cues[frame].phrases[phraseIndex].start + lead).toFixed(3);
const CLICK = 'assets/sfx/click-soft.mp3', ERROR = 'assets/sfx/error.mp3';

// [frame, file, offset_s, volume] — SFX sit well under the voice.
const PLAN = [
  [1, 'assets/sfx/whoosh-short.mp3', 0.45, 0.22],                  // the pull-back gets going
  [2, CLICK, at(2, 0), 0.26], [2, CLICK, at(2, 1), 0.26], [2, CLICK, at(2, 2), 0.26],
  [2, CLICK, at(2, 3), 0.26], [2, CLICK, at(2, 4), 0.26], [2, CLICK, at(2, 5), 0.26],
  [3, ERROR, 1.0, 0.24],                                            // the line snaps (Scene 2)
  [4, CLICK, at(4, 1), 0.3], [4, CLICK, at(4, 2), 0.3], [4, CLICK, at(4, 3), 0.3],
  [4, ERROR, at(4, 4), 0.24],                                       // provider: the fault
  [5, 'assets/sfx/chime.mp3', at(5, 1, 0), 0.26],                   // back online
];

const meta = JSON.parse(readFileSync('audio_meta.json', 'utf8'));
const durations = Object.fromEntries((meta.sfx ?? []).map((s) => [s.file, s.duration_s]));
meta.sfx = PLAN.map(([frame, file, offset_s, volume]) => ({ frame, file, offset_s, duration_s: durations[file] ?? 1, volume }));
writeFileSync('audio_meta.json', JSON.stringify(meta, null, 2));
console.log(meta.sfx.map((s) => `f${s.frame}+${s.offset_s}s ${s.file.split('/').pop()}`).join(' · '));
