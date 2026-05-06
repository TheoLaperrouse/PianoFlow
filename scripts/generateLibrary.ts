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

// ---------------------------------------------------------------------------
// Gymnopédie n°1 (Satie) — extrait simplifié, ré majeur, 3/4, lent (≈ 75 bpm).
// Bass alterne G majeur / D majeur sur tout le passage ; mélodie en main droite
// à partir de la 5e mesure.
// ---------------------------------------------------------------------------
function buildGymnopedie(): Piece {
  const speed = 1.6; // ramène le Q de référence (120 bpm) à ~75 bpm
  const Q1 = Q * speed;
  const H1 = Q1 * 2;
  const dottedH1 = Q1 * 3; // ronde pointée = 3 noires en 3/4
  const right: Note[] = [];
  const left: Note[] = [];

  // 12 mesures de basse en alternance G / D, le tout en 3/4.
  let lt = 0;
  for (let bar = 0; bar < 12; bar++) {
    if (bar % 2 === 0) {
      lt = pushNote(left, 43, lt, Q1); // G2
      lt = pushChord(left, [55, 59, 62], lt, H1); // G3-B3-D4
    } else {
      lt = pushNote(left, 50, lt, Q1); // D3
      lt = pushChord(left, [54, 57, 62], lt, H1); // F#3-A3-D4
    }
  }

  // Mesures 1-4 silencieuses côté main droite ; la mélodie démarre mesure 5.
  let rt = 4 * dottedH1;
  rt = pushNote(right, 78, rt, dottedH1); // F#5
  rt = pushNote(right, 79, rt, Q1); // G5
  rt = pushNote(right, 78, rt, Q1); // F#5
  rt = pushNote(right, 81, rt, Q1); // A5
  rt = pushNote(right, 83, rt, dottedH1); // B5
  rt = pushNote(right, 81, rt, Q1); // A5
  rt = pushNote(right, 78, rt, Q1); // F#5
  rt = pushNote(right, 74, rt, Q1); // D5
  rt = pushNote(right, 81, rt, dottedH1); // A5
  rt = pushNote(right, 79, rt, Q1); // G5
  rt = pushNote(right, 78, rt, Q1); // F#5
  rt = pushNote(right, 76, rt, Q1); // E5
  rt = pushNote(right, 78, rt, dottedH1); // F#5
  rt = pushNote(right, 74, rt, dottedH1); // D5 (résolution)

  return {
    id: 'gymnopedie-1',
    title: 'Gymnopédie n°1 (extrait simplifié)',
    composer: 'E. Satie',
    bpm: 75,
    rightHand: right,
    leftHand: left,
  };
}

// ---------------------------------------------------------------------------
// Sonate au Clair de Lune (Beethoven, op. 27 n°2, 1er mvt) — extrait simplifié.
// Do dièse mineur, 4/4, adagio sostenuto (≈ 60 bpm). On préserve l'identité
// rythmique : triolets de croches en main droite sur l'arpège C#m, basse en
// octave sur le 1er temps.
// ---------------------------------------------------------------------------
function buildMoonlightSonata(): Piece {
  const speed = 2.0; // ≈ 60 bpm
  const Q1 = Q * speed;
  const T1 = Q1 / 3; // triolet de croche : 3 par temps
  const W1 = Q1 * 4; // ronde = 1 mesure 4/4
  const right: Note[] = [];
  const left: Note[] = [];

  // 8 mesures. Basse descendante : C#-C#-B-B-A-A-G#-G# (octave en main gauche,
  // notation flottante au-dessus). L'arpège main droite suit C#m la plupart
  // du temps, avec des accords de passage qui colorent l'harmonie.
  // Triplets : G# - C# - E par défaut, ajustés pour suivre la basse.
  const bars: Array<{ bass: number; arp: number[] }> = [
    { bass: 37, arp: [56, 61, 64] }, // C#m : G#3-C#4-E4
    { bass: 37, arp: [56, 61, 64] },
    { bass: 35, arp: [56, 61, 64] }, // basse B1 sous C#m → 9e
    { bass: 35, arp: [56, 61, 64] },
    { bass: 33, arp: [57, 61, 64] }, // basse A1, A maj : A3-C#4-E4
    { bass: 33, arp: [57, 61, 64] },
    { bass: 32, arp: [56, 60, 63] }, // G#1, G# maj : G#3-B#3-D#4 (V/C#m)
    { bass: 32, arp: [56, 60, 63] },
  ];

  let rt = 0;
  let lt = 0;
  for (const { bass, arp } of bars) {
    pushChord(left, [bass, bass + 12], lt, W1); // octave de basse, 1 ronde
    lt += W1;
    // 4 groupes de 3 triolets dans la mesure
    for (let i = 0; i < 4; i++) {
      for (const m of arp) rt = pushNote(right, m, rt, T1);
    }
  }

  return {
    id: 'moonlight-sonata-1',
    title: 'Sonate au Clair de Lune (1er mvt, extrait)',
    composer: 'L. van Beethoven',
    bpm: 60,
    rightHand: right,
    leftHand: left,
  };
}

