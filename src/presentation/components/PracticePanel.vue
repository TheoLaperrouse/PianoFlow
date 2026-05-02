<template>
  <div class="glass mx-3 mb-2 rounded-2xl px-4 py-2 flex flex-wrap items-center gap-3 text-xs">
    <span class="font-display font-semibold text-sm">🎓 Mode entraînement</span>

    <button
      v-if="!midiSupported"
      class="text-rose-300 italic"
      title="Web MIDI API non supportée par ce navigateur"
      disabled
    >
      ⚠ MIDI non supporté
    </button>

    <template v-else>
      <button v-if="!devicesRequested" class="btn-ghost !py-1 !px-3" @click="onConnect">
        🔌 Connecter un piano
      </button>

      <select
        v-else
        class="field-select !py-1 !px-2 text-xs"
        :value="selectedDeviceId ?? ''"
        @change="onDeviceChange"
      >
        <option value="">— Aucun périphérique —</option>
        <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
      </select>

      <label class="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          class="accent-violet-400"
          :checked="active"
          :disabled="!selectedDeviceId"
          @change="onToggleActive(($event.target as HTMLInputElement).checked)"
        />
        <span :class="{ 'text-[var(--color-text-muted)]': !selectedDeviceId }">
          Attendre mes notes
        </span>
      </label>
    </template>

    <div v-if="active && expectedNotes.length" class="ml-auto flex items-center gap-2">
      <span class="text-[var(--color-text-muted)]">Joue :</span>
      <span
        v-for="midi in expectedNotes"
        :key="midi"
        class="px-2 py-0.5 rounded-md font-mono"
        :class="
          struck.has(midi)
            ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
            : 'bg-violet-500/20 text-violet-200 border border-violet-400/40'
        "
      >
        {{ formatNote(midi) }}
      </span>
    </div>

    <div v-else-if="active" class="ml-auto text-emerald-300">🎉 Bravo, morceau terminé !</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ChordGroup } from '../../domain/ChordGroup';
import { midiToNoteName, octaveOf } from '../../domain/Keyboard';

interface Props {
  midiSupported: boolean;
  devicesRequested: boolean;
  devices: Array<{ id: string; name: string }>;
  selectedDeviceId: string | null;
  active: boolean;
  chordGroups: readonly ChordGroup[];
  expectedIndex: number | null;
  struck: ReadonlySet<number>;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'connect'): void;
  (e: 'select-device', id: string | null): void;
  (e: 'toggle-active', value: boolean): void;
}>();

const expectedNotes = computed<number[]>(() => {
  if (props.expectedIndex === null) return [];
  const group = props.chordGroups[props.expectedIndex];
  if (!group) return [];
  return [...group.midiSet].sort((a, b) => a - b);
});

function formatNote(midi: number): string {
  return `${midiToNoteName(midi)}${octaveOf(midi)}`;
}

function onConnect() {
  emit('connect');
}

function onDeviceChange(e: Event) {
  const id = (e.target as HTMLSelectElement).value;
  emit('select-device', id || null);
}

function onToggleActive(value: boolean) {
  emit('toggle-active', value);
}
</script>
