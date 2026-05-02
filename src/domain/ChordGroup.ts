import type { PianoNote } from './PianoNote';
import type { Song } from './Song';

/**
 * Regroupe les notes d'un morceau qui doivent être jouées « ensemble ».
 * Deux notes sont considérées simultanées si leurs débuts sont à moins de
 * `toleranceSeconds` l'une de l'autre — ce qui correspond à un accord ou à
 * une attaque main droite/main gauche jouées en même temps.
 */
export interface ChordGroup {
  readonly time: number;
  readonly notes: readonly PianoNote[];
  readonly midiSet: ReadonlySet<number>;
}

const DEFAULT_TOLERANCE_S = 0.04;

export function extractChordGroups(
  song: Song,
  toleranceSeconds = DEFAULT_TOLERANCE_S,
): ChordGroup[] {
  const groups: ChordGroup[] = [];
  if (song.notes.length === 0) return groups;

  let currentNotes: PianoNote[] = [song.notes[0]];
  let groupStart = song.notes[0].time;

  for (let i = 1; i < song.notes.length; i++) {
    const note = song.notes[i];
    if (note.time - groupStart <= toleranceSeconds) {
      currentNotes.push(note);
    } else {
      groups.push(toGroup(groupStart, currentNotes));
      currentNotes = [note];
      groupStart = note.time;
    }
  }
  groups.push(toGroup(groupStart, currentNotes));
  return groups;
}

function toGroup(time: number, notes: PianoNote[]): ChordGroup {
  return {
    time,
    notes,
    midiSet: new Set(notes.map((n) => n.midi)),
  };
}
