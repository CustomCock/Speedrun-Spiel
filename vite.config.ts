// Vite-Konfiguration. "base: './'" sorgt dafür, dass der fertige Build
// auch aus einem Unterordner (z. B. GitHub Pages) funktioniert.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
