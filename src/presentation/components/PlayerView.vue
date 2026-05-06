<template>
  <div class="relative h-full w-full flex flex-col" :class="{ 'is-fullscreen': fullscreen }">
    <!-- Top bar : minimal, toujours visible (masquée en fullscreen) -->
    <header
      v-if="!fullscreen"
      class="glass m-2 sm:m-3 mb-2 rounded-2xl px-3 py-2 flex items-center gap-2"
    >
      <button class="btn-icon shrink-0" title="Retour au menu" @click="emit('back')">
        <span aria-hidden>←</span>
      </button>

      <div class="flex items-center gap-2 min-w-0 flex-1">
        <span class="size-2 rounded-full bg-violet-400 animate-pulse shrink-0"></span>
        <span class="font-display font-semibold truncate text-sm sm:text-base">{{ song.name }}</span>
      </div>

      <div class="hidden md:flex items-center gap-2 shrink-0 text-xs tabular-nums text-text-muted">
        {{ formatTime(currentTime) }} / {{ formatTime(song.duration) }}
      </div>

      <button
        class="btn-icon shrink-0"
        :title="loopTitle"
        :class="{ '!bg-violet-500/30 !border-violet-400/50': loopMode !== 'off' }"
        @click="cycleLoopMode"
      >
        <span aria-hidden>{{ loopIcon }}</span>
      </button>

      <button class="btn-icon shrink-0" title="Mode plein écran" @click="enterFullscreen">
        <span aria-hidden>⛶</span>
      </button>

      <button class="btn-icon shrink-0" title="Plus d'actions" @click="drawerOpen = true">
        <span aria-hidden>⋯</span>
      </button>
    </header>

    <!-- Practice panel — visible uniquement quand actif (mobile) ou toujours (desktop) -->
    <div v-if="!fullscreen && (practiceActive || showPracticePanel)" class="hidden md:block">
      <PracticePanel
        :midi-supported="midiSupported"
        :devices-requested="devicesRequested"
        :devices="devices"
        :selected-device-id="selectedDeviceId"
        :active="practiceActive"
        :chord-groups="practiceChordGroups"
        :expected-index="practiceExpectedIndex"
        :struck="practiceStruck"
        @connect="connectMidi"
        @select-device="selectMidiDevice"
        @toggle-active="togglePractice"
      />
    </div>

    <!-- Sur mobile, bandeau ultra-compact des notes attendues quand le mode est actif -->
    <div
      v-if="!fullscreen && practiceActive && expectedMobile.length"
      class="md:hidden glass mx-2 mb-2 rounded-2xl px-3 py-2 flex items-center gap-2 text-xs"
    >
      <span class="text-text-muted shrink-0">🎓 Joue :</span>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="midi in expectedMobile"
          :key="midi"
          class="px-2 py-0.5 rounded-md font-mono"
          :class="
            practiceStruck.has(midi)
              ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
              : 'bg-violet-500/20 text-violet-200 border border-violet-400/40'
          "
        >
          {{ formatNote(midi) }}
        </span>
      </div>
    </div>
    <div
      v-else-if="!fullscreen && practiceActive"
      class="md:hidden glass mx-2 mb-2 rounded-2xl px-3 py-2 text-emerald-300 text-xs"
    >
      🎉 Bravo, morceau terminé !
    </div>

    <!-- Canvas (zone principale) -->
    <div
      class="relative flex-1 overflow-hidden glass-strong"
      :class="fullscreen ? 'rounded-none border-0' : 'mx-2 sm:mx-3 mb-2 rounded-2xl'"
    >
      <canvas ref="canvasRef" class="block touch-none"></canvas>

      <!-- Bouton flottant pour quitter le fullscreen -->
      <button
        v-if="fullscreen"
        class="absolute top-3 right-3 size-11 rounded-xl bg-black/40 backdrop-blur-md border border-white/15
               text-white/85 hover:bg-black/60 transition-colors z-10"
        title="Quitter le plein écran (Échap)"
        @click="exitFullscreen"
      >
        <span aria-hidden>✕</span>
      </button>
      <div
        class="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-emerald-500 transition-all duration-200"
        :style="{ width: `${progress()}%` }"
      ></div>
      <div
        v-if="!instrumentReady"
        class="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div class="glass-strong rounded-xl px-4 py-2 flex items-center gap-2 text-sm">
          <span class="size-2 rounded-full bg-violet-400 animate-pulse"></span>
          Chargement du piano…
        </div>
      </div>
    </div>

    <!-- Bottom bar : Play XL + sélecteurs compacts (masquée en fullscreen) -->
    <div
      v-if="!fullscreen"
      class="glass mx-2 sm:mx-3 mb-2 rounded-2xl px-3 py-2 flex items-center gap-2 text-xs flex-wrap"
    >
      <button
        class="btn-primary !px-5 !py-3 !text-base !min-h-[52px] flex-1 sm:flex-none"
        :disabled="!instrumentReady"
        @click="togglePlay"
      >
        {{ !instrumentReady ? '⏳' : isPlaying ? '⏸  Pause' : '▶  Play' }}
      </button>

      <button class="btn-icon" title="Rejouer du début" @click="restart">
        <span aria-hidden>⏮</span>
      </button>

      <div class="md:hidden tabular-nums text-text-muted text-[11px] shrink-0">
        {{ formatTime(currentTime) }} / {{ formatTime(song.duration) }}
      </div>

      <div class="ml-auto flex items-center gap-2">
        <select
          v-model.number="rate"
          class="field-select !py-2 !px-2 text-xs"
          aria-label="Vitesse"
        >
          <option :value="0.25">0.25x</option>
          <option :value="0.5">0.5x</option>
          <option :value="0.75">0.75x</option>
          <option :value="1">1x</option>
          <option :value="1.25">1.25x</option>
          <option :value="1.5">1.5x</option>
        </select>

        <button
          class="btn-icon"
          :class="{ '!bg-violet-500/30 !border-violet-400/50': fitToSong }"
          :title="fitToSong ? 'Afficher 88 touches' : 'Ajuster au morceau'"
          @click="fitToSong = !fitToSong"
        >
          <span aria-hidden>🔍</span>
        </button>
      </div>
    </div>

    <!-- Drawer d'actions secondaires -->
    <ActionDrawer :open="drawerOpen" @close="drawerOpen = false">
      <h2 class="text-lg font-display font-semibold mb-4">Actions</h2>

      <div class="space-y-2 mb-4">
        <button class="btn-record w-full justify-center" :disabled="isRecording" @click="exportVideo">
          {{ isRecording ? '⏺  Enregistrement…' : '🎬  Exporter en vidéo' }}
        </button>
        <label class="flex items-center justify-between gap-3 px-1 py-1 text-sm">
          <span>Cartouche titre en intro</span>
          <input v-model="includeIntro" type="checkbox" class="accent-violet-400 size-5" />
        </label>

        <label class="btn-ghost w-full justify-center cursor-pointer">
          📁  Charger un autre fichier
          <input
            type="file"
            class="hidden"
            accept=".mid,.midi,.mp3,.wav,.ogg,.flac"
            @change="onFileChange"
          />
        </label>
      </div>

      <h3 class="text-sm font-display font-semibold mb-2 mt-4 text-text-muted">Affichage</h3>
      <div class="space-y-2 mb-4">
        <label class="flex items-center justify-between gap-3 px-1 py-2">
          <span class="text-sm">Anticipation</span>
          <div class="flex items-center gap-2">
            <input v-model.number="lookAhead" type="range" min="1" max="6" step="0.5" class="field-range" />
            <span class="tabular-nums w-8 text-right text-xs">{{ lookAhead }}s</span>
          </div>
        </label>
        <label class="flex items-center justify-between gap-3 px-1 py-2">
          <span class="text-sm">Ajuster le clavier au morceau</span>
          <input v-model="fitToSong" type="checkbox" class="accent-violet-400 size-5" />
        </label>
        <label class="flex items-center justify-between gap-3 px-1 py-2">
          <span class="text-sm">Trace fant&ocirc;me des notes pass&eacute;es</span>
          <input v-model="ghostNotes" type="checkbox" class="accent-violet-400 size-5" />
        </label>
        <div class="flex items-center justify-between gap-3 px-1 py-2">
          <span class="text-sm">Mode boucle</span>
          <div class="flex items-center gap-1 rounded-lg bg-white/5 p-0.5 border border-white/10">
            <button
              v-for="opt in loopOptions"
              :key="opt.value"
              type="button"
              class="px-2.5 py-1 rounded-md text-xs transition-colors"
              :class="
                loopMode === opt.value
                  ? 'bg-violet-500/30 text-violet-100 border border-violet-400/50'
                  : 'text-text-muted hover:text-white border border-transparent'
              "
              :disabled="opt.value === 'playlist' && !hasPlaylist"
              :title="opt.label"
              @click="loopMode = opt.value"
            >
              <span aria-hidden>{{ opt.icon }}</span>
              <span class="ml-1">{{ opt.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <h3 class="text-sm font-display font-semibold mb-2 mt-4 text-text-muted">Mode entraînement</h3>
      <PracticePanel
        :midi-supported="midiSupported"
        :devices-requested="devicesRequested"
        :devices="devices"
        :selected-device-id="selectedDeviceId"
        :active="practiceActive"
        :chord-groups="practiceChordGroups"
        :expected-index="practiceExpectedIndex"
        :struck="practiceStruck"
        @connect="connectMidi"
        @select-device="selectMidiDevice"
        @toggle-active="togglePractice"
      />
    </ActionDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { PlaybackService } from '../../application/PlaybackService';
import type { PracticeService } from '../../application/PracticeService';
import type { MidiInputDevice, MidiInputPort } from '../../application/ports/MidiInputPort';
import type { RendererPort } from '../../application/ports/RendererPort';
import type { RecordingService } from '../../application/RecordingService';
import type { ChordGroup } from '../../domain/ChordGroup';
import { midiToNoteName, octaveOf } from '../../domain/Keyboard';
import { type LoopMode, nextLoopMode } from '../../domain/LoopMode';
import { type Song, songKeyRange } from '../../domain/Song';
import ActionDrawer from './ActionDrawer.vue';
import PracticePanel from './PracticePanel.vue';

interface Props {
  playback: PlaybackService;
  recording: RecordingService;
  practice: PracticeService;
  midiInput: MidiInputPort;
  song: Song;
  createRenderer: (canvas: HTMLCanvasElement) => RendererPort;
  hasPlaylist?: boolean;
}
const props = withDefaults(defineProps<Props>(), { hasPlaylist: false });

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'load-file', file: File): void;
  (e: 'next-song'): void;
  (e: 'error', message: string): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isPlaying = ref(false);
const isRecording = ref(false);
const rate = ref(1);
const lookAhead = ref(3);
const currentTime = ref(0);
const instrumentReady = ref(props.playback.isInstrumentReady());
const drawerOpen = ref(false);
// Par défaut on auto-fit (utile sur mobile + plus lisible sur desktop pour
// les morceaux qui n'utilisent qu'une portion du clavier).
const fitToSong = ref(true);
const showPracticePanel = ref(true);
const loopMode = ref<LoopMode>('off');
const fullscreen = ref(false);

const loopOptions: ReadonlyArray<{ value: LoopMode; label: string; icon: string }> = [
  { value: 'off', label: 'Aucune', icon: '➡' },
  { value: 'song', label: 'Morceau', icon: '🔂' },
  { value: 'playlist', label: 'Bibliothèque', icon: '🔁' },
];

const loopIcon = computed(() => {
  switch (loopMode.value) {
    case 'song':
      return '🔂';
    case 'playlist':
      return '🔁';
    default:
      return '➡';
  }
});

const loopTitle = computed(() => {
  switch (loopMode.value) {
    case 'song':
      return 'Boucle : morceau (cliquer pour : bibliothèque)';
    case 'playlist':
      return 'Boucle : bibliothèque (cliquer pour : aucune)';
    default:
      return 'Boucle : aucune (cliquer pour : morceau)';
  }
});

function cycleLoopMode() {
  let next = nextLoopMode(loopMode.value);
  // Si la bibliothèque est vide, on saute le mode playlist
  if (next === 'playlist' && !props.hasPlaylist) next = nextLoopMode(next);
  loopMode.value = next;
}
const includeIntro = ref(true);
const ghostNotes = ref(loadGhostPreference());

function loadGhostPreference(): boolean {
  try {
    return localStorage.getItem('pianoflow:ghostNotes') === '1';
  } catch {
    return false;
  }
}

const midiSupported = ref(props.midiInput.isSupported());
const devicesRequested = ref(false);
const devices = shallowRef<MidiInputDevice[]>([]);
const selectedDeviceId = ref<string | null>(null);
const practiceActive = ref(false);
const practiceChordGroups = shallowRef<readonly ChordGroup[]>([]);
const practiceExpectedIndex = ref<number | null>(null);
const practiceStruck = shallowRef<ReadonlySet<number>>(new Set<number>());

const songRange = computed(() => songKeyRange(props.song));
const effectiveKeyRange = computed(() => (fitToSong.value ? songRange.value : null));

const expectedMobile = computed<number[]>(() => {
  if (practiceExpectedIndex.value === null) return [];
  const group = practiceChordGroups.value[practiceExpectedIndex.value];
  if (!group) return [];
  return [...group.midiSet].sort((a, b) => a - b);
});

let renderer: RendererPort | null = null;
let rafId: number | null = null;
let unsubscribePractice: (() => void) | null = null;

function renderLoop() {
  if (renderer) {
    const t = props.playback.getCurrentTime();
    currentTime.value = t;
    // Synchro bidirectionnelle : la lecture peut être déclenchée depuis l'extérieur
    // (transition playlist) ou s'arrêter toute seule.
    const playing = props.playback.isPlaying();
    if (playing !== isPlaying.value) {
      isPlaying.value = playing;
    }
    // Le Transport Tone ne s'arrête pas tout seul à la fin du morceau : on le
    // détecte ici pour décider quoi faire selon le mode de boucle.
    if (playing && t >= props.song.duration) {
      handleSongEnd();
    }
    renderer.render({
      song: props.song,
      currentTime: t,
      lookAhead: lookAhead.value,
      keyRange: effectiveKeyRange.value,
      ghostNotes: ghostNotes.value,
    });
  }
  rafId = requestAnimationFrame(renderLoop);
}

function handleSongEnd() {
  switch (loopMode.value) {
    case 'song':
      props.playback.restart();
      currentTime.value = 0;
      void props.playback.play().then(() => {
        isPlaying.value = true;
      });
      break;
    case 'playlist':
      // App.vue charge le morceau suivant et relance la lecture.
      emit('next-song');
      break;
    default:
      props.playback.restart();
      currentTime.value = 0;
      isPlaying.value = false;
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Escape' && fullscreen.value) {
    e.preventDefault();
    exitFullscreen();
    return;
  }
  if (e.code !== 'Space') return;
  const target = e.target as HTMLElement | null;
  if (target && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)) return;
  e.preventDefault();
  togglePlay();
}

