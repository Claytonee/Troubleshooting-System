/**
 * Rebuild the whole OE hardware library: every Blender source script → GLB → glTF-Transform (dedup, weld,
 * meshopt) → <name>.web.glb, which is what scenes load. Prints one line per asset with triangles and sizes.
 *
 *   node videos/_engine/hardware-3d/build.mjs            # everything
 *   node videos/_engine/hardware-3d/build.mjs router     # scripts whose name contains "router"
 *
 * Blender: OE_BLENDER, default ~/tools/blender-5.2.2-windows-x64/blender.exe (portable, checksum-verified).
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const BLENDER = [process.env.OE_BLENDER, join(homedir(), 'tools', 'blender-5.2.2-windows-x64', 'blender.exe'),
  'C:/Users/clayt/tools/blender-5.2.2-windows-x64/blender.exe', '/usr/bin/blender']
  .filter(Boolean).find((p) => existsSync(p));
if (!BLENDER) throw new Error('no Blender found: set OE_BLENDER to blender.exe');
const filter = process.argv[2] || '';
const GT = ['--yes', '@gltf-transform/cli@4'];

const scripts = readdirSync(join(HERE, 'source')).filter((f) => /^build_.*\.py$/.test(f) && f.includes(filter));
const built = [];
for (const s of scripts) {
  const out = execFileSync(BLENDER, ['-b', '--factory-startup', '--python', join(HERE, 'source', s)], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const lines = out.split('\n').filter((l) => /^OE3D exported/.test(l));
  if (!lines.length) throw new Error(`${s}: Blender produced no export\n${out.split('\n').filter((l) => /Error|Traceback/.test(l)).join('\n')}`);
  for (const l of lines) { const m = l.match(/exported (\S+): (.+?\.glb)\s+objects=(\d+)\s+triangles=(\d+)/); if (m) built.push({ name: m[1], glb: m[2], tris: +m[4] }); }
}
for (const b of built) {
  const web = b.glb.replace(/\.glb$/, '.web.glb'), tmp = b.glb.replace(/\.glb$/, '.tmp.glb');
  // npx is a .cmd on Windows, so it runs through a shell: quote the paths (this tree has a space in its name)
  const q = (p) => `"${p}"`;
  const gt = (...a) => execFileSync('npx', [...GT, ...a], { stdio: 'ignore', shell: true });
  gt('dedup', q(b.glb), q(tmp)); gt('weld', q(tmp), q(tmp)); gt('meshopt', q(tmp), q(web));
  if (existsSync(tmp)) unlinkSync(tmp);
  console.log(`${b.name.padEnd(10)} ${String(b.tris).padStart(6)} tris  ${(statSync(b.glb).size / 1024).toFixed(0).padStart(5)} KB → ${(statSync(web).size / 1024).toFixed(0).padStart(4)} KB  ${basename(web)}`);
}
