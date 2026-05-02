/**
 * Description d'un périphérique MIDI d'entrée (clavier, contrôleur, etc.).
 */
export interface MidiInputDevice {
  readonly id: string;
  readonly name: string;
}

export interface MidiKeyEvent {
  readonly midi: number;
  /** Vélocité 0..1 (0 = note off). */
  readonly velocity: number;
}

export type MidiKeyListener = (event: MidiKeyEvent) => void;

/**
 * Port (driven) — accès à un périphérique MIDI d'entrée. Implémentation
 * actuelle : Web MIDI API du navigateur. Pourrait être un mock en tests,
 * ou un adaptateur réseau (RTP-MIDI) plus tard.
 */
export interface MidiInputPort {
  /** Vrai si l'environnement supporte l'accès MIDI. */
  isSupported(): boolean;
  /** Demande l'autorisation à l'utilisateur et énumère les périphériques. */
  requestAccess(): Promise<MidiInputDevice[]>;
  /** Sélectionne le périphérique actif (ou null pour aucun). */
  selectDevice(deviceId: string | null): void;
  /** Souscrit aux événements clavier. Retourne une fonction de désinscription. */
  onKey(listener: MidiKeyListener): () => void;
}
