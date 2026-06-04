/**
 * Build script: minifies public/style.css → public/style.min.css
 * Run: node scripts/build.js  (or: npm run build)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC = path.join(__dirname, '..', 'public', 'style.css');
const OUT = path.join(__dirname, '..', 'public', 'style.min.css');

if (!fs.existsSync(SRC)) {
  console.error('[build] style.css not found at', SRC);
  process.exit(1);
}

let css = fs.readFileSync(SRC, 'utf8');
const originalSize = Buffer.byteLength(css, 'utf8');

// 1. Remove block comments (/* ... */)
css = css.replace(/\/\*[\s\S]*?\*\//g, '');
// 2. Collapse whitespace / newlines to single space
css = css.replace(/\s+/g, ' ');
// 3. Remove spaces around braces, semicolons, colons (safe for CSS)
css = css.replace(/ *\{ */g, '{');
css = css.replace(/ *\} */g, '}');
css = css.replace(/ *; */g, ';');
// 4. Remove trailing semicolons before closing brace
css = css.replace(/;}/g, '}');
// 5. Remove spaces around commas in selectors/values
css = css.replace(/ *, */g, ',');
// 6. Trim
css = css.trim();

const minifiedSize = Buffer.byteLength(css, 'utf8');
const hash = crypto.createHash('md5').update(css).digest('hex').slice(0, 8);
const saved = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

fs.writeFileSync(OUT, css, 'utf8');
console.log(`[build] style.css → style.min.css`);
console.log(`        ${(originalSize / 1024).toFixed(1)} KB → ${(minifiedSize / 1024).toFixed(1)} KB  (${saved}% saved, hash: ${hash})`);
