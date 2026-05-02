import { Midi } from '@tonejs/midi';

export type Hand = 'left' | 'right';

export interface PianoNote {
  midi: number;
  time: number;
  duration: number;
  velocity: number;
  hand: Hand;
}

export interface LoadedSong {
  name: string;
  duration: number;
  notes: PianoNote[];
}

export async function loadMidiFile(file: File): Promise<LoadedSong> {
  const buf = await file.arrayBuffer();
  const midi = new Midi(buf);

  const tracksWithNotes = midi.tracks.filter((t) => t.notes.length > 0);
  const notes: PianoNote[] = [];

  if (tracksWithNotes.length >= 2) {
    const avgPitches = tracksWithNotes.map((t) => {
      const sum = t.notes.reduce((s, n) => s + n.midi, 0);
      return sum / t.notes.length;
    });
    let leftIdx = 0;
    for (let i = 1; i < avgPitches.length; i++) {
      if (avgPitches[i] < avgPitches[leftIdx]) leftIdx = i;
    }
    tracksWithNotes.forEach((track, i) => {
      const hand: Hand = i === leftIdx ? 'left' : 'right';
      for (const n of track.notes) {
        notes.push({
          midi: n.midi,
          time: n.time,
          duration: n.duration,
          velocity: n.velocity,
          hand,
        });
      }
    });
  } else if (tracksWithNotes.length === 1) {
    for (const n of tracksWithNotes[0].notes) {
      notes.push({
        midi: n.midi,
        time: n.time,
        duration: n.duration,
        velocity: n.velocity,
        hand: n.midi < 60 ? 'left' : 'right',
      });
    }
  }

  notes.sort((a, b) => a.time - b.time);
  const duration = notes.reduce((m, n) => Math.max(m, n.time + n.duration), 0);

  return { name: file.name, duration, notes };
}
