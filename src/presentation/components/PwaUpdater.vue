<template>
  <Transition
    enter-active-class="transition-all duration-200"
    enter-from-class="opacity-0 translate-y-4"
    leave-active-class="transition-all duration-200"
    leave-to-class="opacity-0 translate-y-4"
  >
    <div
      v-if="needRefresh"
      class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 glass-strong rounded-xl px-4 py-3 text-sm flex items-center gap-3 shadow-2xl"
      role="status"
    >
      <span class="text-violet-300">↻</span>
      <span>Une nouvelle version est disponible.</span>
      <button class="btn-primary !py-1 !px-3 !min-h-0 !text-xs" @click="reload">Mettre à jour</button>
      <button class="text-text-muted hover:text-white" aria-label="Plus tard" @click="dismiss">×</button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue';

const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisteredSW: () => {
    // Pas de log : on évite la pollution console en prod.
  },
});

function reload() {
  void updateServiceWorker(true);
}

function dismiss() {
  needRefresh.value = false;
}
</script>
