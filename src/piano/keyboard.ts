// 88 touches : MIDI 21 (A0) -> MIDI 108 (C8)
export const FIRST_MIDI = 21;
export const LAST_MIDI = 108;

const BLACK_KEY_PATTERN = [
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

export function midiToNoteName(midi: number): string {
  const names = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
  return names[midi % 12];
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

export interface KeyGeometry {
  midi: number;
  isBlack: boolean;
  x: number;
  width: number;
}

export function computeKeyGeometry(canvasWidth: number): KeyGeometry[] {
  const whiteWidth = canvasWidth / TOTAL_WHITE_KEYS;
  const blackWidth = whiteWidth * 0.6;
  const result: KeyGeometry[] = [];

  let whiteIndex = 0;
  for (let midi = FIRST_MIDI; midi <= LAST_MIDI; midi++) {
    if (!isBlackKey(midi)) {
      result.push({ midi, isBlack: false, x: whiteIndex * whiteWidth, width: whiteWidth });
      whiteIndex++;
    }
  }
  for (let midi = FIRST_MIDI; midi <= LAST_MIDI; midi++) {
    if (isBlackKey(midi)) {
      const whitesBefore = countWhiteKeysBefore(midi);
      const centerX = whitesBefore * whiteWidth;
      result.push({ midi, isBlack: true, x: centerX - blackWidth / 2, width: blackWidth });
    }
  }
  return result;
}

export function noteCenterX(midi: number, canvasWidth: number): number {
  const whiteWidth = canvasWidth / TOTAL_WHITE_KEYS;
  if (isBlackKey(midi)) {
    return countWhiteKeysBefore(midi) * whiteWidth;
  }
  return countWhiteKeysBefore(midi) * whiteWidth + whiteWidth / 2;
}
