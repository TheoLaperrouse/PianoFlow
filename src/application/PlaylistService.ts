import type { LibraryEntry } from './ports/SongLibraryPort';

/**
 * Use case — orchestre la navigation séquentielle dans la bibliothèque.
 * N'expose pas de port : c'est un service applicatif qui consomme
 * `SongLibraryPort` via les entrées qu'on lui injecte (la composition root
 * est responsable de garder la liste à jour).
 */
export class PlaylistService {
  private entries: readonly LibraryEntry[] = [];
  private currentIndex: number | null = null;

  setEntries(entries: readonly LibraryEntry[]): void {
    this.entries = entries;
    if (this.currentIndex !== null && this.currentIndex >= entries.length) {
      this.currentIndex = null;
    }
  }

  /** Aligne l'index courant sur l'entrée d'identifiant donné, ou le réinitialise si introuvable. */
  setCurrent(id: string | null): void {
    if (id === null) {
      this.currentIndex = null;
      return;
    }
    const idx = this.entries.findIndex((e) => e.id === id);
    this.currentIndex = idx === -1 ? null : idx;
  }

  current(): LibraryEntry | null {
    if (this.currentIndex === null) return null;
    return this.entries[this.currentIndex] ?? null;
  }

  /**
   * Renvoie le morceau suivant (rebouclage en fin de liste). Renvoie null
   * si la bibliothèque est vide ou si on n'est pas positionné sur une entrée
   * connue (ex : fichier utilisateur uploadé à la main).
   */
  next(): LibraryEntry | null {
    if (this.entries.length === 0 || this.currentIndex === null) return null;
    const nextIndex = (this.currentIndex + 1) % this.entries.length;
    this.currentIndex = nextIndex;
    return this.entries[nextIndex] ?? null;
  }

  hasPlaylist(): boolean {
    return this.entries.length > 1 && this.currentIndex !== null;
  }
}
