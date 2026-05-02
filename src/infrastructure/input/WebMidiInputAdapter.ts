import type {
  MidiInputDevice,
  MidiInputPort,
  MidiKeyEvent,
  MidiKeyListener,
} from '../../application/ports/MidiInputPort';

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

/**
 * Adaptateur du MidiInputPort basé sur la Web MIDI API native du navigateur.
 * Tient un seul périphérique actif à la fois et démultiplexe ses messages
 * vers les listeners enregistrés.
 */
export class WebMidiInputAdapter implements MidiInputPort {
  private access: MIDIAccess | null = null;
  private currentInput: MIDIInput | null = null;
  private currentInputId: string | null = null;
  private readonly listeners = new Set<MidiKeyListener>();

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
  }

  async requestAccess(): Promise<MidiInputDevice[]> {
    if (!this.isSupported()) return [];
    if (!this.access) {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.access.onstatechange = () => {
        // Si le périphérique courant est débranché, on se déconnecte proprement.
        if (this.currentInputId && !this.findInput(this.currentInputId)) {
          this.detach();
        }
      };
    }
    return this.listInputs();
  }

  selectDevice(deviceId: string | null): void {
    if (deviceId === null) {
      this.detach();
      return;
    }
    if (!this.access) return;
    const input = this.findInput(deviceId);
    if (!input) return;
    this.detach();
    input.onmidimessage = (msg: MIDIMessageEvent) => this.handleMessage(msg);
    this.currentInput = input;
    this.currentInputId = deviceId;
  }

  onKey(listener: MidiKeyListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private listInputs(): MidiInputDevice[] {
    if (!this.access) return [];
    const result: MidiInputDevice[] = [];
    this.access.inputs.forEach((input) => {
      result.push({ id: input.id, name: input.name ?? 'MIDI device' });
    });
    return result;
  }

  private findInput(id: string): MIDIInput | null {
    if (!this.access) return null;
    let found: MIDIInput | null = null;
    this.access.inputs.forEach((input) => {
      if (input.id === id) found = input;
    });
    return found;
  }

  private detach(): void {
    if (this.currentInput) {
      this.currentInput.onmidimessage = null;
    }
    this.currentInput = null;
    this.currentInputId = null;
  }

  private handleMessage(msg: MIDIMessageEvent): void {
    const data = msg.data;
    if (!data || data.length < 3) return;
    const status = data[0] & 0xf0;
    const note = data[1];
    const velocity = data[2];

    let event: MidiKeyEvent | null = null;
    if (status === NOTE_ON && velocity > 0) {
      event = { midi: note, velocity: velocity / 127 };
    } else if (status === NOTE_OFF || (status === NOTE_ON && velocity === 0)) {
      event = { midi: note, velocity: 0 };
    }
    if (!event) return;
    for (const listener of this.listeners) listener(event);
  }
}
