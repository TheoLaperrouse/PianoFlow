import * as Tone from 'tone';
import type { AudioPlayerPort } from '../../application/ports/AudioPlayerPort';
import { isInRange } from '../../domain/Keyboard';
import type { Song } from '../../domain/Song';

/**
 * Adaptateur du port AudioPlayerPort basé sur Tone.js.
 *
 * Le Transport Tone sert de chronomètre maître : sa position en secondes est
 * également exposée comme « temps musical » au reste de l'application, ce qui
 * permet de garder le rendu et l'audio rigoureusement synchronisés quelle que
 * soit la vitesse choisie (la vitesse est implémentée comme un changement de
 * BPM du Transport).
 */
export class TonePlayer implements AudioPlayerPort {
  private readonly synth: Tone.PolySynth;
  private readonly transport = Tone.getTransport();
  private streamDestination: MediaStreamAudioDestinationNode | null = null;

  constructor() {
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 1 },
    }).toDestination();
    this.synth.volume.value = -8;
  }

  load(song: Song): void {
    this.transport.cancel();
    this.transport.stop();
    this.transport.position = 0;

    for (const n of song.notes) {
      if (!isInRange(n.midi)) continue;
      this.transport.schedule((time) => {
        this.synth.triggerAttackRelease(
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
    return this.transport.seconds;
  }

  isPlaying(): boolean {
    return this.transport.state === 'started';
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
    this.synth.dispose();
  }
}
