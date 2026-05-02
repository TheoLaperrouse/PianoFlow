<template>
  <div class="relative h-full w-full flex flex-col">
    <header class="glass m-3 mb-2 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3">
      <button class="btn-ghost !px-3" title="Retour au menu" @click="emit('back')">
        <span>←</span>
      </button>

      <div class="flex items-center gap-2 min-w-0">
        <span class="size-2 rounded-full bg-violet-400 animate-pulse"></span>
        <span class="font-display font-semibold truncate max-w-[16rem]">{{ song.name }}</span>
      </div>

      <div class="flex items-center gap-2 ml-auto">
        <button class="btn-primary" @click="togglePlay">
          {{ isPlaying ? '⏸  Pause' : '▶  Play' }}
        </button>
        <button class="btn-ghost" @click="restart">⏮  Rejouer</button>
        <button class="btn-record" :disabled="isRecording" @click="exportVideo">
          {{ isRecording ? '⏺  Enregistrement…' : '🎬  Exporter' }}
        </button>
        <label class="btn-ghost cursor-pointer">
          📁 Changer
          <input
            type="file"
            class="hidden"
            accept=".mid,.midi,.mp3,.wav,.ogg,.flac"
            @change="onFileChange"
          />
        </label>
      </div>
    </header>

    <div class="glass mx-3 mb-2 rounded-2xl px-4 py-2 flex flex-wrap items-center gap-4 text-xs">
      <div class="flex items-center gap-2">
        <span class="text-[var(--color-text-muted)]">Vitesse</span>
        <select v-model.number="rate" class="field-select !py-1 !px-2 text-xs">
          <option :value="0.25">0.25x</option>
          <option :value="0.5">0.5x</option>
          <option :value="0.75">0.75x</option>
          <option :value="1">1x</option>
          <option :value="1.25">1.25x</option>
          <option :value="1.5">1.5x</option>
        </select>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[var(--color-text-muted)]">Anticipation</span>
        <input v-model.number="lookAhead" type="range" min="1" max="6" step="0.5" class="field-range" />
        <span class="tabular-nums w-8">{{ lookAhead }}s</span>
      </div>
      <div class="flex items-center gap-2 ml-auto">
        <span class="chip"><span class="size-2 rounded-sm bg-blue-500"></span>Main gauche</span>
        <span class="chip"><span class="size-2 rounded-sm bg-emerald-500"></span>Main droite</span>
      </div>
      <div class="tabular-nums text-[var(--color-text-muted)]">
        {{ formatTime(currentTime) }} / {{ formatTime(song.duration) }}
      </div>
    </div>

    <div class="relative flex-1 mx-3 mb-3 rounded-2xl overflow-hidden glass-strong">
      <canvas ref="canvasRef" class="block"></canvas>
      <div class="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-emerald-500 transition-all duration-200" :style="{ width: `${progress()}%` }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { PlaybackService } from '../../application/PlaybackService';
import type { RendererPort } from '../../application/ports/RendererPort';
import type { RecordingService } from '../../application/RecordingService';
import type { Song } from '../../domain/Song';

interface Props {
  playback: PlaybackService;
  recording: RecordingService;
  song: Song;
  createRenderer: (canvas: HTMLCanvasElement) => RendererPort;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'load-file', file: File): void;
  (e: 'error', message: string): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isPlaying = ref(false);
const isRecording = ref(false);
const rate = ref(1);
const lookAhead = ref(3);
const currentTime = ref(0);

let renderer: RendererPort | null = null;
let rafId: number | null = null;

function loop() {
  if (renderer) {
    const t = props.playback.getCurrentTime();
    currentTime.value = t;
    if (!props.playback.isPlaying() && isPlaying.value) {
      isPlaying.value = false;
    }
    renderer.render({ song: props.song, currentTime: t, lookAhead: lookAhead.value });
  }
  rafId = requestAnimationFrame(loop);
}

function onKeyDown(e: KeyboardEvent) {
  if (e.code !== 'Space') return;
  const target = e.target as HTMLElement | null;
  if (target && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)) return;
  e.preventDefault();
  togglePlay();
}

onMounted(() => {
  if (canvasRef.value) renderer = props.createRenderer(canvasRef.value);
  rafId = requestAnimationFrame(loop);
  window.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  window.removeEventListener('keydown', onKeyDown);
  renderer?.dispose();
});

async function togglePlay() {
  if (props.playback.isPlaying()) {
    props.playback.pause();
    isPlaying.value = false;
  } else {
    await props.playback.play();
    isPlaying.value = true;
  }
}

function restart() {
  props.playback.restart();
  isPlaying.value = false;
  currentTime.value = 0;
}

watch(rate, (r) => props.playback.setRate(r));

async function exportVideo() {
  if (isRecording.value) return;
  isRecording.value = true;
  try {
    const previousRate = rate.value;
    if (previousRate !== 1) {
      rate.value = 1;
      props.playback.setRate(1);
    }
    const blob = await props.recording.record();
    if (previousRate !== 1) {
      rate.value = previousRate;
      props.playback.setRate(previousRate);
    }
    const base = props.song.name.replace(/\.(mid|midi|mp3|wav|ogg|flac)$/i, '') || 'pianoflow';
    downloadBlob(blob, `${base}.webm`);
    isPlaying.value = false;
  } catch (err) {
    emit('error', err instanceof Error ? err.message : "Échec de l'enregistrement");
  } finally {
    isRecording.value = false;
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) emit('load-file', file);
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const progress = () =>
  props.song.duration > 0 ? (currentTime.value / props.song.duration) * 100 : 0;
</script>
