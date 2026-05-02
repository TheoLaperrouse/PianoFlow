/**
 * Script Node : génère les fichiers MIDI de la bibliothèque de démo.
 * Lancé via `yarn library:gen`. Les pièces choisies sont du domaine public.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '@tonejs/midi';

const { Midi } = pkg;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'public/library');

interface ManifestEntry {
  id: string;
  title: string;
  composer?: string;
  file: string;
}

interface Note {
  midi: number;
  time: number;
  duration: number;
}

interface Piece {
  id: string;
  title: string;
  composer?: string;
  bpm: number;
  rightHand: Note[];
  leftHand: Note[];
}

const Q = 0.5; // durée d'une noire à 120 bpm en secondes
const E = Q / 2;
const H = Q * 2;

// Au clair de la lune (mélodie main droite, basse simple main gauche)
const auClairDeLaLune: Piece = {
  id: 'au-clair-de-la-lune',
  title: 'Au clair de la lune',
  composer: 'Traditionnel',
  bpm: 120,
  rightHand: melody(
    [
      [60, Q],
      [60, Q],
      [60, Q],
      [62, Q],
      [64, H],
      [62, H],
      [60, Q],
      [64, Q],
      [62, Q],
      [62, Q],
      [60, H],
    ],
    0,
  ),
  leftHand: melody(
    [
      [48, H],
      [48, H],
      [55, H],
      [55, H],
      [48, H],
      [48, H],
      [48, H],
      [48, H],
    ],
    0,
  ),
};

// Ode à la Joie (Beethoven, mélodie principale)
const odeALaJoie: Piece = {
  id: 'ode-a-la-joie',
  title: 'Ode à la Joie',
  composer: 'L. van Beethoven',
  bpm: 120,
  rightHand: melody(
    [
      [64, Q],
      [64, Q],
      [65, Q],
      [67, Q],
      [67, Q],
      [65, Q],
      [64, Q],
      [62, Q],
      [60, Q],
      [60, Q],
      [62, Q],
      [64, Q],
      [64, Q + E],
      [62, E],
      [62, H],
    ],
    0,
  ),
  leftHand: melody(
    [
      [48, H],
      [52, H],
      [48, H],
      [55, H],
      [48, H],
      [52, H],
      [48, H],
      [50, H],
    ],
    0,
  ),
};

// Frère Jacques (canon, mélodie main droite)
const frereJacques: Piece = {
  id: 'frere-jacques',
  title: 'Frère Jacques',
  composer: 'Traditionnel',
  bpm: 120,
  rightHand: melody(
    [
      [60, Q],
      [62, Q],
      [64, Q],
      [60, Q],
      [60, Q],
      [62, Q],
      [64, Q],
      [60, Q],
      [64, Q],
      [65, Q],
      [67, H],
      [64, Q],
      [65, Q],
      [67, H],
    ],
    0,
  ),
  leftHand: melody(
    [
      [48, H],
      [48, H],
      [48, H],
      [48, H],
      [48, H],
      [48, H],
      [48, H],
      [48, H],
    ],
    0,
  ),
};

const PIECES: Piece[] = [auClairDeLaLune, odeALaJoie, frereJacques];

function melody(input: Array<[number, number]>, startTime: number): Note[] {
  const result: Note[] = [];
  let t = startTime;
  for (const [midi, duration] of input) {
    result.push({ midi, time: t, duration: duration * 0.95 });
    t += duration;
  }
  return result;
}

function buildMidi(piece: Piece): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(piece.bpm);

  const right = midi.addTrack();
  right.name = 'Right Hand';
  for (const n of piece.rightHand) {
    right.addNote({ midi: n.midi, time: n.time, duration: n.duration, velocity: 0.8 });
  }

  const left = midi.addTrack();
  left.name = 'Left Hand';
  for (const n of piece.leftHand) {
    left.addNote({ midi: n.midi, time: n.time, duration: n.duration, velocity: 0.7 });
  }

  return midi.toArray();
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const manifest: { entries: ManifestEntry[] } = { entries: [] };

  for (const piece of PIECES) {
    const file = `${piece.id}.mid`;
    const bytes = buildMidi(piece);
    writeFileSync(resolve(OUT_DIR, file), bytes);
    manifest.entries.push({ id: piece.id, title: piece.title, composer: piece.composer, file });
    console.log(`✓ ${file}`);
  }

  writeFileSync(resolve(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`✓ manifest.json (${PIECES.length} entrées)`);
}

main();
