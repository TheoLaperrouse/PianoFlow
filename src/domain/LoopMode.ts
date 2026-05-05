/**
 * Trois comportements possibles à la fin d'un morceau :
 * - off : on s'arrête au début (auto-rewind sans relance)
 * - song : on rejoue le même morceau en boucle
 * - playlist : on enchaîne sur le morceau suivant de la bibliothèque,
 *              en rebouclant au début quand on dépasse la fin de la liste
 */
export type LoopMode = 'off' | 'song' | 'playlist';

export const LOOP_MODES: readonly LoopMode[] = ['off', 'song', 'playlist'] as const;

export function nextLoopMode(mode: LoopMode): LoopMode {
  const i = LOOP_MODES.indexOf(mode);
  return LOOP_MODES[(i + 1) % LOOP_MODES.length];
}
