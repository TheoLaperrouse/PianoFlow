<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  count?: number;
}
const props = withDefaults(defineProps<Props>(), { count: 18 });

const SYMBOLS = ['𝄞', '♪', '♫', '♩', '♬', '𝄢', '♭', '♯'];

interface Symbol {
  char: string;
  left: string;
  size: string;
  duration: string;
  delay: string;
  drift: string;
  opacity: string;
}

const symbols = computed<Symbol[]>(() =>
  Array.from({ length: props.count }, (_, i) => {
    const seed = i + 1;
    return {
      char: SYMBOLS[seed % SYMBOLS.length],
      left: `${(seed * 53) % 100}%`,
      size: `${36 + ((seed * 17) % 64)}px`,
      duration: `${14 + ((seed * 11) % 22)}s`,
      delay: `-${(seed * 3) % 22}s`,
      drift: `${-60 + ((seed * 29) % 120)}px`,
      opacity: `${0.08 + ((seed * 7) % 18) / 100}`,
    };
  }),
);
</script>

<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden">
    <span
      v-for="(s, i) in symbols"
      :key="i"
      class="float-symbol"
      :style="{
        left: s.left,
        fontSize: s.size,
        animationDuration: s.duration,
        animationDelay: s.delay,
        '--drift': s.drift,
        '--opacity': s.opacity,
      }"
    >
      {{ s.char }}
    </span>
  </div>
</template>
