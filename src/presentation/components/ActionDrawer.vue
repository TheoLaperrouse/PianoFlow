<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        @click="emit('close')"
      ></div>
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      leave-active-class="transition-transform duration-200 ease-in"
      enter-from-class="translate-y-full"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="open"
        class="fixed inset-x-0 bottom-0 z-50 glass-strong rounded-t-3xl border-t border-white/10
               px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] max-h-[80dvh] overflow-y-auto"
        role="dialog"
      >
        <div class="mx-auto h-1 w-10 rounded-full bg-white/20 mb-4"></div>
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{ open: boolean }>();
const emit = defineEmits<(e: 'close') => void>();
</script>
