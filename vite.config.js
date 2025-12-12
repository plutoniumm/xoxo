import { defineConfig } from 'vite';

const isDev = process.env.NODE_ENV === 'development';

export default defineConfig( {
  base: isDev ? '/' : '/xoxo/',
  server: {
    port: 3000,
  },
} );