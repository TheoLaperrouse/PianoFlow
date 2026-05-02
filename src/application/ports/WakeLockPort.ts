/**
 * Port (driven) — empêche l'écran de s'éteindre pendant la lecture.
 * Implémentations possibles : Screen Wake Lock API (Web), aucune (fallback).
 */
export interface WakeLockPort {
  isSupported(): boolean;
  /** Acquiert un verrou. Sans effet si déjà actif ou non supporté. */
  acquire(): Promise<void>;
  /** Libère le verrou. Sans effet si non actif. */
  release(): Promise<void>;
}
