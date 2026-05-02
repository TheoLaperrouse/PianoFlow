import * as Tone from 'tone';
import type { AudioPlayerPort } from '../../application/ports/AudioPlayerPort';
import { isInRange } from '../../domain/Keyboard';
import type { Song } from '../../domain/Song';

/**
 * Adaptateur du port AudioPlayerPort basé sur Tone.js.
 *
 * Le Tone.Transport sert de chronomètre maître : sa position en secondes est
 * également exposée comme « temps musical » au reste de l'application, ce qui
 * permet de garder le rendu et l'audio rigoureusement synchronisés quelle que
 * soit la vitesse choisie (la vitesse est implémentée comme un changement de
 * BPM du Transport).
 */
export class TonePlayer implements AudioPlayerPort {
  private synth: Tone.PolySynth;
  private streamDestination: MediaStreamAudioDestinationNode | null = null;

  constructor() {
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 1 },
    }).toDestination();
    this.synth.volume.value = -8;
  }

  load(song: Song): void {
    Tone.Transport.cancel();
    Tone.Transport.stop();
    Tone.Transport.position = 0;

    for (const n of song.notes) {
      if (!isInRange(n.midi)) continue;
      Tone.Transport.schedule((time) => {
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
    Tone.Transport.start();
  }

  pause(): void {
    Tone.Transport.pause();
  }

  stop(): void {
    Tone.Transport.stop();
    Tone.Transport.position = 0;
  }

  setRate(rate: number): void {
    Tone.Transport.bpm.value = 120 * rate;
  }

  getCurrentTime(): number {
    return Tone.Transport.seconds;
  }

  isPlaying(): boolean {
    return Tone.Transport.state === 'started';
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
    Tone.Transport.cancel();
    Tone.Transport.stop();
    this.synth.dispose();
  }
}
