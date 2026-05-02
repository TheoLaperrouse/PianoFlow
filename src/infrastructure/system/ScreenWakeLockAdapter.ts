import type { WakeLockPort } from '../../application/ports/WakeLockPort';

/**
 * Adaptateur du WakeLockPort utilisant l'API native Screen Wake Lock du
 * navigateur. Le verrou doit être ré-acquis quand l'onglet redevient
 * visible — l'OS le libère automatiquement quand l'utilisateur quitte
 * l'app, met le téléphone en veille, etc.
 */
export class ScreenWakeLockAdapter implements WakeLockPort {
  private sentinel: WakeLockSentinel | null = null;
  private wantedActive = false;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.wantedActive && !this.sentinel) {
          void this.acquire();
        }
      });
    }
  }

  isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'wakeLock' in navigator &&
      typeof navigator.wakeLock?.request === 'function'
    );
  }

  async acquire(): Promise<void> {
    this.wantedActive = true;
    if (!this.isSupported() || this.sentinel) return;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
    } catch {
      /* permission refusée ou batterie faible : on ignore silencieusement */
    }
  }

  async release(): Promise<void> {
    this.wantedActive = false;
    if (!this.sentinel) return;
    try {
      await this.sentinel.release();
    } catch {
      /* ignore */
    }
    this.sentinel = null;
  }
}
