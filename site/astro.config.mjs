import { defineConfig } from 'astro/config';

// The site is generated from repository markdown staged into site/public/ by
// ../scripts/build-pages.mjs, then built here. Static output, no client
// hydration: the whole page is one document built from committed data.
export default defineConfig({
  outDir: './dist',
  publicDir: './public',
  build: {
    format: 'directory',
  },
  devToolbar: { enabled: false },
});
