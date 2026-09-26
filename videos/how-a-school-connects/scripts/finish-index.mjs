#!/usr/bin/env node
// assemble-index.mjs (hyperframes 0.8.77) writes the caption track without the
// data-track-kind its own lint asks for (caption_track_kind_missing). Add it.
import { readFileSync, writeFileSync } from 'node:fs';
let s = readFileSync('index.html', 'utf8');
if (!/id="el-captions"[^>]*data-track-kind/.test(s)) s = s.replace('id="el-captions"', 'id="el-captions" data-track-kind="captions"');
writeFileSync('index.html', s);
console.log('index.html: caption track marked');
