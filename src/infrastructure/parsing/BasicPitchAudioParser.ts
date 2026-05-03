import type { SongParserPort } from '../../application/ports/SongParserPort';
import type { Hand } from '../../domain/Hand';
import { isInRange } from '../../domain/Keyboard';
import type { PianoNote } from '../../domain/PianoNote';
import { createSong, type Song } from '../../domain/Song';

const MIDDLE_C = 60;
// Seuils plus permissifs pour récupérer les notes faibles (détection
// d'attaques douces) et durée minimum un peu plus haute pour filtrer les
// faux-positifs courts. Empiriquement, ces réglages améliorent nettement
// la transcription d'enregistrements piano au prix d'un léger sur-échantillon
// de notes très courtes — tolérable.
const ONSET_THRESHOLD = 0.3;
const FRAME_THRESHOLD = 0.2;
const MIN_NOTE_LENGTH = 11;
// Plage piano (A0..C8) — restreindre la sortie au domaine cible évite que le
// modèle propose des notes parasites en dehors du clavier.
const MIN_FREQ_HZ = 27.5; // A0
const MAX_FREQ_HZ = 4186; // C8
const MELODIA_TRICK = true;
const INFER_ONSETS = true;

interface BasicPitchInstance {
  evaluateModel(
    samples: Float32Array,
    onProgress: (frames: number[][], onsets: number[][], contours: number[][]) => void,
    onComplete: () => void,
  ): Promise<void>;
}

interface NoteEvent {
  pitchMidi: number;
  startTimeSeconds: number;
  durationSeconds: number;
  amplitude: number;
}

interface BasicPitchModule {
  BasicPitch: new (modelUrl: string) => BasicPitchInstance;
  outputToNotesPoly: (
    frames: number[][],
    onsets: number[][],
    onsetThresh: number,
    frameThresh: number,
    minNoteLen: number,
    inferOnsets?: boolean,
    maxFreq?: number | null,
    minFreq?: number | null,
    melodiaTrick?: boolean,
  ) => unknown;
  addPitchBendsToNoteEvents: (contours: number[][], notes: unknown) => unknown;
  noteFramesToTime: (notes: unknown) => NoteEvent[];
}

/**
 * Adaptateur du SongParserPort pour les fichiers audio (MP3, WAV, OGG, …).
 *
 * Utilise basic-pitch (Spotify) — un modèle TF.js qui transcrit l'audio en
 * notes MIDI. Le module est chargé dynamiquement (TF.js fait ~1 Mo gzip)
 * pour ne pas pénaliser le démarrage des utilisateurs qui n'importent que
 * du MIDI. La détection main gauche / main droite n'a pas de pistes : split
 * par hauteur (notes < Do central → MG).
 */
export class BasicPitchAudioParser implements SongParserPort {
  private readonly modelUrl: string;
  private model: BasicPitchInstance | null = null;
  private moduleP: Promise<BasicPitchModule> | null = null;

  constructor(modelUrl?: string) {
    this.modelUrl = modelUrl ?? `${import.meta.env.BASE_URL}models/basic-pitch/model.json`;
  }

  async parse(file: File): Promise<Song> {
    const mod = await this.loadModule();
    const buffer = await file.arrayBuffer();
    const audioBuffer = await decodeAudio(buffer);

    if (!this.model) this.model = new mod.BasicPitch(this.modelUrl);

    const frames: number[][] = [];
    const onsets: number[][] = [];
    const contours: number[][] = [];

    await this.model.evaluateModel(
      audioBuffer.getChannelData(0),
      (f, o, c) => {
        frames.push(...f);
        onsets.push(...o);
        contours.push(...c);
      },
      () => {
        /* progression : inutile ici */
      },
    );

    const noteFrames = mod.outputToNotesPoly(
      frames,
      onsets,
      ONSET_THRESHOLD,
      FRAME_THRESHOLD,
      MIN_NOTE_LENGTH,
      INFER_ONSETS,
      MAX_FREQ_HZ,
      MIN_FREQ_HZ,
      MELODIA_TRICK,
    );
    const withPitchBends = mod.addPitchBendsToNoteEvents(contours, noteFrames);
    const noteEvents = mod.noteFramesToTime(withPitchBends);

    const notes: PianoNote[] = [];
    for (const evt of noteEvents) {
      if (!isInRange(evt.pitchMidi)) continue;
      const hand: Hand = evt.pitchMidi < MIDDLE_C ? 'left' : 'right';
      notes.push({
        midi: evt.pitchMidi,
        time: evt.startTimeSeconds,
        duration: Math.max(0.05, evt.durationSeconds),
        velocity: clamp01(evt.amplitude),
        hand,
      });
    }

    return createSong(file.name, notes);
  }

  private loadModule(): Promise<BasicPitchModule> {
    if (!this.moduleP) {
      this.moduleP = import('@spotify/basic-pitch') as unknown as Promise<BasicPitchModule>;
    }
    return this.moduleP;
  }
}

async function decodeAudio(buffer: ArrayBuffer): Promise<AudioBuffer> {
  const Ctx =
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    AudioContext;
  const ctx = new Ctx();
  try {
    return await ctx.decodeAudioData(buffer.slice(0));
  } finally {
    void ctx.close();
  }
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0.5;
  return Math.max(0.1, Math.min(1, v));
}
