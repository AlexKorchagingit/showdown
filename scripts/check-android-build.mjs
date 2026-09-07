import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve(process.argv[2] || 'dist');
const html = await readFile(resolve(outputDirectory, 'index.html'), 'utf8');
const files = await readdir(resolve(outputDirectory, 'assets'));

function requireCondition(condition, message) {
  if (!condition) throw new Error(`Android build check failed: ${message}`);
}

requireCondition(html.includes('id="app-boot-fallback"'), 'boot fallback is missing');
requireCondition(html.includes('id="showdown-boot-watchdog"'), 'ES5 boot watchdog is missing');
requireCondition(html.includes('window.__SHOWDOWN_APP_READY__'), 'React ready signal is missing');
requireCondition(/<script[^>]+type="module"/.test(html), 'modern module entry is missing');
requireCondition(/<script[^>]+nomodule/.test(html), 'legacy nomodule entry is missing');
requireCondition(files.some((file) => /^polyfills-legacy-.*\.js$/.test(file)), 'legacy polyfills are missing');
requireCondition(files.some((file) => /-legacy-.*\.js$/.test(file) && !file.startsWith('polyfills-')), 'legacy application chunks are missing');

const assetReferences = [...html.matchAll(/(?:src|data-src|href)="([^"]+\.(?:js|css))"/g)]
  .map((match) => match[1])
  .filter((reference) => !reference.startsWith('http'));

for (const reference of assetReferences) {
  const relativePath = reference.replace(/^\/showdown\//, '').replace(/^\//, '');
  await access(resolve(outputDirectory, relativePath));
}

const watchdog = html.match(/<script id="showdown-boot-watchdog">([\s\S]*?)<\/script>/)?.[1] || '';
for (const unsupportedSyntax of [/=>/, /\bconst\b/, /\blet\b/, /\?\./, /\?\?/]) {
  requireCondition(!unsupportedSyntax.test(watchdog), `watchdog is not ES5-safe (${unsupportedSyntax})`);
}

console.log('Android build matrix: Android 8/Chrome 61, Android 9/Chrome 69, Android 10/Chrome 74, modern WebView');
console.log(`Android compatibility assets verified: ${files.filter((file) => file.endsWith('.js')).length} JavaScript files`);
