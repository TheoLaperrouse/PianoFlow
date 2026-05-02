import { PlaybackService } from '../application/PlaybackService';
import type { RendererPort } from '../application/ports/RendererPort';
import type { SongLibraryPort } from '../application/ports/SongLibraryPort';
import { RecordingService } from '../application/RecordingService';
import { TonePlayer } from '../infrastructure/audio/TonePlayer';
import { BundledSongLibrary } from '../infrastructure/library/BundledSongLibrary';
import { MidiSongParser } from '../infrastructure/parsing/MidiSongParser';
import { MediaRecorderAdapter } from '../infrastructure/recording/MediaRecorderAdapter';
import { CanvasRenderer } from '../infrastructure/rendering/CanvasRenderer';

/**
 * Composition root : seul endroit du code qui *connaît* à la fois les ports
 * et leurs adaptateurs concrets. Pour changer de moteur audio ou de parser,
 * c'est l'unique fichier à modifier.
 */
export interface AppContainer {
  playback: PlaybackService;
  library: SongLibraryPort;
  recording: RecordingService;
  createRenderer: (canvas: HTMLCanvasElement) => RendererPort;
}

export function createAppContainer(): AppContainer {
  const parser = new MidiSongParser();
  const player = new TonePlayer();
  const playback = new PlaybackService(parser, player);
  const library = new BundledSongLibrary();

  let activeRenderer: RendererPort | null = null;
  const recording = new RecordingService({
    playback,
    player,
    renderer: () => activeRenderer,
    recorder: new MediaRecorderAdapter(),
  });

  return {
    playback,
    library,
    recording,
    createRenderer: (canvas) => {
      activeRenderer = new CanvasRenderer(canvas);
      return activeRenderer;
    },
  };
}
