<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { RendererPort } from '../application/ports/RendererPort';
import type { LibraryEntry } from '../application/ports/SongLibraryPort';
import type { Song } from '../domain/Song';
import { createAppContainer } from './composition';

const container = createAppContainer();
const playback = container.playback;
const library = container.library;
const recording = container.recording;

const canvasRef = ref<HTMLCanvasElement | null>(null);
const song = shallowRef<Song | null>(null);
const error = ref<string | null>(null);
const isPlaying = ref(false);
const rate = ref(1);
const lookAhead = ref(3);
const currentTime = ref(0);
const libraryEntries = ref<LibraryEntry[]>([]);
const selectedLibraryId = ref<string>('');
const isRecording = ref(false);
const isTranscribing = ref(false);

let renderer: RendererPort | null = null;
let rafId: number | null = null;

function loop() {
  if (renderer) {
    const t = playback.getCurrentTime();
    currentTime.value = t;
    if (!playback.isPlaying() && isPlaying.value) {
      isPlaying.value = false;
    }
    renderer.render({
      song: song.value,
      currentTime: t,
      lookAhead: lookAhead.value,
    });
  }
  rafId = requestAnimationFrame(loop);
}

function onKeyDown(e: KeyboardEvent) {
  if (e.code !== 'Space') return;
  const target = e.target as HTMLElement | null;
  // Ne pas intercepter dans les champs interactifs (select/range/etc.)
  if (target && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)) return;
  if (!song.value) return;
  e.preventDefault();
  togglePlay();
}

onMounted(async () => {
  if (canvasRef.value) {
    renderer = container.createRenderer(canvasRef.value);
  }
  rafId = requestAnimationFrame(loop);
  window.addEventListener('keydown', onKeyDown);
  try {
    libraryEntries.value = await library.list();
  } catch {
    // bibliothèque manquante : on n'expose rien
  }
});

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  window.removeEventListener('keydown', onKeyDown);
  renderer?.dispose();
  playback.dispose();
});

async function loadFile(file: File) {
  error.value = null;
  const isAudio = /\.(mp3|wav|ogg|flac)$/i.test(file.name);
  if (isAudio) isTranscribing.value = true;
  try {
    const loaded = await playback.loadFromFile(file);
    playback.setRate(rate.value);
    song.value = loaded;
    isPlaying.value = false;
    currentTime.value = 0;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erreur de lecture du fichier';
  } finally {
    isTranscribing.value = false;
  }
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  await loadFile(file);
}

async function onLibrarySelect(e: Event) {
  const id = (e.target as HTMLSelectElement).value;
  if (!id) return;
  selectedLibraryId.value = id;
  try {
    const file = await library.fetchFile(id);
    await loadFile(file);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de charger le morceau';
  }
}

async function togglePlay() {
  if (!song.value) return;
  if (playback.isPlaying()) {
    playback.pause();
    isPlaying.value = false;
  } else {
    await playback.play();
    isPlaying.value = true;
  }
}

function restart() {
  playback.restart();
  isPlaying.value = false;
  currentTime.value = 0;
}

watch(rate, (r) => playback.setRate(r));

async function exportVideo() {
  if (isRecording.value || !song.value) return;
  error.value = null;
  isRecording.value = true;
  try {
    // Force la vitesse 1x pour un rendu fidèle (l'utilisateur récupère son fichier)
    const previousRate = rate.value;
    if (previousRate !== 1) {
      rate.value = 1;
      playback.setRate(1);
    }
    const blob = await recording.record();
    if (previousRate !== 1) {
      rate.value = previousRate;
      playback.setRate(previousRate);
    }
    downloadBlob(blob, suggestedFileName(song.value.name));
    isPlaying.value = false;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Échec de l'enregistrement";
  } finally {
    isRecording.value = false;
  }
}

function suggestedFileName(songName: string): string {
  const base = songName.replace(/\.(mid|midi|mp3|wav)$/i, '');
  return `${base || 'pianoflow'}.webm`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
</script>

<template>
  <div class="app">
    <header class="toolbar">
      <h1>PianoFlow</h1>

      <label class="file-input">
        <input type="file" accept=".mid,.midi,.mp3,.wav,.ogg,.flac" @change="onFileChange" />
        <span>{{
          isTranscribing
            ? '🧠 Transcription IA…'
            : song
              ? `📄 ${song.name}`
              : '📁 Charger un fichier (MIDI / MP3 / WAV)'
        }}</span>
      </label>

      <select
        v-if="libraryEntries.length"
        class="library-select"
        :value="selectedLibraryId"
        @change="onLibrarySelect"
      >
        <option value="" disabled>🎼 Bibliothèque…</option>
        <option v-for="entry in libraryEntries" :key="entry.id" :value="entry.id">
          {{ entry.title }}{{ entry.composer ? ` — ${entry.composer}` : '' }}
        </option>
      </select>

      <button :disabled="!song" @click="togglePlay">
        {{ isPlaying ? '⏸ Pause' : '▶ Play' }}
      </button>
      <button :disabled="!song" @click="restart">⏮ Rejouer</button>
      <button :disabled="!song || isRecording" @click="exportVideo">
        {{ isRecording ? '⏺ Enregistrement…' : '🎬 Exporter vidéo' }}
      </button>

      <label class="ctrl">
        Vitesse&nbsp;
        <select v-model.number="rate">
          <option :value="0.25">0.25x</option>
          <option :value="0.5">0.5x</option>
          <option :value="0.75">0.75x</option>
          <option :value="1">1x</option>
          <option :value="1.25">1.25x</option>
          <option :value="1.5">1.5x</option>
        </select>
      </label>

      <label class="ctrl">
        Anticipation&nbsp;
        <input v-model.number="lookAhead" type="range" min="1" max="6" step="0.5" />
        <span>{{ lookAhead }}s</span>
      </label>

      <div class="legend">
        <span class="dot left"></span>Main gauche
        <span class="dot right"></span>Main droite
      </div>

      <div class="time">
        {{ formatTime(currentTime) }} / {{ formatTime(song?.duration ?? 0) }}
      </div>
    </header>

    <div v-if="error" class="error">{{ error }}</div>

    <div class="stage">
      <canvas ref="canvasRef"></canvas>
      <div v-if="!song" class="placeholder">
        Chargez un fichier MIDI (.mid) ou choisissez un morceau dans la bibliothèque pour démarrer.
        <br />
        <small>(Espace = play / pause)</small>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 16px;
  background: #15151a;
  border-bottom: 1px solid #2a2a32;
}

.toolbar h1 {
  font-size: 18px;
  margin: 0 12px 0 0;
}

.file-input {
  position: relative;
  display: inline-flex;
  align-items: center;
  background: #2a2a32;
  border: 1px solid #3a3a44;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
}

.file-input input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.library-select {
  max-width: 260px;
}

.ctrl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #cdd;
}

.legend {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #aaa;
}

.dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  margin-right: 4px;
}

.dot.left {
  background: #3a7bd5;
}

.dot.right {
  background: #3fa34d;
}

.time {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  color: #aaa;
}

.error {
  background: #4a1f1f;
  color: #ffb3b3;
  padding: 8px 16px;
  font-size: 14px;
}

.stage {
  flex: 1;
  position: relative;
  min-height: 0;
}

.stage canvas {
  display: block;
}

.placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  pointer-events: none;
  font-size: 16px;
}
</style>
