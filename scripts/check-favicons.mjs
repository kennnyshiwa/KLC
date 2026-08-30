import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve('dist');
const html = await readFile(resolve(outputDirectory, 'index.html'), 'utf8');
const iconReferences = [...html.matchAll(/<link\b[^>]*\brel=["'](?:icon|apple-touch-icon)["'][^>]*\bhref=["']([^"']+)["'][^>]*>/g)]
  .map((match) => match[1]);

if (iconReferences.length === 0) {
  throw new Error('Built index.html does not declare any favicon assets.');
}

const requiredReferences = [
  '/icons/40s-logo.svg',
  '/apple-touch-icon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
];

for (const reference of requiredReferences) {
  if (!iconReferences.includes(reference)) {
    throw new Error(`Built index.html does not reference ${reference}.`);
  }
}

for (const reference of [...iconReferences, '/favicon.ico']) {
  const outputPath = resolve(outputDirectory, reference.replace(/^\//, ''));
  await access(outputPath);
  console.log(`favicon asset present: ${reference}`);
}
