/**
 * Renders the two email header assets that the sign-in page draws with
 * technology email cannot use:
 *
 *   oe-wordmark-tz.png — "Opportunity Education Tanzania" in Axiforma,
 *                        exactly as `.login-title` sets it.
 *   oe-mark.png        — the gold Opportunity Education mark above it.
 *
 * Why images: email clients do not load web fonts, and most do not render SVG.
 * Gmail and Outlook strip `@font-face` outright, so `font-family: Axiforma` in
 * an email body is a declaration that silently resolves to Arial in the clients
 * our schools actually use, and an inline `<svg>` is simply dropped. The only
 * way brand type and a vector mark reach an inbox is as raster images, with the
 * name in `alt` so a client with images turned off still reads it.
 *
 * Both are rendered from the files the browser itself loads —
 * `frontend/fonts/axiforma-semi-bold.woff2` and `frontend/icons/oe-mark.svg` —
 * by headless Chrome, so the email header and the sign-in page cannot drift
 * apart. No new npm dependency: it reuses the verification suites' own browser
 * helper, and the sources go in as bytes, so nothing is fetched.
 *
 *   node scripts/build-email-wordmark.js
 *
 * Re-run it only when the wording, the font, the mark or `.login-title`
 * changes; the PNGs are committed, so a deploy never needs a browser.
 */
const fs = require('fs');
const path = require('path');
const browser = require('./lib/browser');

const ROOT = path.join(__dirname, '..', '..');
const FONT = path.join(ROOT, 'frontend', 'fonts', 'axiforma-semi-bold.woff2');
const MARK_SVG = path.join(ROOT, 'frontend', 'icons', 'oe-mark.svg');
const OUT = path.join(ROOT, 'frontend', 'icons', 'oe-wordmark-tz.png');
const OUT_MARK = path.join(ROOT, 'frontend', 'icons', 'oe-mark.png');

/** Displayed size of the mark in the email header, in CSS pixels. */
const MARK_SIZE = 34;

const TEXT = 'Opportunity Education Tanzania';
/** `.login-title`: 22px / 600. 18px here so the wordmark matches the official logo's 300px. */
const SIZE = 18;
const WEIGHT = 600;
/** Rendered at 3× for high-density screens; displayed at SIZE. */
const SCALE = 3;
const INK = '#1d2130';
/** Opaque: Outlook is unreliable with PNG alpha, and two flat tones compress smaller. */
const GROUND = '#ffffff';

async function main() {
  if (!fs.existsSync(FONT)) throw new Error('font not found: ' + FONT);
  const fontB64 = fs.readFileSync(FONT).toString('base64');

  const page = await browser.launch();
  if (!page) {
    console.error('No Chrome or Edge found. Install one, or set CHROME_PATH.');
    console.error('The committed PNG is still valid — this script only needs to run when the wording or font changes.');
    process.exit(2);
  }

  try {
    const result = await page.eval(`(async () => {
      const bin = atob(${JSON.stringify(fontB64)});
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const face = new FontFace('AxiformaBuild', buf.buffer);
      await face.load();
      document.fonts.add(face);

      const font = '${WEIGHT} ' + (${SIZE} * ${SCALE}) + 'px AxiformaBuild';
      const probe = document.createElement('canvas').getContext('2d');
      probe.font = font;
      const m = probe.measureText(${JSON.stringify(TEXT)});
      const w = Math.ceil(m.width) + 6;
      const h = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + 10;

      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = '${GROUND}'; g.fillRect(0, 0, w, h);
      g.font = font;
      g.fillStyle = '${INK}';
      g.textBaseline = 'alphabetic';
      g.fillText(${JSON.stringify(TEXT)}, 3, Math.ceil(m.actualBoundingBoxAscent) + 5);

      return { w, h, png: c.toDataURL('image/png').split(',')[1] };
    })()`);

    if (!result || !result.png) throw new Error('the page returned no image');

    const png = Buffer.from(result.png, 'base64');
    fs.writeFileSync(OUT, png);

    const displayW = Math.round(result.w / SCALE);
    const displayH = Math.round(result.h / SCALE);
    console.log(`  wrote ${path.relative(ROOT, OUT)}`);
    console.log(`  ${result.w}×${result.h} at ${SCALE}× — display ${displayW}×${displayH}px — ${(png.length / 1024).toFixed(1)} KB`);
    console.log(`  reference it at width="${displayW}" with alt="${TEXT}"`);

    // The gold mark, from the same SVG the sign-in page draws inline.
    const markB64 = fs.readFileSync(MARK_SVG).toString('base64');
    const mark = await page.eval(`(async () => {
      const px = ${MARK_SIZE} * ${SCALE};
      const img = new Image();
      img.src = 'data:image/svg+xml;base64,' + ${JSON.stringify(markB64)};
      await img.decode();
      const c = document.createElement('canvas');
      c.width = px; c.height = px;
      const g = c.getContext('2d');
      g.fillStyle = '${GROUND}'; g.fillRect(0, 0, px, px);
      g.drawImage(img, 0, 0, px, px);
      return { px, png: c.toDataURL('image/png').split(',')[1] };
    })()`);
    if (!mark || !mark.png) throw new Error('the page returned no mark image');
    const markPng = Buffer.from(mark.png, 'base64');
    fs.writeFileSync(OUT_MARK, markPng);
    console.log(`  wrote ${path.relative(ROOT, OUT_MARK)}`);
    console.log(`  ${mark.px}×${mark.px} at ${SCALE}× — display ${MARK_SIZE}×${MARK_SIZE}px — ${(markPng.length / 1024).toFixed(1)} KB`);
  } finally {
    await page.close();
  }
}

main().catch(e => { console.error('  FAILED:', e.message); process.exit(1); });
