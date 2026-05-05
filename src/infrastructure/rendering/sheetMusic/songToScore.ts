import type { PianoNote } from '../../../domain/PianoNote';
import type { Song } from '../../../domain/Song';

/**
 * Représentation intermédiaire d'un événement musical : un accord (1+ notes
 * jouées simultanément) sur l'une des deux portées. Indépendant de VexFlow.
 */
export interface ScoreEvent {
  /** Position dans le morceau (secondes). */
  readonly time: number;
  /** Notes MIDI jouées simultanément (chord). */
  readonly midis: readonly number[];
  /** Code de durée VexFlow : 'w', 'h', 'q', '8', '16'. */
  readonly duration: VexDuration;
}

export interface ScoreData {
  readonly treble: readonly ScoreEvent[];
  readonly bass: readonly ScoreEvent[];
}

export type VexDuration = 'w' | 'h' | 'q' | '8' | '16';

/** Limite haute du clavier : ce qui passe en clé de sol vs clé de fa. */
const HAND_SPLIT_MIDI = 60; // C4 (do central)
/** Tolérance pour considérer deux notes comme jouées simultanément (en sec). */
const CHORD_EPSILON = 0.04;
/** Tempo de référence pour la quantification. */
const QUARTER_SEC = 0.5; // 120 BPM

const DURATION_BUCKETS: ReadonlyArray<{ sec: number; code: VexDuration }> = [
  { sec: QUARTER_SEC * 4, code: 'w' },
  { sec: QUARTER_SEC * 2, code: 'h' },
  { sec: QUARTER_SEC * 1, code: 'q' },
  { sec: QUARTER_SEC * 0.5, code: '8' },
  { sec: QUARTER_SEC * 0.25, code: '16' },
];

/**
 * Convertit un Song en deux séquences d'événements (clé de sol + clé de fa).
 * Les notes simultanées (à <40 ms) sont regroupées en accords. La durée
 * notée correspond à l'écart au prochain événement, arrondie à la valeur
 * standard la plus proche (entre la triple-croche et la ronde).
 *
 * NB : on ne calque pas le tempo réel du morceau — tout est noté à 120 BPM
 * (q = 0.5 s) pour rester simple en V1. Les écarts trop éloignés des valeurs
 * canoniques sont arrondis à la durée la plus proche.
 */
export function songToScore(song: Song): ScoreData {
  const treble = song.notes.filter((n) => n.midi >= HAND_SPLIT_MIDI);
  const bass = song.notes.filter((n) => n.midi < HAND_SPLIT_MIDI);
  return {
    treble: buildHandEvents(treble),
    bass: buildHandEvents(bass),
  };
}

function buildHandEvents(notes: readonly PianoNote[]): ScoreEvent[] {
  if (notes.length === 0) return [];
  const sorted = [...notes].sort((a, b) => a.time - b.time);

  // Regroupement par accord : tant que la note suivante est dans la fenêtre
  // CHORD_EPSILON, on l'agrège à l'événement courant.
  const groups: { time: number; midis: number[] }[] = [];
  let current: { time: number; midis: number[] } = {
    time: sorted[0].time,
    midis: [sorted[0].midi],
  };
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i];
    if (n.time - current.time <= CHORD_EPSILON) {
      if (!current.midis.includes(n.midi)) current.midis.push(n.midi);
    } else {
      groups.push(current);
      current = { time: n.time, midis: [n.midi] };
    }
  }
  groups.push(current);

  // Calcul de la durée de chaque événement = écart au suivant, arrondi à la
  // valeur de note la plus proche dans DURATION_BUCKETS.
  const events: ScoreEvent[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const nextTime = i + 1 < groups.length ? groups[i + 1].time : g.time + QUARTER_SEC;
    const gap = Math.max(QUARTER_SEC * 0.25, nextTime - g.time);
    events.push({ time: g.time, midis: g.midis, duration: nearestDuration(gap) });
  }
  return events;
}

function nearestDuration(sec: number): VexDuration {
  let best = DURATION_BUCKETS[0];
  let bestDelta = Math.abs(Math.log2(sec / best.sec));
  for (let i = 1; i < DURATION_BUCKETS.length; i++) {
    const b = DURATION_BUCKETS[i];
    const d = Math.abs(Math.log2(sec / b.sec));
    if (d < bestDelta) {
      best = b;
      bestDelta = d;
    }
  }
  return best.code;
}

const PITCH_NAMES: readonly string[] = [
  'c',
  'c#',
  'd',
  'd#',
  'e',
  'f',
  'f#',
  'g',
  'g#',
  'a',
  'a#',
  'b',
];

/** Convertit un MIDI en clé VexFlow (ex : 60 → "c/4", 61 → "c#/4"). */
export function midiToVexKey(midi: number): string {
  const name = PITCH_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}/${octave}`;
}
