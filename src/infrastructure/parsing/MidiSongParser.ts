import { Midi } from '@tonejs/midi';
import type { SongParserPort } from '../../application/ports/SongParserPort';
import type { Hand } from '../../domain/Hand';
import type { PianoNote } from '../../domain/PianoNote';
import { createSong, type Song } from '../../domain/Song';

const MIDDLE_C = 60;

/**
 * Adaptateur du port SongParserPort, basé sur @tonejs/midi.
 *
 * Heuristique d'attribution des mains :
 *  - 2+ pistes utiles → la piste de hauteur moyenne la plus grave devient main gauche.
 *  - 1 seule piste   → split par hauteur (notes < Do central → main gauche).
 */
export class MidiSongParser implements SongParserPort {
  async parse(file: File): Promise<Song> {
    const buf = await file.arrayBuffer();
    const midi = new Midi(buf);
    const tracks = midi.tracks.filter((t) => t.notes.length > 0);
    const notes: PianoNote[] = [];

    if (tracks.length >= 2) {
      const leftIdx = pickLowestPitchTrack(tracks.map((t) => avgPitch(t.notes)));
      tracks.forEach((track, i) => {
        const hand: Hand = i === leftIdx ? 'left' : 'right';
        for (const n of track.notes) {
          notes.push(toDomainNote(n, hand));
        }
      });
    } else if (tracks.length === 1) {
      for (const n of tracks[0].notes) {
        notes.push(toDomainNote(n, n.midi < MIDDLE_C ? 'left' : 'right'));
      }
    }

    return createSong(file.name, notes);
  }
}

interface MidiNoteLike {
  midi: number;
  time: number;
  duration: number;
  velocity: number;
}

function toDomainNote(n: MidiNoteLike, hand: Hand): PianoNote {
  return {
    midi: n.midi,
    time: n.time,
    duration: n.duration,
    velocity: n.velocity,
    hand,
  };
}

function avgPitch(notes: ReadonlyArray<{ midi: number }>): number {
  return notes.reduce((sum, n) => sum + n.midi, 0) / notes.length;
}

function pickLowestPitchTrack(avgs: number[]): number {
  let idx = 0;
  for (let i = 1; i < avgs.length; i++) {
    if (avgs[i] < avgs[idx]) idx = i;
  }
  return idx;
}
