/**
 * Description légère d'un morceau disponible dans une bibliothèque, sans
 * dévoiler comment il est stocké (fichier statique, IndexedDB, API distante…).
 */
export interface LibraryEntry {
  readonly id: string;
  readonly title: string;
  readonly composer?: string;
}

/**
 * Port (driven) — donne accès à un catalogue de morceaux préchargés.
 * Implémentations possibles : fichiers statiques bundlés, base distante,
 * stockage local (favoris utilisateur), …
 */
export interface SongLibraryPort {
  list(): Promise<LibraryEntry[]>;
  /** Récupère le contenu binaire d'une entrée sous forme de File (réutilise les parsers existants). */
  fetchFile(id: string): Promise<File>;
}
