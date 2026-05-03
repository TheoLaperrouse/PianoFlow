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
const W = Q * 4;

// ---------------------------------------------------------------------------
// Au clair de la lune — couplet × 3, mélodie + basse simple
// ---------------------------------------------------------------------------
const auClairMelody: Array<[number, number]> = [
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
  [60, W],
];
const auClairBass: Array<[number, number]> = [
  [48, H],
  [48, H],
  [55, H],
  [52, H],
  [48, H],
  [52, H],
  [48, H],
  [48, H],
];

const auClairDeLaLune: Piece = {
  id: 'au-clair-de-la-lune',
  title: 'Au clair de la lune',
  composer: 'Traditionnel',
  bpm: 110,
  rightHand: melody(repeat(auClairMelody, 3), 0),
  leftHand: melody(repeat(auClairBass, 3), 0),
};

// ---------------------------------------------------------------------------
// Ode à la Joie — phrase A + B + reprise
// ---------------------------------------------------------------------------
const odeMelodyPhraseA: Array<[number, number]> = [
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
];
const odeMelodyPhraseB: Array<[number, number]> = [
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
  [62, Q + E],
  [60, E],
  [60, H],
];
const odeMelodyCoda: Array<[number, number]> = [
  [62, Q],
  [62, Q],
  [64, Q],
  [60, Q],
  [62, Q],
  [64, E],
  [65, E],
  [64, Q],
  [60, Q],
  [62, Q],
  [64, E],
  [65, E],
  [64, Q],
  [62, Q],
  [60, Q],
  [62, Q],
  [55, H],
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
  [62, Q + E],
  [60, E],
  [60, H],
];
const odeBassA: Array<[number, number]> = [
  [48, H],
  [52, H],
  [48, H],
  [55, H],
  [48, H],
  [52, H],
  [48, Q],
  [50, Q],
  [50, H],
];
const odeBassB: Array<[number, number]> = [
  [48, H],
  [52, H],
  [48, H],
  [55, H],
  [48, H],
  [52, H],
  [48, Q],
  [55, Q],
  [48, H],
];

const odeALaJoie: Piece = {
  id: 'ode-a-la-joie',
  title: 'Ode à la Joie',
  composer: 'L. van Beethoven',
  bpm: 120,
  rightHand: melody([...odeMelodyPhraseA, ...odeMelodyPhraseB, ...odeMelodyCoda], 0),
  leftHand: melody([...odeBassA, ...odeBassB, ...odeBassA, ...odeBassB], 0),
};

// ---------------------------------------------------------------------------
// Frère Jacques — canon à deux voix (deux passages)
// ---------------------------------------------------------------------------
const frereJacquesPhrase: Array<[number, number]> = [
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
  [67, E],
  [69, E],
  [67, E],
  [65, E],
  [64, Q],
  [60, Q],
  [67, E],
  [69, E],
  [67, E],
  [65, E],
  [64, Q],
  [60, Q],
  [60, Q],
  [55, Q],
  [60, H],
  [60, Q],
  [55, Q],
  [60, H],
];

const frereJacquesBass: Array<[number, number]> = [
  [48, H],
  [48, H],
  [48, H],
  [48, H],
  [48, Q],
  [52, Q],
  [55, H],
  [48, Q],
  [52, Q],
  [55, H],
  [48, H],
  [48, H],
  [48, H],
  [48, H],
  [48, Q],
  [55, Q],
  [48, H],
  [48, Q],
  [55, Q],
  [48, H],
];

const frereJacques: Piece = {
  id: 'frere-jacques',
  title: 'Frère Jacques',
  composer: 'Traditionnel',
  bpm: 110,
  rightHand: melody(repeat(frereJacquesPhrase, 2), 0),
  leftHand: melody(repeat(frereJacquesBass, 2), 0),
};

// ---------------------------------------------------------------------------
// Twinkle Twinkle Little Star — couplet complet
// ---------------------------------------------------------------------------
const twinkleMelody: Array<[number, number]> = [
  [60, Q],
  [60, Q],
  [67, Q],
  [67, Q],
  [69, Q],
  [69, Q],
  [67, H],
  [65, Q],
  [65, Q],
  [64, Q],
  [64, Q],
  [62, Q],
  [62, Q],
  [60, H],
  [67, Q],
  [67, Q],
  [65, Q],
  [65, Q],
  [64, Q],
  [64, Q],
  [62, H],
  [67, Q],
  [67, Q],
  [65, Q],
  [65, Q],
  [64, Q],
  [64, Q],
  [62, H],
  [60, Q],
  [60, Q],
  [67, Q],
  [67, Q],
  [69, Q],
  [69, Q],
  [67, H],
  [65, Q],
  [65, Q],
  [64, Q],
  [64, Q],
  [62, Q],
  [62, Q],
  [60, W],
];
const twinkleBass: Array<[number, number]> = [
  [48, H],
  [52, H],
  [53, H],
  [52, H],
  [53, H],
  [52, H],
  [50, H],
  [48, H],
  [52, H],
  [53, H],
  [52, H],
  [50, H],
  [52, H],
  [53, H],
  [52, H],
  [50, H],
  [48, H],
  [52, H],
  [53, H],
  [52, H],
  [53, H],
  [52, H],
  [50, H],
  [48, W],
];

const twinkle: Piece = {
  id: 'twinkle-twinkle',
  title: 'Ah! vous dirai-je, Maman',
  composer: 'Traditionnel',
  bpm: 110,
  rightHand: melody(twinkleMelody, 0),
  leftHand: melody(twinkleBass, 0),
};

