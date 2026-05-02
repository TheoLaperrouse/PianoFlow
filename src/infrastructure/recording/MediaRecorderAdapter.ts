import type { VideoRecorderPort } from '../../application/ports/VideoRecorderPort';

const PREFERRED_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const;

/**
 * Adaptateur du VideoRecorderPort basé sur l'API MediaRecorder du navigateur.
 * Encode en WebM (VP9/VP8 + Opus selon le support).
 */
export class MediaRecorderAdapter implements VideoRecorderPort {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType = 'video/webm';

  start(stream: MediaStream): void {
    this.chunks = [];
    this.mimeType = pickMimeType();
    this.recorder = new MediaRecorder(stream, { mimeType: this.mimeType });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(250);
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const rec = this.recorder;
      if (!rec) {
        reject(new Error('Aucun enregistrement actif'));
        return;
      }
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mimeType });
        this.recorder = null;
        this.chunks = [];
        resolve(blob);
      };
      rec.stop();
    });
  }

  isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }
}

function pickMimeType(): string {
  for (const candidate of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return 'video/webm';
}
