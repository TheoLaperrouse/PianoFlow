import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// https://vite.dev/config/
// Le `base` est piloté par PIANOFLOW_BASE pour pouvoir le surcharger en CI.
// Par défaut : `/pianoflow/` afin que le build fonctionne directement sur
// GitHub Pages (https://<user>.github.io/pianoflow/).
export default defineConfig(() => ({
  base: process.env.PIANOFLOW_BASE ?? '/pianoflow/',
  plugins: [vue(), tailwindcss()],
}));
