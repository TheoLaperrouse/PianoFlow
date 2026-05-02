/**
 * Génère les variantes PNG du logo PianoFlow à partir de `public/icon.svg` :
 *  - icon-192.png      / icon-512.png      → manifest PWA
 *  - apple-touch-icon.png (180×180)        → écran d'accueil iOS
 *  - icon-maskable-512.png                 → variante avec safe-area pour Android
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SVG_PATH = resolve(ROOT, 'public/icon.svg');
const OUT_DIR = resolve(ROOT, 'public/icons');

interface Target {
  name: string;
  size: number;
  /** Marge intérieure (% de la dimension) pour les icônes maskable Android. */
  inset?: number;
}

const TARGETS: Target[] = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512, inset: 0.1 },
  { name: 'apple-touch-icon.png', size: 180 },
];

const svg = readFileSync(SVG_PATH);
mkdirSync(OUT_DIR, { recursive: true });

for (const target of TARGETS) {
  const innerSize = target.inset ? Math.round(target.size * (1 - 2 * target.inset)) : target.size;
  const padding = target.inset ? Math.round(target.size * target.inset) : 0;

  let pipeline = sharp(svg).resize(innerSize, innerSize);
  if (padding > 0) {
    pipeline = pipeline.extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 15, g: 13, b: 26, alpha: 1 },
    });
  }
  const buffer = await pipeline.png().toBuffer();
  writeFileSync(resolve(OUT_DIR, target.name), buffer);
  console.log(`✓ ${target.name} (${target.size}×${target.size})`);
}
