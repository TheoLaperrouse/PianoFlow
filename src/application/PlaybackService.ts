import type { Song } from '../domain/Song';
import type { AudioPlayerPort } from './ports/AudioPlayerPort';
import type { SongParserPort } from './ports/SongParserPort';
import type { WakeLockPort } from './ports/WakeLockPort';

/**
 * Use case applicatif. Orchestre le parsing d'un fichier source et le contrôle
 * de la lecture audio. Aucune dépendance technique : les ports sont injectés.
 *
 * Les vues (Vue/React/CLI…) consomment uniquement cette façade.
 */
export class PlaybackService {
  private readonly parser: SongParserPort;
  private readonly player: AudioPlayerPort;
  private readonly wakeLock: WakeLockPort | null;
  private current: Song | null = null;

  constructor(
    parser: SongParserPort,
    player: AudioPlayerPort,
    wakeLock: WakeLockPort | null = null,
  ) {
    this.parser = parser;
    this.player = player;
    this.wakeLock = wakeLock;
  }

  async loadFromFile(file: File): Promise<Song> {
    this.player.stop();
    void this.wakeLock?.release();
    const song = await this.parser.parse(file);
    this.player.load(song);
    this.current = song;
    return song;
  }

  getCurrentSong(): Song | null {
    return this.current;
  }

  async play(): Promise<void> {
    await this.player.play();
    void this.wakeLock?.acquire();
  }

  pause(): void {
    this.player.pause();
    void this.wakeLock?.release();
  }

  restart(): void {
    this.player.stop();
    void this.wakeLock?.release();
  }

  setRate(rate: number): void {
    this.player.setRate(rate);
  }

  getCurrentTime(): number {
    return this.player.getCurrentTime();
  }

  isPlaying(): boolean {
    return this.player.isPlaying();
  }

  isInstrumentReady(): boolean {
    return this.player.isReady();
  }

  whenInstrumentReady(): Promise<void> {
    return this.player.whenReady();
  }

  dispose(): void {
    void this.wakeLock?.release();
    this.player.dispose();
    this.current = null;
  }
}
