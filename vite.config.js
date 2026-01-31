import { defineConfig } from 'vite';

const isDev = process.env.NODE_ENV === 'development';

export default defineConfig( {
  base: isDev ? '/' : '/xoxo/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        game: 'game.html',
      },
    },
  },
  server: {
    port: 3000,
  },
} );