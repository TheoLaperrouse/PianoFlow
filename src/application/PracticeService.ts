import { type ChordGroup, extractChordGroups } from '../domain/ChordGroup';
import type { Song } from '../domain/Song';
import type { AudioPlayerPort } from './ports/AudioPlayerPort';
import type { MidiInputPort } from './ports/MidiInputPort';

/**
 * État courant du mode entraînement, observable depuis l'UI.
 */
export interface PracticeState {
  /** Index dans `chordGroups` de l'accord attendu, ou null si terminé/inactif. */
  expectedIndex: number | null;
  /** Notes de l'accord déjà jouées par l'utilisateur. */
  struck: ReadonlySet<number>;
  /** Snapshot des accords du morceau (utile pour l'UI). */
  chordGroups: readonly ChordGroup[];
}

const PAUSE_LOOK_AHEAD_S = 0.05;
const POLL_INTERVAL_MS = 16;

/**
 * Use case « mode entraînement » : la lecture progresse uniquement quand
 * l'utilisateur joue les notes attendues sur son clavier MIDI.
 *
 * Stratégie : la lecture audio (Tone Transport) avance normalement, mais
 * le service observe le temps courant et appelle `player.pause()` juste
 * avant que l'accord attendu n'arrive à la ligne de frappe. Quand toutes
 * les notes de l'accord ont été jouées, il appelle `player.play()` pour
 * laisser la suite se dérouler jusqu'à l'accord suivant.
 *
 * Aucune notion de Tone, Web MIDI, ou Vue ici — uniquement les ports.
 */
export class PracticeService {
  private readonly player: AudioPlayerPort;
  private readonly input: MidiInputPort;
  private chordGroups: ChordGroup[] = [];
  private expectedIndex: number | null = null;
  private struck = new Set<number>();
  private listeners = new Set<(state: PracticeState) => void>();
  private active = false;
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private unsubscribeKey: (() => void) | null = null;

  constructor(player: AudioPlayerPort, input: MidiInputPort) {
    this.player = player;
    this.input = input;
  }

  start(song: Song): void {
    if (this.active) this.stop();
    this.chordGroups = extractChordGroups(song);
    this.expectedIndex = this.chordGroups.length > 0 ? 0 : null;
    this.struck = new Set();
    this.active = true;

    this.unsubscribeKey = this.input.onKey((event) => {
      if (event.velocity === 0) return;
      this.handleKeyDown(event.midi);
    });

    this.pollHandle = setInterval(() => this.tick(), POLL_INTERVAL_MS);
    this.notify();
  }

  stop(): void {
    this.active = false;
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    if (this.unsubscribeKey) {
      this.unsubscribeKey();
      this.unsubscribeKey = null;
    }
    this.expectedIndex = null;
    this.struck = new Set();
    this.notify();
  }

  isActive(): boolean {
    return this.active;
  }

  getState(): PracticeState {
    return {
      expectedIndex: this.expectedIndex,
      struck: this.struck,
      chordGroups: this.chordGroups,
    };
  }

  subscribe(listener: (state: PracticeState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private tick(): void {
    if (!this.active || this.expectedIndex === null) return;
    const group = this.chordGroups[this.expectedIndex];
    const t = this.player.getCurrentTime();
    // Si on s'apprête à dépasser l'accord attendu, on met en pause pour attendre l'utilisateur.
    if (t + PAUSE_LOOK_AHEAD_S >= group.time && this.player.isPlaying()) {
      this.player.pause();
    }
  }

  private handleKeyDown(midi: number): void {
    if (!this.active || this.expectedIndex === null) return;
    const group = this.chordGroups[this.expectedIndex];
    if (!group.midiSet.has(midi)) return;

    this.struck.add(midi);
    if (this.struck.size >= group.midiSet.size) {
      this.expectedIndex += 1;
      this.struck = new Set();
      if (this.expectedIndex >= this.chordGroups.length) {
        this.expectedIndex = null;
      } else {
        // Reprend la lecture pour faire avancer le visuel jusqu'au prochain accord.
        void this.player.play();
      }
    }
    this.notify();
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }
}
