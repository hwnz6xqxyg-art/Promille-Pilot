/**
 * Build pipeline for the Promille-Pilot web app.
 *
 *   node build.mjs        → dist/ (index.html, app.<hash>.js/.css, sw.js, manifest, icons)
 *
 * All asset references are RELATIVE (./…) so the app works from the GitHub Pages
 * subpath (https://<user>.github.io/Excitement-Engine/). The service worker gets a
 * cache name derived from the content hash plus the exact precache list injected.
 */
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 1) App bundle (JS + CSS) with content hash in the filename.
const result = await build({
  entryPoints: [join(here, 'src/main.ts'), join(here, 'src/styles.css')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020', 'safari15'],
  entryNames: '[name].[hash]',
  outdir: dist,
  metafile: true,
  logLevel: 'silent',
});

const outputs = Object.keys(result.metafile.outputs).map((p) => p.split('/').pop());
const jsFile = outputs.find((f) => f.startsWith('main.') && f.endsWith('.js'));
const cssFile = outputs.find((f) => f.startsWith('styles.') && f.endsWith('.css'));
if (!jsFile || !cssFile) throw new Error('esbuild outputs missing: ' + outputs.join(', '));

// 2) index.html from template with hashed asset names.
const html = readFileSync(join(here, 'src/index.html'), 'utf8')
  .replace('%APP_JS%', './' + jsFile)
  .replace('%APP_CSS%', './' + cssFile);
if (html.includes('%APP_')) throw new Error('unresolved placeholder in index.html');
writeFileSync(join(dist, 'index.html'), html);

// 3) Static assets.
for (const f of readdirSync(join(here, 'assets'))) {
  if (f.endsWith('.svg') && f !== 'favicon.svg') continue; // icon.svg is a source file, not shipped
  cpSync(join(here, 'assets', f), join(dist, f));
}

// 4) Build hash over bundle names AND every file now in dist/ (index.html, icons,
//    manifest, …) — an assets-only change (e.g. new icons) must still change the
//    SW cache name, otherwise installed clients keep serving the old cached files.
const hasher = createHash('sha256').update(jsFile + cssFile);
for (const f of readdirSync(dist).sort()) hasher.update(f).update(readFileSync(join(dist, f)));
const buildHash = hasher.digest('hex').slice(0, 10);

// 5) Service worker (stable name, cache-busted via cache name + precache list).
const precache = ['./', './index.html', './' + jsFile, './' + cssFile, './manifest.webmanifest']
  .concat(readdirSync(dist).filter((f) => f.endsWith('.png')).map((f) => './' + f));

await build({
  entryPoints: [join(here, 'src/sw.ts')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020', 'safari15'],
  outfile: join(dist, 'sw.js'),
  logLevel: 'silent',
  define: {
    __CACHE_NAME__: JSON.stringify('pp-web-' + buildHash),
    __PRECACHE__: JSON.stringify(precache),
  },
});

console.log('dist/:', readdirSync(dist).sort().join('  '));
console.log('build hash:', buildHash);
