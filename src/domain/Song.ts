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
