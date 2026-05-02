import * as Tone from 'tone';
import type { PianoNote } from './midiLoader';

let synth: Tone.PolySynth | null = null;

function getSynth(): Tone.PolySynth {
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 1 },
    }).toDestination();
    synth.volume.value = -8;
  }
  return synth;
}

export interface AudioController {
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  setRate(rate: number): void;
  getTime(): number;
  isPlaying(): boolean;
}

export function createAudioController(notes: PianoNote[]): AudioController {
  const s = getSynth();
  Tone.Transport.cancel();
  Tone.Transport.stop();
  Tone.Transport.position = 0;

  for (const n of notes) {
    Tone.Transport.schedule((time) => {
      try {
        s.triggerAttackRelease(
          Tone.Frequency(n.midi, 'midi').toNote(),
          Math.max(0.05, n.duration),
          time,
          Math.max(0.1, Math.min(1, n.velocity)),
        );
      } catch {
        /* notes hors range silencieusement ignorées */
      }
    }, n.time);
  }

  return {
    async play() {
      await Tone.start();
      Tone.Transport.start();
    },
    pause() {
      Tone.Transport.pause();
    },
    stop() {
      Tone.Transport.stop();
      Tone.Transport.position = 0;
    },
    seek(time: number) {
      Tone.Transport.seconds = Math.max(0, time);
    },
    setRate(rate: number) {
      Tone.Transport.bpm.value = 120 * rate;
    },
    getTime() {
      return Tone.Transport.seconds;
    },
    isPlaying() {
      return Tone.Transport.state === 'started';
    },
  };
}
