import type { Hand } from './Hand';

/**
 * Note de piano du domaine — agrégat immuable, indépendant de tout format
 * d'entrée (MIDI, MusicXML, audio…) ou de tout moteur de rendu.
 */
export interface PianoNote {
  /** Numéro MIDI (21 = A0, 108 = C8). */
  readonly midi: number;
  /** Position dans le morceau, en secondes. */
  readonly time: number;
  /** Durée jouée, en secondes. */
  readonly duration: number;
  /** Vélocité normalisée 0..1. */
  readonly velocity: number;
  readonly hand: Hand;
}

export function endTime(note: PianoNote): number {
  return note.time + note.duration;
}

export function isActiveAt(note: PianoNote, time: number): boolean {
  return note.time <= time && endTime(note) >= time;
}

export function isVisibleInWindow(note: PianoNote, from: number, to: number): boolean {
  return endTime(note) >= from && note.time <= to;
}
