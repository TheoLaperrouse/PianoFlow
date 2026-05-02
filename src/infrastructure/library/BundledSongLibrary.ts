import type { LibraryEntry, SongLibraryPort } from '../../application/ports/SongLibraryPort';

interface ManifestEntry extends LibraryEntry {
  readonly file: string;
}

interface Manifest {
  readonly entries: ManifestEntry[];
}

/**
 * Adaptateur du SongLibraryPort qui sert des fichiers MIDI statiques placés
 * dans `public/library/`, décrits par `library/manifest.json`.
 */
export class BundledSongLibrary implements SongLibraryPort {
  private readonly baseUrl: string;
  private cache: Manifest | null = null;

  constructor(baseUrl = 'library') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async list(): Promise<LibraryEntry[]> {
    const manifest = await this.loadManifest();
    return manifest.entries.map(({ id, title, composer }) => ({ id, title, composer }));
  }

  async fetchFile(id: string): Promise<File> {
    const manifest = await this.loadManifest();
    const entry = manifest.entries.find((e) => e.id === id);
    if (!entry) throw new Error(`Morceau introuvable : ${id}`);
    const url = `${this.baseUrl}/${entry.file}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Impossible de charger ${url}`);
    const blob = await res.blob();
    return new File([blob], entry.file, { type: 'audio/midi' });
  }

  private async loadManifest(): Promise<Manifest> {
    if (this.cache) return this.cache;
    const res = await fetch(`${this.baseUrl}/manifest.json`);
    if (!res.ok) throw new Error('Manifest de bibliothèque introuvable');
    this.cache = (await res.json()) as Manifest;
    return this.cache;
  }
}
