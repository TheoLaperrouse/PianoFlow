import { FIRST_MIDI, isBlackKey, LAST_MIDI } from '../../domain/Keyboard';

/**
 * Adaptateur de géométrie : projette le clavier du domaine en coordonnées
 * pixel pour un canvas de largeur donnée. Cette responsabilité (mapping
 * domaine → pixel) appartient à l'infrastructure de rendu, pas au domaine.
 *
 * Un `KeyboardLayout` pré-calcule la position et la largeur de chaque
 * touche pour une plage MIDI donnée — utile pour réutiliser le même
 * mapping pour les notes qui tombent et pour le clavier lui-même.
 */
export interface KeyGeometry {
  midi: number;
  isBlack: boolean;
  x: number;
  width: number;
}

export interface KeyboardLayout {
  readonly firstMidi: number;
  readonly lastMidi: number;
  readonly whiteWidth: number;
  readonly blackWidth: number;
  readonly keys: KeyGeometry[];
}

/**
 * Construit le layout pour la plage demandée (par défaut : 88 touches).
 * Les valeurs hors range sont serrées entre A0 (21) et C8 (108).
 */
export function computeKeyboardLayout(
  canvasWidth: number,
  firstMidi: number = FIRST_MIDI,
  lastMidi: number = LAST_MIDI,
): KeyboardLayout {
  const lo = Math.max(FIRST_MIDI, Math.min(LAST_MIDI, firstMidi));
  const hi = Math.max(FIRST_MIDI, Math.min(LAST_MIDI, lastMidi));
  const start = Math.min(lo, hi);
  const end = Math.max(lo, hi);

  let whiteCount = 0;
  for (let m = start; m <= end; m++) if (!isBlackKey(m)) whiteCount++;
  // Si on a démarré sur une noire (ne devrait pas arriver pour A0/C, mais
  // par sécurité), on ajoute la blanche manquante.
  whiteCount = Math.max(1, whiteCount);

  const whiteWidth = canvasWidth / whiteCount;
  const blackWidth = whiteWidth * 0.6;
  const keys: KeyGeometry[] = [];

  let whiteIndex = 0;
  for (let midi = start; midi <= end; midi++) {
    if (!isBlackKey(midi)) {
      keys.push({ midi, isBlack: false, x: whiteIndex * whiteWidth, width: whiteWidth });
      whiteIndex++;
    }
  }
  // Position de chaque noire = aligne sur la frontière de la blanche précédente
  for (let midi = start; midi <= end; midi++) {
    if (!isBlackKey(midi)) continue;
    const whitesBefore = countWhiteKeysInRange(start, midi);
    const centerX = whitesBefore * whiteWidth;
    keys.push({ midi, isBlack: true, x: centerX - blackWidth / 2, width: blackWidth });
  }

  return { firstMidi: start, lastMidi: end, whiteWidth, blackWidth, keys };
}

export function noteCenterX(midi: number, layout: KeyboardLayout): number {
  if (isBlackKey(midi)) {
    return countWhiteKeysInRange(layout.firstMidi, midi) * layout.whiteWidth;
  }
  return countWhiteKeysInRange(layout.firstMidi, midi) * layout.whiteWidth + layout.whiteWidth / 2;
}

function countWhiteKeysInRange(start: number, midi: number): number {
  let count = 0;
  for (let m = start; m < midi; m++) {
    if (!isBlackKey(m)) count++;
  }
  return count;
}
