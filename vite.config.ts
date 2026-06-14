import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Relative base so the build works on any GitHub Pages path
// (user.github.io/<repo>/) without knowing the repo name.
export default defineConfig({
  base: './',
  plugins: [svelte()],
  server: { port: 5173, host: true },
});
