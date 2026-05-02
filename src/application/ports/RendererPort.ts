import type { Song } from '../../domain/Song';

/** État immuable décrivant *quoi* afficher à un instant donné. */
export interface RenderState {
  readonly song: Song | null;
  readonly currentTime: number;
  /** Fenêtre temporelle visible (secondes). Plus c'est grand, plus les notes tombent lentement. */
  readonly lookAhead: number;
}

/**
 * Port (driven) — moteur de rendu. Implémentations possibles :
 * Canvas 2D, WebGL, SVG, ou un magnétoscope offline pour l'export vidéo.
 */
export interface RendererPort {
  render(state: RenderState): void;
  /** À appeler quand la zone de rendu change de taille. */
  resize(): void;
  dispose(): void;
}