// ---------------------------------------------------------------------------
// Nocturne op. 9 n°2 (Chopin) — extrait simplifié. Mi♭ majeur, 12/8, andante
// (≈ 70 bpm). Mélodie cantabile en main droite, accompagnement valse 12/8 en
// main gauche : basse sur le 1er temps, accord sur les 2 doubles suivantes.
// ---------------------------------------------------------------------------
function buildNocturneOp9No2(): Piece {
  const speed = 1.7; // ≈ 70 bpm
  const Q1 = Q * speed;
  const E1 = Q1 / 2; // croche
  const dottedQ1 = Q1 * 1.5; // noire pointée = 1 temps en 12/8
  const right: Note[] = [];
  const left: Note[] = [];

  // Mesure 1 (E♭) : basse E♭2 + accord G3-B♭3-E♭4 deux fois (4 temps de 3/8)
  // On simplifie : oom-pa-pa pour chaque temps de la mesure.
  function bassPattern(start: number, bassMidi: number, chord: number[]): number {
    let t = start;
    // 4 temps en 12/8
    for (let i = 0; i < 4; i++) {
      t = pushNote(left, bassMidi, t, E1);
      t = pushChord(left, chord, t, E1);
      t = pushChord(left, chord, t, E1);
    }
    return t;
  }

  let lt = 0;
  // Progression : E♭ — B♭7 — E♭ — A♭ — E♭/G — A♭ — B♭7 — E♭
  lt = bassPattern(lt, 39, [55, 58, 63]); // E♭2 + G3-B♭3-E♭4
  lt = bassPattern(lt, 34, [53, 58, 60]); // B♭1 + F3-B♭3-D4 (B♭7 sans 7e)
  lt = bassPattern(lt, 39, [55, 58, 63]); // E♭ encore
  lt = bassPattern(lt, 32, [56, 60, 63]); // A♭1 + A♭3-C4-E♭4 (A♭ maj)

  // Mélodie main droite — phrase d'ouverture stylisée. Couleurs E♭ majeur.
  let rt = 0;
  // Mesure 1 : B♭4 (noire pointée), G4-F4-E♭4 (3 croches), F4 (Q.), B♭4-A♭4-G4 (3 cr.)
  rt = pushNote(right, 70, rt, dottedQ1); // B♭4
  rt = pushNote(right, 67, rt, E1); // G4
  rt = pushNote(right, 65, rt, E1); // F4
  rt = pushNote(right, 63, rt, E1); // E♭4
  rt = pushNote(right, 65, rt, dottedQ1); // F4
  rt = pushNote(right, 70, rt, E1); // B♭4
  rt = pushNote(right, 68, rt, E1); // A♭4
  rt = pushNote(right, 67, rt, E1); // G4
  // Mesure 2 : A♭4 (Q.), F4-E♭4-D4 (3 cr.), F4 (Q.), G4-F4-E♭4 (3 cr.)
  rt = pushNote(right, 68, rt, dottedQ1); // A♭4
  rt = pushNote(right, 65, rt, E1); // F4
  rt = pushNote(right, 63, rt, E1); // E♭4
  rt = pushNote(right, 62, rt, E1); // D4
  rt = pushNote(right, 65, rt, dottedQ1); // F4
  rt = pushNote(right, 67, rt, E1); // G4
  rt = pushNote(right, 65, rt, E1); // F4
  rt = pushNote(right, 63, rt, E1); // E♭4
  // Mesure 3 : reprise embellie de la mesure 1
  rt = pushNote(right, 70, rt, dottedQ1); // B♭4
  rt = pushNote(right, 72, rt, E1); // C5
  rt = pushNote(right, 70, rt, E1); // B♭4
  rt = pushNote(right, 67, rt, E1); // G4
  rt = pushNote(right, 75, rt, dottedQ1); // E♭5
  rt = pushNote(right, 74, rt, E1); // D5
  rt = pushNote(right, 72, rt, E1); // C5
  rt = pushNote(right, 70, rt, E1); // B♭4
  // Mesure 4 : descente résolutive vers E♭
  rt = pushNote(right, 70, rt, dottedQ1); // B♭4
  rt = pushNote(right, 68, rt, E1); // A♭4
  rt = pushNote(right, 67, rt, E1); // G4
  rt = pushNote(right, 65, rt, E1); // F4
  rt = pushNote(right, 63, rt, dottedQ1 * 2); // E♭4 (résolution longue)

  return {
    id: 'nocturne-op9-2',
    title: 'Nocturne op. 9 n°2 (extrait simplifié)',
    composer: 'F. Chopin',
    bpm: 70,
    rightHand: right,
    leftHand: left,
  };
}