// ---------------------------------------------------------------------------
// Greensleeves — un couplet complet en La mineur
// ---------------------------------------------------------------------------
const greensleevesMelody: Array<[number, number]> = [
  [69, Q],
  [72, Q + E],
  [74, E],
  [76, Q],
  [77, E],
  [76, E],
  [74, Q + E],
  [71, E],
  [67, Q],
  [69, E],
  [71, E],
  [72, Q + E],
  [69, E],
  [69, Q],
  [68, E],
  [69, E],
  [71, Q + E],
  [68, E],
  [65, Q + H],
  [69, Q],
  [72, Q + E],
  [74, E],
  [76, Q],
  [77, E],
  [76, E],
  [74, Q + E],
  [71, E],
  [67, Q],
  [69, E],
  [71, E],
  [72, Q + E],
  [71, E],
  [69, Q],
  [68, E],
  [66, E],
  [68, Q + E],
  [66, E],
  [65, Q + H],
  [76, Q + E],
  [76, E],
  [77, Q + H],
  [76, Q + E],
  [74, E],
  [71, Q],
  [67, E],
  [69, E],
  [71, Q + E],
  [72, E],
  [69, Q],
  [69, E],
  [68, E],
  [69, Q + E],
  [68, E],
  [65, Q + H],
];
const greensleevesBass: Array<[number, number]> = [
  [45, H + Q],
  [52, Q + H],
  [53, H + Q],
  [48, Q + H],
  [45, H + Q],
  [52, Q + H],
  [50, H + Q],
  [45, Q + H],
  [45, H + Q],
  [52, Q + H],
  [53, H + Q],
  [48, Q + H],
  [45, H + Q],
  [52, Q + H],
  [50, H + Q],
  [45, Q + H],
  [53, H + Q],
  [50, Q + H],
  [55, H + Q],
  [52, Q + H],
  [53, H + Q],
  [48, Q + H],
  [45, H + Q],
  [50, Q + H],
];

const greensleeves: Piece = {
  id: 'greensleeves',
  title: 'Greensleeves',
  composer: 'Traditionnel anglais',
  bpm: 90,
  rightHand: melody(greensleevesMelody, 0),
  leftHand: melody(greensleevesBass, 0),
};

// ---------------------------------------------------------------------------
// Canon de Pachelbel — progression D-A-Bm-F#m-G-D-G-A sur 4 boucles
// ---------------------------------------------------------------------------
const pachelbelMelodyPattern: Array<[number, number]> = [
  [74, H],
  [73, H],
  [71, H],
  [69, H],
  [67, H],
  [66, H],
  [67, H],
  [69, H],
  [74, Q],
  [73, Q],
  [71, Q],
  [69, Q],
  [67, Q],
  [66, Q],
  [67, Q],
  [69, Q],
  [71, Q],
  [69, Q],
  [71, Q],
  [73, Q],
  [74, H],
  [73, H],
];
const pachelbelBassPattern: Array<[number, number]> = [
  [50, W],
  [45, W],
  [47, W],
  [42, W],
  [43, W],
  [38, W],
  [43, W],
  [45, W],
];

const pachelbel: Piece = {
  id: 'canon-de-pachelbel',
  title: 'Canon en Ré',
  composer: 'J. Pachelbel',
  bpm: 70,
  rightHand: melody(repeat(pachelbelMelodyPattern, 2), 0),
  leftHand: melody(repeat(pachelbelBassPattern, 2), 0),
};

// ---------------------------------------------------------------------------
// Lettre à Élise (Beethoven) — début emblématique en La mineur
// ---------------------------------------------------------------------------
const fureliseMelody: Array<[number, number]> = [
  [76, E],
  [75, E],
  [76, E],
  [75, E],
  [76, E],
  [71, E],
  [74, E],
  [72, E],
  [69, E + Q],
  [60, E],
  [64, E],
  [69, E],
  [71, Q + E],
  [64, E],
  [68, E],
  [71, E],
  [72, Q + E],
  [64, E],
  [76, E],
  [75, E],
  [76, E],
  [75, E],
  [76, E],
  [71, E],
  [74, E],
  [72, E],
  [69, E + Q],
  [60, E],
  [64, E],
  [69, E],
  [71, Q + E],
  [64, E],
  [72, E],
  [71, E],
  [69, Q + E],
];
// Le « 0 » sert de silence : la fonction melody() avance bien le temps mais
// filterRests() retire ces faux notes.
const fureliseBass: Array<[number, number]> = [
  [0, 4 * Q], // intro : on laisse la main droite seule
  [45, E],
  [52, E],
  [57, E],
  [40, E],
  [56, E],
  [59, E],
  [45, E],
  [52, E],
  [57, E],
  [0, 4 * Q],
  [40, E],
  [52, E],
  [56, E],
  [45, E],
  [52, E],
  [57, E],
  [40, E],
  [52, E],
  [56, E],
];

const furelise: Piece = {
  id: 'lettre-a-elise',
  title: 'Lettre à Élise (extrait)',
  composer: 'L. van Beethoven',
  bpm: 90,
  rightHand: melody(fureliseMelody, 0),
  leftHand: filterRests(melody(fureliseBass, 0)),
};

const PIECES: Piece[] = [
  auClairDeLaLune,
  twinkle,
  frereJacques,
  odeALaJoie,
  greensleeves,
  pachelbel,
  furelise,
];

function repeat<T>(arr: T[], times: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < times; i++) out.push(...arr);
  return out;
}

function melody(input: Array<[number, number]>, startTime: number): Note[] {
  const result: Note[] = [];
  let t = startTime;
  for (const [midi, duration] of input) {
    result.push({ midi, time: t, duration: duration * 0.95 });
    t += duration;
  }
  return result;
}

// Petit utilitaire : on encode un silence en posant midi=0 ; on le filtre
// après calcul des temps pour conserver les positions correctes.
function filterRests(notes: Note[]): Note[] {
  return notes.filter((n) => n.midi > 0);
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