function enterFullscreen() {
  fullscreen.value = true;
  // Demande aussi le vrai fullscreen navigateur si dispo (mobile-friendly).
  const el = document.documentElement;
  if (el.requestFullscreen && !document.fullscreenElement) {
    void el.requestFullscreen().catch(() => {
      /* refus utilisateur ou non supporté : on conserve juste la version CSS */
    });
  }
}

function exitFullscreen() {
  fullscreen.value = false;
  if (document.fullscreenElement && document.exitFullscreen) {
    void document.exitFullscreen().catch(() => {});
  }
}

onMounted(() => {
  if (canvasRef.value) renderer = props.createRenderer(canvasRef.value);
  rafId = requestAnimationFrame(renderLoop);
  window.addEventListener('keydown', onKeyDown);
  unsubscribePractice = props.practice.subscribe((state) => {
    practiceChordGroups.value = state.chordGroups;
    practiceExpectedIndex.value = state.expectedIndex;
    practiceStruck.value = state.struck;
    practiceActive.value = props.practice.isActive();
  });
  if (!instrumentReady.value) {
    void props.playback.whenInstrumentReady().then(() => {
      instrumentReady.value = true;
    });
  }
});

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  window.removeEventListener('keydown', onKeyDown);
  renderer?.dispose();
  unsubscribePractice?.();
  if (props.practice.isActive()) props.practice.stop();
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

