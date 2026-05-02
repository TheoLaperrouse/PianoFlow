import { PlaybackService } from '../application/PlaybackService';
import type { RendererPort } from '../application/ports/RendererPort';
import { TonePlayer } from '../infrastructure/audio/TonePlayer';
import { MidiSongParser } from '../infrastructure/parsing/MidiSongParser';
import { CanvasRenderer } from '../infrastructure/rendering/CanvasRenderer';

/**
 * Composition root : seul endroit du code qui *connaît* à la fois les ports
 * et leurs adaptateurs concrets. Pour changer de moteur audio ou de parser,
 * c'est l'unique fichier à modifier.
 */
export interface AppContainer {
  playback: PlaybackService;
  createRenderer: (canvas: HTMLCanvasElement) => RendererPort;
}

export function createAppContainer(): AppContainer {
  const parser = new MidiSongParser();
  const player = new TonePlayer();
  const playback = new PlaybackService(parser, player);

  return {
    playback,
    createRenderer: (canvas) => new CanvasRenderer(canvas),
  };
}
