/**
 * The explainer films that ship with the app (D36–D38).
 *
 * Only films the owner has approved are listed here. On 2026-09-26 the owner watched all
 * three productions of episode 00 side by side — the drawn 2D film (D38), the hybrid
 * (D39) and the 3D-first rebuild (D40) — and chose **the hybrid**: the drawn system view
 * for how the network fits together, and real 3D hardware for the part you have to walk
 * up to and inspect. That is the film here now (v3, 83 s), replacing the drawn v2.
 *
 * They are made in videos/ with the explainer engine and copied into
 * frontend/media/videos/ unchanged: the owner asked for the original 1080p60 master,
 * not a re-encode ("napenda vitu quality"). The master already has its index at the
 * front of the file, so it starts playing before the whole file has arrived.
 *
 * A replaced film gets a new file name (…-v3.mp4), because /media/ is served with a
 * year-long immutable cache: a school downloads each film once.
 *
 * Sizes are read from disk at boot, never typed in, so the card cannot misstate what a
 * school is about to download.
 */
const fs = require('fs');
const path = require('path');

const MEDIA = path.join(__dirname, '..', '..', '..', 'frontend', 'media', 'videos');

const FILMS = [
  {
    key: 'how-a-school-connects',
    file: 'how-a-school-connects-v3.mp4',
    poster: 'how-a-school-connects-v3.jpg',
    title: 'How a school connects to the internet',
    summary: 'Follow the signal from the computer to the internet, check each light in order, and find the first failed link.',
    category: 'Connectivity',
    language: 'en',
    duration_s: 83,
    quality: '1080p · 60 fps'
  }
];

function list() {
  return FILMS.map(f => {
    let bytes = null;
    try { bytes = fs.statSync(path.join(MEDIA, f.file)).size; } catch (e) { return null; }   // not on disk: not listed
    return {
      key: f.key,
      title: f.title,
      summary: f.summary,
      category: f.category,
      language: f.language,
      duration_s: f.duration_s,
      quality: f.quality,
      bytes,
      src: '/media/videos/' + f.file,
      poster: '/media/videos/' + f.poster
    };
  }).filter(Boolean);
}

module.exports = { list, FILMS };
