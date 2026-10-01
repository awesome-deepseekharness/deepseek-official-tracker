#!/usr/bin/env node
/**
 * build-pages.mjs — stage tracker data for the Astro site, then build it.
 *
 * Historically this script emitted site/index.html itself: one inline HTML/CSS
 * string. The page is now an Astro component (site/src/pages/index.astro) that
 * reads the tracker's markdown, so this script's job is to stage those files
 * where Astro can read them and then run the build.
 *
 * It still writes site/feed.json, the machine-readable feed, because that is a
 * documented public endpoint and must not depend on the site's internals.
 *
 * Usage: node scripts/build-pages.mjs [--no-astro]
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE_DIR = path.join(ROOT, 'site');
const PUBLIC_DIR = path.join(SITE_DIR, 'public');
const ASTRO_OUT = path.join(SITE_DIR, 'dist');

// Every markdown file the site reads. These are also copied verbatim so the
// documented raw-markdown URLs keep resolving.
const MARKDOWN = [
  'FEED.md',
  'NEWS.md',
  'api-changelog.md',
  'website-news.md',
  'releases.md',
  'npm.md',
  'huggingface.md',
  'insights.md',
];

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function stage() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  const staged = [];
  for (const f of MARKDOWN) {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(PUBLIC_DIR, f));
    staged.push(f);
  }

  // feed.json is a documented public endpoint, independent of the page build.
  const feed = readIfExists(path.join(ROOT, 'FEED.md'));
  const items = [...feed.matchAll(/^- \*\*(.+?)\*\* (.+)$/gm)]
    .map(m => ({ date: m[1], title: m[2].replace(/\s+$/, '') }))
    .slice(0, 80);
  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'feed.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), count: items.length, items }, null, 2)}\n`,
    'utf8'
  );

  console.log(`[build-pages] staged ${staged.length}/${MARKDOWN.length} markdown files + feed.json (${items.length} items)`);
  return items.length;
}

function buildAstro() {
  // npm ci on a lockfile is the CI path; install locally when the lock is absent
  // or node_modules is missing (a fresh clone, or a contributor without it).
  const hasModules = fs.existsSync(path.join(SITE_DIR, 'node_modules', 'astro'));
  if (!hasModules) {
    const install = spawnSync('npm', ['install', '--no-fund', '--no-audit'], {
      cwd: SITE_DIR,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (install.status !== 0) {
      console.warn('[build-pages] npm install failed — skipping Astro build, site/ will be stale');
      return false;
    }
  }
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: SITE_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (build.status !== 0) {
    console.warn(`[build-pages] astro build failed (exit ${build.status})`);
    return false;
  }
  return fs.existsSync(path.join(ASTRO_OUT, 'index.html'));
}

function main() {
  const count = stage();
  if (process.argv.includes('--no-astro')) {
    console.log('[build-pages] --no-astro: staged data only');
    return;
  }
  if (!buildAstro()) {
    console.warn('[build-pages] no index.html produced — Pages deploy will fail');
    process.exitCode = 1;
    return;
  }
  console.log(`[build-pages] site built at ${path.relative(ROOT, ASTRO_OUT)} with ${count} feed items`);
}

main();
