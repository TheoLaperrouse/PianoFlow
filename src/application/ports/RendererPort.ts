import type { Song } from '../../domain/Song';

/** Plage de touches MIDI affichées. `null` = clavier complet (88 touches). */
export interface KeyRange {
  readonly firstMidi: number;
  readonly lastMidi: number;
}

/** État immuable décrivant *quoi* afficher à un instant donné. */
export interface RenderState {
  readonly song: Song | null;
  readonly currentTime: number;
  /** Fenêtre temporelle visible (secondes). Plus c'est grand, plus les notes tombent lentement. */
  readonly lookAhead: number;
  /** Restreint le clavier visible à une plage. `null` ou absent = 88 touches. */
  readonly keyRange?: KeyRange | null;
}

/**
 * Port (driven) — moteur de rendu. Implémentations possibles :
 * Canvas 2D, WebGL, SVG, ou un magnétoscope offline pour l'export vidéo.
 */
export interface RendererPort {
  render(state: RenderState): void;
  /** À appeler quand la zone de rendu change de taille. */
  resize(): void;
  /** Flux vidéo destiné à un enregistreur (export vidéo). */
  captureStream(fps: number): MediaStream;
  dispose(): void;
}
