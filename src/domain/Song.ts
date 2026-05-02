import type { PianoNote } from './PianoNote';
import { endTime } from './PianoNote';

/**
 * Agrégat « morceau » du domaine. Un Song est une collection ordonnée de notes
 * et un nom. La durée est dérivée des notes.
 */
export interface Song {
  readonly name: string;
  readonly notes: readonly PianoNote[];
  readonly duration: number;
}

export function createSong(name: string, notes: PianoNote[]): Song {
  const sorted = [...notes].sort((a, b) => a.time - b.time);
  const duration = sorted.reduce((max, n) => Math.max(max, endTime(n)), 0);
  return { name, notes: sorted, duration };
}

/**
 * Plage MIDI couverte par le morceau, étendue de `padding` touches blanches
 * de chaque côté pour donner un peu d'air visuel. Utile pour ajuster la
 * largeur du clavier sur les petits écrans (88 touches sur un téléphone
 * sont inutilisables).
 */
export function songKeyRange(
  song: Song,
  padding = 2,
): { firstMidi: number; lastMidi: number } | null {
  if (song.notes.length === 0) return null;
  let lo = song.notes[0].midi;
  let hi = lo;
  for (const n of song.notes) {
    if (n.midi < lo) lo = n.midi;
    if (n.midi > hi) hi = n.midi;
  }
  return {
    firstMidi: Math.max(21, lo - padding),
    lastMidi: Math.min(108, hi + padding),
  };
}