watch(ghostNotes, (v) => {
  try {
    localStorage.setItem('pianoflow:ghostNotes', v ? '1' : '0');
  } catch {
    /* localStorage indisponible */
  }
});

watch(fullscreen, () => {
  // Le canvas est en flex-1 : toggler le chrome change la place dispo. On
  // attend le re-render Vue pour que le parent ait sa nouvelle taille.
  void nextTick(() => renderer?.resize());
});

async function exportVideo() {
  if (isRecording.value) return;
  drawerOpen.value = false;
  isRecording.value = true;
  try {
    const previousRate = rate.value;
    if (previousRate !== 1) {
      rate.value = 1;
      props.playback.setRate(1);
    }
    const base = props.song.name.replace(/\.(mid|midi|mp3|wav|ogg|flac)$/i, '') || 'pianoflow';
    const intro = includeIntro.value ? { title: base, subtitle: 'PianoFlow' } : undefined;
    const blob = await props.recording.record({ intro });
    if (previousRate !== 1) {
      rate.value = previousRate;
      props.playback.setRate(previousRate);
    }
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
  if (file) {
    drawerOpen.value = false;
    emit('load-file', file);
  }
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatNote(midi: number): string {
  return `${midiToNoteName(midi)}${octaveOf(midi)}`;
}

const progress = () =>
  props.song.duration > 0 ? (currentTime.value / props.song.duration) * 100 : 0;

async function connectMidi() {
  try {
    const list = await props.midiInput.requestAccess();
    devices.value = list;
    devicesRequested.value = true;
    if (list.length === 1) {
      selectMidiDevice(list[0].id);
    }
  } catch (err) {
    emit('error', err instanceof Error ? err.message : 'Accès MIDI refusé');
  }
}

function selectMidiDevice(id: string | null) {
  selectedDeviceId.value = id;
  props.midiInput.selectDevice(id);
  if (!id && practiceActive.value) {
    props.practice.stop();
  }
}

function togglePractice(value: boolean) {
  if (value) {
    props.practice.start(props.song);
  } else {
    props.practice.stop();
  }
}

watch(
  () => props.song,
  () => {
    currentTime.value = 0;
    if (practiceActive.value) props.practice.stop();
  },
);

// Si la bibliothèque devient vide (ou se réduit à 1 morceau) alors qu'on est
// en mode playlist, on retombe sur le mode "morceau" pour ne pas se retrouver
// avec un mode inopérant sélectionné.
watch(
  () => props.hasPlaylist,
  (has) => {
    if (!has && loopMode.value === 'playlist') loopMode.value = 'song';
  },
);
</script>
