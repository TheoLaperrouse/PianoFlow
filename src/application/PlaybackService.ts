import type { Song } from '../domain/Song';
import type { AudioPlayerPort } from './ports/AudioPlayerPort';
import type { SongParserPort } from './ports/SongParserPort';

/**
 * Use case applicatif. Orchestre le parsing d'un fichier source et le contrôle
 * de la lecture audio. Aucune dépendance technique : les ports sont injectés.
 *
 * Les vues (Vue/React/CLI…) consomment uniquement cette façade.
 */
export class PlaybackService {
  private readonly parser: SongParserPort;
  private readonly player: AudioPlayerPort;
  private current: Song | null = null;

  constructor(parser: SongParserPort, player: AudioPlayerPort) {
    this.parser = parser;
    this.player = player;
  }

  async loadFromFile(file: File): Promise<Song> {
    this.player.stop();
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
  }

  pause(): void {
    this.player.pause();
  }

  restart(): void {
    this.player.stop();
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
    this.player.dispose();
    this.current = null;
  }
}