// ---------------------------------------------------------------------------
// Clair de Lune (Debussy, 3e mvt de la Suite bergamasque) — extrait simplifié.
// Ré♭ majeur, 9/8, andante très expressif (≈ 60 bpm). Mélodie au sommet en
// main droite, accompagnement harmonique en main gauche. La pièce d'origine
// est complexe (octaves doublées, harmonies riches) ; on garde ici un
// squelette mélodique reconnaissable et une basse simple.
// ---------------------------------------------------------------------------
function buildClairDeLune(): Piece {
  const speed = 2.0; // ≈ 60 bpm
  const E1 = (Q * speed) / 2; // croche
  const Q1 = Q * speed;
  const dottedQ1 = Q1 * 1.5; // noire pointée = 1 temps en 9/8
  const right: Note[] = [];
  const left: Note[] = [];

  // 4 mesures de mélodie en ré♭ majeur. Main droite seule au début (mes. 1-2),
  // basse qui rejoint en mes. 3.
  let rt = 0;

  // Mesure 1 : F4 (Q.), F4-E♭4-D♭4 (3 cr.), F4 (Q.)
  rt = pushNote(right, 65, rt, dottedQ1); // F4
  rt = pushNote(right, 65, rt, E1); // F4
  rt = pushNote(right, 63, rt, E1); // E♭4
  rt = pushNote(right, 61, rt, E1); // D♭4
  rt = pushNote(right, 65, rt, dottedQ1); // F4
  // Mesure 2 : A♭4 (Q.), G4-F4-E♭4 (3 cr.), C5 (Q.)
  rt = pushNote(right, 68, rt, dottedQ1); // A♭4
  rt = pushNote(right, 67, rt, E1); // G4
  rt = pushNote(right, 65, rt, E1); // F4
  rt = pushNote(right, 63, rt, E1); // E♭4
  rt = pushNote(right, 72, rt, dottedQ1); // C5
  // Mesure 3 : D♭5 (Q.), C5-B♭4-A♭4 (3 cr.), F4 (Q.)
  rt = pushNote(right, 73, rt, dottedQ1); // D♭5
  rt = pushNote(right, 72, rt, E1); // C5
  rt = pushNote(right, 70, rt, E1); // B♭4
  rt = pushNote(right, 68, rt, E1); // A♭4
  rt = pushNote(right, 65, rt, dottedQ1); // F4
  // Mesure 4 : descente résolutive A♭4 - G4 - F4 - E♭4 - D♭4 (long)
  rt = pushNote(right, 68, rt, E1);
  rt = pushNote(right, 67, rt, E1);
  rt = pushNote(right, 65, rt, E1);
  rt = pushNote(right, 63, rt, dottedQ1);
  rt = pushNote(right, 61, rt, dottedQ1); // D♭4 (résolution)

  // Main gauche : démarre mesure 3 avec accords ré♭ majeur arpégés en
  // accompagnement.
  let lt = 2 * dottedQ1 * 3; // 2 mesures en 9/8 silencieuses (3 temps × 2)
  // Mesure 3 : D♭2 + A♭2 + D♭3 + F3 (arpège en croches sur les 3 temps)
  for (let beat = 0; beat < 3; beat++) {
    lt = pushNote(left, 37, lt, E1); // D♭2
    lt = pushNote(left, 44, lt, E1); // A♭2
    lt = pushNote(left, 49, lt, E1); // D♭3
  }
  // Mesure 4 : A♭1 + E♭3 + A♭3 + C4 puis D♭ pour résolution
  for (let beat = 0; beat < 2; beat++) {
    lt = pushNote(left, 32, lt, E1); // A♭1
    lt = pushNote(left, 51, lt, E1); // E♭3
    lt = pushNote(left, 56, lt, E1); // A♭3
  }
  // Dernier temps : D♭ pédale longue
  lt = pushChord(left, [37, 44], lt, dottedQ1 * 1.5); // D♭2 + A♭2 sustained

  return {
    id: 'clair-de-lune',
    title: 'Clair de Lune (extrait simplifié)',
    composer: 'C. Debussy',
    bpm: 60,
    rightHand: right,
    leftHand: left,
  };
}

const PIECES: Piece[] = [
  furelise,
  buildGymnopedie(),
  buildMoonlightSonata(),
  buildNocturneOp9No2(),
  buildClairDeLune(),
];

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

// Helpers pour les pièces qui ont besoin d'accords (notes simultanées) ou
// d'un tempo plus lent que 120 bpm de référence : on construit un Note[]
// en append à la main, en avançant un curseur de temps.
function pushNote(target: Note[], midi: number, t: number, duration: number): number {
  if (midi > 0) target.push({ midi, time: t, duration: duration * 0.95 });
  return t + duration;
}

function pushChord(target: Note[], midis: number[], t: number, duration: number): number {
  for (const m of midis) {
    if (m > 0) target.push({ midi: m, time: t, duration: duration * 0.95 });
  }
  return t + duration;
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
