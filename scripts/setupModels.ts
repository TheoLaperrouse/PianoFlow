/**
 * Copie les fichiers de modèle ML utilisés par les adaptateurs d'infrastructure
 * vers `public/` afin qu'ils soient servis statiquement par Vite.
 *
 * Lancé via `yarn setup:models` (et automatiquement via `postinstall`).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface ModelCopy {
  source: string;
  destination: string;
  label: string;
}

const COPIES: ModelCopy[] = [
  {
    source: resolve(ROOT, 'node_modules/@spotify/basic-pitch/model'),
    destination: resolve(ROOT, 'public/models/basic-pitch'),
    label: 'basic-pitch',
  },
];

for (const { source, destination, label } of COPIES) {
  if (!existsSync(source)) {
    console.warn(`⚠️  ${label} : source absente (${source}) — skip`);
    continue;
  }
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source)) {
    copyFileSync(resolve(source, entry), resolve(destination, entry));
  }
  console.log(`✓ ${label} → public/models/basic-pitch`);
}
