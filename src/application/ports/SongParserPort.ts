import type { Song } from '../../domain/Song';

/**
 * Port (driven) — convertit une source binaire en Song du domaine.
 * Implémentations possibles : MIDI, MusicXML, audio→MIDI (basic-pitch), …
 */
export interface SongParserPort {
  parse(file: File): Promise<Song>;
}
