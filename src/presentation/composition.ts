import { PlaybackService } from '../application/PlaybackService';
import { PracticeService } from '../application/PracticeService';
import type { MidiInputPort } from '../application/ports/MidiInputPort';
import type { RendererPort } from '../application/ports/RendererPort';
import type { SongLibraryPort } from '../application/ports/SongLibraryPort';
import { RecordingService } from '../application/RecordingService';
import { TonePlayer } from '../infrastructure/audio/TonePlayer';
import { WebMidiInputAdapter } from '../infrastructure/input/WebMidiInputAdapter';
import { BundledSongLibrary } from '../infrastructure/library/BundledSongLibrary';
import { BasicPitchAudioParser } from '../infrastructure/parsing/BasicPitchAudioParser';
import { CompositeSongParser } from '../infrastructure/parsing/CompositeSongParser';
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
  practice: PracticeService;
  midiInput: MidiInputPort;
  createRenderer: (canvas: HTMLCanvasElement) => RendererPort;
}

export function createAppContainer(): AppContainer {
  const midiParser = new MidiSongParser();
  const audioParser = new BasicPitchAudioParser();
  const parser = new CompositeSongParser({
    mid: midiParser,
    midi: midiParser,
    mp3: audioParser,
    wav: audioParser,
    ogg: audioParser,
    flac: audioParser,
  });
  const player = new TonePlayer();
  const playback = new PlaybackService(parser, player);
  const library = new BundledSongLibrary();
  const midiInput = new WebMidiInputAdapter();
  const practice = new PracticeService(player, midiInput);

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
    practice,
    midiInput,
    createRenderer: (canvas) => {
      activeRenderer = new CanvasRenderer(canvas);
      return activeRenderer;
    },
  };
}
