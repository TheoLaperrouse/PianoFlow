import type { SongParserPort } from '../../application/ports/SongParserPort';
import type { Song } from '../../domain/Song';

/**
 * Adaptateur composite : route le fichier vers le parser approprié selon son
 * extension. Permet à PlaybackService de rester agnostique du format en
 * entrée (MIDI, MP3, WAV, plus tard MusicXML…).
 */
export class CompositeSongParser implements SongParserPort {
  private readonly parsers: Map<string, SongParserPort>;

  constructor(parsers: Record<string, SongParserPort>) {
    this.parsers = new Map(Object.entries(parsers).map(([ext, p]) => [ext.toLowerCase(), p]));
  }

  async parse(file: File): Promise<Song> {
    const ext = extensionOf(file.name);
    const parser = this.parsers.get(ext);
    if (!parser) {
      throw new Error(`Format non supporté : .${ext}`);
    }
    return parser.parse(file);
  }
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}
