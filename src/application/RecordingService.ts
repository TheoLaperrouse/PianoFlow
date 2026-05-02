import type { PlaybackService } from './PlaybackService';
import type { AudioPlayerPort } from './ports/AudioPlayerPort';
import type { RendererPort } from './ports/RendererPort';
import type { VideoRecorderPort } from './ports/VideoRecorderPort';

const VIDEO_FPS = 60;

/**
 * Use case applicatif : enregistre un export vidéo du morceau courant.
 *
 * Combine le flux du renderer (image) et celui du player (son) en un seul
 * MediaStream confié à l'enregistreur. Aucune notion de Canvas ou de
 * MediaRecorder ici — uniquement les ports.
 */
export class RecordingService {
  private readonly playback: PlaybackService;
  private readonly player: AudioPlayerPort;
  private readonly renderer: () => RendererPort | null;
  private readonly recorder: VideoRecorderPort;

  constructor(deps: {
    playback: PlaybackService;
    player: AudioPlayerPort;
    renderer: () => RendererPort | null;
    recorder: VideoRecorderPort;
  }) {
    this.playback = deps.playback;
    this.player = deps.player;
    this.renderer = deps.renderer;
    this.recorder = deps.recorder;
  }

  /**
   * Joue le morceau du début à la fin tout en l'enregistrant. Résout avec le
   * Blob vidéo. Si la lecture est en cours, elle est d'abord arrêtée et
   * remise au début.
   */
  async record(): Promise<Blob> {
    const renderer = this.renderer();
    const song = this.playback.getCurrentSong();
    if (!renderer || !song) throw new Error('Aucun morceau chargé');
    if (this.recorder.isRecording()) throw new Error('Un enregistrement est déjà en cours');

    this.playback.restart();

    const videoStream = renderer.captureStream(VIDEO_FPS);
    const audioStream = this.player.captureStream();
    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioStream.getAudioTracks(),
    ]);

    this.recorder.start(combined);
    await this.playback.play();

    await waitUntilEndOfSong(this.playback, song.duration);

    this.playback.pause();
    return this.recorder.stop();
  }

  isRecording(): boolean {
    return this.recorder.isRecording();
  }
}

function waitUntilEndOfSong(playback: PlaybackService, duration: number): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (!playback.isPlaying() || playback.getCurrentTime() >= duration + 0.5) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
