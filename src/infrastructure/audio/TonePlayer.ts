import * as Tone from 'tone';
import type { AudioPlayerPort } from '../../application/ports/AudioPlayerPort';
import { isInRange } from '../../domain/Keyboard';
import type { Song } from '../../domain/Song';

/**
 * URL CDN officielle des samples Salamander Grand Piano (Tone.js).
 * Chaque clé est une note pivot, le sampler interpole pour les notes
 * intermédiaires, ce qui permet de couvrir 88 touches avec ~16 fichiers.
 */
const SALAMANDER_BASE_URL = 'https://tonejs.github.io/audio/salamander/';
const SALAMANDER_NOTES: Record<string, string> = {
  A0: 'A0.mp3',
  C1: 'C1.mp3',
  'D#1': 'Ds1.mp3',
  'F#1': 'Fs1.mp3',
  A1: 'A1.mp3',
  C2: 'C2.mp3',
  'D#2': 'Ds2.mp3',
  'F#2': 'Fs2.mp3',
  A2: 'A2.mp3',
  C3: 'C3.mp3',
  'D#3': 'Ds3.mp3',
  'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  'D#4': 'Ds4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  'D#5': 'Ds5.mp3',
  'F#5': 'Fs5.mp3',
  A5: 'A5.mp3',
  C6: 'C6.mp3',
  'D#6': 'Ds6.mp3',
  'F#6': 'Fs6.mp3',
  A6: 'A6.mp3',
  C7: 'C7.mp3',
  'D#7': 'Ds7.mp3',
  'F#7': 'Fs7.mp3',
  A7: 'A7.mp3',
  C8: 'C8.mp3',
};

/**
 * Adaptateur du port AudioPlayerPort basé sur Tone.js + Tone.Sampler chargeant
 * les samples du Salamander Grand Piano (domaine public).
 *
 * Le Transport Tone sert de chronomètre maître : sa position en secondes est
 * également exposée comme « temps musical » au reste de l'application, ce qui
 * permet de garder le rendu et l'audio rigoureusement synchronisés quelle que
 * soit la vitesse choisie (la vitesse est implémentée comme un changement de
 * BPM du Transport).
 */
export class TonePlayer implements AudioPlayerPort {
  private readonly sampler: Tone.Sampler;
  private readonly transport = Tone.getTransport();
  private readonly readyPromise: Promise<void>;
  private ready = false;
  private streamDestination: MediaStreamAudioDestinationNode | null = null;

  constructor() {
    let resolveReady: () => void = () => {};
    this.readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    this.sampler = new Tone.Sampler({
      urls: SALAMANDER_NOTES,
      baseUrl: SALAMANDER_BASE_URL,
      release: 1,
      onload: () => {
        this.ready = true;
        resolveReady();
      },
    }).toDestination();
    this.sampler.volume.value = -6;
  }

  load(song: Song): void {
    this.transport.cancel();
    this.transport.stop();
    this.transport.position = 0;

    for (const n of song.notes) {
      if (!isInRange(n.midi)) continue;
      this.transport.schedule((time) => {
        this.sampler.triggerAttackRelease(
          Tone.Frequency(n.midi, 'midi').toNote(),
          Math.max(0.05, n.duration),
          time,
          Math.max(0.1, Math.min(1, n.velocity)),
        );
      }, n.time);
    }
  }

  async play(): Promise<void> {
    await Tone.start();
    await this.readyPromise;
    this.transport.start();
  }

  pause(): void {
    this.transport.pause();
  }

  stop(): void {
    this.transport.stop();
    this.transport.position = 0;
  }

  setRate(rate: number): void {
    this.transport.bpm.value = 120 * rate;
  }

  getCurrentTime(): number {
    // Compensation de la latence de sortie audio : `transport.seconds` reflète
    // la position planifiée par le scheduler, mais le son n'atteint vraiment
    // les enceintes qu'après le buffer matériel (~50–200 ms selon le système).
    // Sans cette correction, le rendu visuel devance le son, surtout à vitesse
    // normale (à x0.25 le décalage est divisé par 4 et passe inaperçu).
    const ctx = Tone.getContext().rawContext as AudioContext;
    const outputLatency = ctx.outputLatency || ctx.baseLatency || 0;
    // Le transport est exprimé en « temps musical » : on convertit la latence
    // wall-clock en temps musical via le rate courant (rate = bpm / 120).
    const rate = this.transport.bpm.value / 120;
    return this.transport.seconds - outputLatency * rate;
  }

  isPlaying(): boolean {
    return this.transport.state === 'started';
  }

  isReady(): boolean {
    return this.ready;
  }

  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  captureStream(): MediaStream {
    if (!this.streamDestination) {
      const ctx = Tone.getContext().rawContext as AudioContext;
      this.streamDestination = ctx.createMediaStreamDestination();
      // Branche en parallèle de la sortie haut-parleurs (les deux jouent en même temps).
      Tone.getDestination().connect(this.streamDestination);
    }
    return this.streamDestination.stream;
  }

  dispose(): void {
    this.transport.cancel();
    this.transport.stop();
    this.sampler.dispose();
  }
}
