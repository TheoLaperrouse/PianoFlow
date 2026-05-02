/**
 * Modèle pur du clavier de piano 88 touches (A0 = MIDI 21 → C8 = MIDI 108).
 * Aucune notion de pixel ou de canvas ici : uniquement la topologie musicale.
 */

export const FIRST_MIDI = 21;
export const LAST_MIDI = 108;

const BLACK_KEY_PATTERN: readonly boolean[] = [
  false,
  true,
  false,
  true,
  false,
  false,
  true,
  false,
  true,
  false,
  true,
  false,
];

export function isBlackKey(midi: number): boolean {
  return BLACK_KEY_PATTERN[midi % 12];
}

export function isInRange(midi: number): boolean {
  return midi >= FIRST_MIDI && midi <= LAST_MIDI;
}

export function midiToNoteName(midi: number): string {
  const names = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
  return names[midi % 12];
}

export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

export function countWhiteKeysBefore(midi: number): number {
  let count = 0;
  for (let m = FIRST_MIDI; m < midi; m++) {
    if (!isBlackKey(m)) count++;
  }
  return count;
}

export const TOTAL_WHITE_KEYS = (() => {
  let n = 0;
  for (let m = FIRST_MIDI; m <= LAST_MIDI; m++) if (!isBlackKey(m)) n++;
  return n;
})();
