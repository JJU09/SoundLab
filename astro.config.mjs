// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://JJU09.github.io',
  base: '/SoundLab',
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [sitemap()],
});