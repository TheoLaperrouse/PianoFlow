<script setup lang="ts">
import type { LibraryEntry } from '../../application/ports/SongLibraryPort';

interface Props {
  libraryEntries: LibraryEntry[];
  isTranscribing: boolean;
}
defineProps<Props>();

const emit = defineEmits<{
  (e: 'pick-file', file: File): void;
  (e: 'pick-library', id: string): void;
}>();

function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) emit('pick-file', file);
}
</script>

<template>
  <div class="relative h-full w-full flex items-center justify-center px-6 overflow-hidden">
    <div class="relative z-10 w-full max-w-3xl text-center">
      <div class="mb-6 inline-flex items-center gap-2 chip">
        <span class="size-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        Apprendre le piano sans solfège
      </div>

      <h1 class="text-5xl sm:text-7xl font-bold tracking-tight mb-4">
        <span class="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-emerald-300 bg-clip-text text-transparent">
          PianoFlow
        </span>
      </h1>
      <p class="text-base sm:text-lg text-[var(--color-text-muted)] max-w-xl mx-auto mb-12">
        Importez une partition MIDI ou même un MP3 — les notes descendent jusqu'au clavier,
        bleu pour la main gauche, vert pour la main droite. Vous jouez, c'est tout.
      </p>

      <div class="grid sm:grid-cols-2 gap-4 mb-10">
        <label class="glass-strong rounded-2xl p-6 cursor-pointer text-left transition-all hover:scale-[1.02] hover:border-violet-400/50 group">
          <div class="flex items-center gap-3 mb-3">
            <div class="size-10 rounded-xl bg-violet-500/20 grid place-items-center text-xl group-hover:bg-violet-500/30 transition-colors">
              📁
            </div>
            <span class="font-semibold text-lg">Charger un fichier</span>
          </div>
          <p class="text-sm text-[var(--color-text-muted)] mb-3">
            MIDI (.mid) ou audio (.mp3, .wav, .ogg) — la transcription IA se déclenche pour l'audio.
          </p>
          <span v-if="isTranscribing" class="text-xs text-violet-300">🧠 Transcription en cours…</span>
          <span v-else class="text-xs text-[var(--color-text-muted)]">Cliquer pour choisir un fichier</span>
          <input type="file" accept=".mid,.midi,.mp3,.wav,.ogg,.flac" class="hidden" @change="onFile" />
        </label>

        <div class="glass-strong rounded-2xl p-6 text-left">
          <div class="flex items-center gap-3 mb-3">
            <div class="size-10 rounded-xl bg-emerald-500/20 grid place-items-center text-xl">
              🎼
            </div>
            <span class="font-semibold text-lg">Bibliothèque</span>
          </div>
          <p class="text-sm text-[var(--color-text-muted)] mb-3">
            Quelques classiques pour commencer tout de suite.
          </p>
          <div class="space-y-1.5">
            <button
              v-for="entry in libraryEntries"
              :key="entry.id"
              class="w-full text-left px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-emerald-400/40 transition-all text-sm flex justify-between items-center"
              @click="emit('pick-library', entry.id)"
            >
              <span class="font-medium">{{ entry.title }}</span>
              <span v-if="entry.composer" class="text-xs text-[var(--color-text-muted)]">{{ entry.composer }}</span>
            </button>
            <p v-if="!libraryEntries.length" class="text-xs text-[var(--color-text-muted)] italic">
              Bibliothèque vide.
            </p>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-3 text-xs text-[var(--color-text-muted)]">
        <span class="chip">🎹 88 touches</span>
        <span class="chip">⏯️ Espace = play / pause</span>
        <span class="chip">🐢 Vitesse réglable</span>
        <span class="chip">🎬 Export vidéo</span>
      </div>
    </div>
  </div>
</template>
