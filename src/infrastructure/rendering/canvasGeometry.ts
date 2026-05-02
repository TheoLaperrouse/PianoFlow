import {
  countWhiteKeysBefore,
  FIRST_MIDI,
  isBlackKey,
  LAST_MIDI,
  TOTAL_WHITE_KEYS,
} from '../../domain/Keyboard';

/**
 * Adaptateur de géométrie : projette le clavier du domaine en coordonnées
 * pixel pour un canvas de largeur donnée. Cette responsabilité (mapping
 * domaine → pixel) appartient à l'infrastructure de rendu, pas au domaine.
 */
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
