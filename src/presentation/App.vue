<template>
  <div class="relative h-full w-full overflow-hidden">
    <FloatingMusicSymbols />

    <Transition
      enter-active-class="transition-opacity duration-500"
      leave-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
      mode="out-in"
    >
      <HomeMenu
        v-if="view === 'home' || !song"
        key="home"
        :library-entries="libraryEntries"
        :is-transcribing="isTranscribing"
        @pick-file="handleLoadFile"
        @pick-library="handleLoadLibrary"
      />
      <PlayerView
        v-else
        key="player"
        :playback="playback"
        :recording="recording"
        :song="song"
        :create-renderer="container.createRenderer"
        @back="backToHome"
        @load-file="handleLoadFile"
        @error="setError"
      />
    </Transition>

    <Transition
      enter-active-class="transition-all duration-200"
      enter-from-class="opacity-0 translate-y-4"
      leave-active-class="transition-all duration-200"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div
        v-if="error"
        class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 glass-strong rounded-xl px-4 py-3 text-sm flex items-center gap-3 shadow-2xl"
        role="alert"
      >
        <span class="text-rose-400">⚠</span>
        <span>{{ error }}</span>
        <button class="text-[var(--color-text-muted)] hover:text-white" @click="error = null">×</button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import type { LibraryEntry } from '../application/ports/SongLibraryPort';
import type { Song } from '../domain/Song';
import FloatingMusicSymbols from './components/FloatingMusicSymbols.vue';
import HomeMenu from './components/HomeMenu.vue';
import PlayerView from './components/PlayerView.vue';
import { createAppContainer } from './composition';

const container = createAppContainer();
const playback = container.playback;
const library = container.library;
const recording = container.recording;

const song = shallowRef<Song | null>(null);
const error = ref<string | null>(null);
const isTranscribing = ref(false);
const libraryEntries = ref<LibraryEntry[]>([]);
const view = ref<'home' | 'player'>('home');

onMounted(async () => {
  try {
    libraryEntries.value = await library.list();
  } catch {
    /* bibliothèque indisponible — on n'expose rien */
  }
});

onUnmounted(() => {
  playback.dispose();
});

async function handleLoadFile(file: File) {
  error.value = null;
  const isAudio = /\.(mp3|wav|ogg|flac)$/i.test(file.name);
  if (isAudio) isTranscribing.value = true;
  try {
    const loaded = await playback.loadFromFile(file);
    song.value = loaded;
    view.value = 'player';
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Erreur de lecture du fichier';
  } finally {
    isTranscribing.value = false;
  }
}

async function handleLoadLibrary(id: string) {
  error.value = null;
  try {
    const file = await library.fetchFile(id);
    await handleLoadFile(file);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Impossible de charger le morceau';
  }
}

function backToHome() {
  playback.restart();
  view.value = 'home';
}

function setError(message: string) {
  error.value = message;
}
</script>
