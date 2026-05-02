<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { type AudioController, createAudioController } from './piano/audio';
import { type LoadedSong, loadMidiFile } from './piano/midiLoader';
import { render } from './piano/renderer';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const stageRef = ref<HTMLDivElement | null>(null);

const song = shallowRef<LoadedSong | null>(null);
const audio = shallowRef<AudioController | null>(null);
const error = ref<string | null>(null);
const isPlaying = ref(false);
const rate = ref(1);
const lookAhead = ref(3);
const currentTime = ref(0);

let rafId: number | null = null;
let cssWidth = 0;
let cssHeight = 0;

function loop() {
  const canvas = canvasRef.value;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const t = audio.value?.getTime() ?? 0;
      currentTime.value = t;
      if (audio.value && !audio.value.isPlaying() && isPlaying.value) {
        isPlaying.value = false;
      }
      render({
        ctx,
        width: cssWidth,
        height: cssHeight,
        notes: song.value?.notes ?? [],
        currentTime: t,
        lookAhead: lookAhead.value,
      });
    }
  }
  rafId = requestAnimationFrame(loop);
}

function resizeCanvas() {
  const canvas = canvasRef.value;
  const stage = stageRef.value;
  if (!canvas || !stage) return;
  const dpr = window.devicePixelRatio || 1;
  cssWidth = stage.clientWidth;
  cssHeight = stage.clientHeight;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const ctx = canvas.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

onMounted(() => {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  rafId = requestAnimationFrame(loop);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas);
  if (rafId !== null) cancelAnimationFrame(rafId);
  audio.value?.stop();
});

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  error.value = null;
  try {
    audio.value?.stop();
    const loaded = await loadMidiFile(file);
    song.value = loaded;
    const ctrl = createAudioController(loaded.notes);
    ctrl.setRate(rate.value);
    audio.value = ctrl;
    isPlaying.value = false;
    currentTime.value = 0;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erreur de lecture du fichier MIDI';
  }
}

async function togglePlay() {
  const ctrl = audio.value;
  if (!ctrl) return;
  if (ctrl.isPlaying()) {
    ctrl.pause();
    isPlaying.value = false;
  } else {
    await ctrl.play();
    isPlaying.value = true;
  }
}

function restart() {
  audio.value?.stop();
  isPlaying.value = false;
  currentTime.value = 0;
}

watch(rate, (r) => {
  audio.value?.setRate(r);
});

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
</script>

<template>
  <div class="app">
    <header class="toolbar">
      <h1>PianoMaster</h1>

      <label class="file-input">
        <input type="file" accept=".mid,.midi" @change="onFileChange" />
        <span>{{ song ? `📄 ${song.name}` : '📁 Charger un MIDI' }}</span>
      </label>

      <button :disabled="!song" @click="togglePlay">
        {{ isPlaying ? '⏸ Pause' : '▶ Play' }}
      </button>
      <button :disabled="!song" @click="restart">⏮ Rejouer</button>

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

    <div ref="stageRef" class="stage">
      <canvas ref="canvasRef"></canvas>
      <div v-if="!song" class="placeholder">
        Chargez un fichier MIDI (.mid) pour démarrer.
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
