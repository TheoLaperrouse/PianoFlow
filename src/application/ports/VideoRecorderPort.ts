/**
 * Port (driven) — enregistreur audio/vidéo. Implémentations possibles :
 * MediaRecorder navigateur (temps réel), encodeur offline (rendu accéléré),
 * ffmpeg.wasm, …
 */
export interface VideoRecorderPort {
  start(stream: MediaStream): void;
  /** Arrête l'enregistrement et retourne le fichier vidéo final. */
  stop(): Promise<Blob>;
  isRecording(): boolean;
}
