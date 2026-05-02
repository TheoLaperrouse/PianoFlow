import type { Song } from '../../domain/Song';

/**
 * Port (driven) — moteur de restitution sonore d'un Song.
 * Implémentations possibles : Tone.js, WebAudio brut, échantillonneur Salamander…
 */
export interface AudioPlayerPort {
  load(song: Song): void;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  setRate(rate: number): void;
  /** Position courante dans le morceau, en secondes (échelle musique). */
  getCurrentTime(): number;
  isPlaying(): boolean;
  dispose(): void;
}
