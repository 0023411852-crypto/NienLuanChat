import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = process.env.VITE_API_PROXY ?? 'http://127.0.0.1:4001';

// Config reload trigger for dark mode & proxy
export default defineConfig({
  plugins: [react()],
  build: {
    cssMinify: false, // Giữ CSS dễ đọc, xuống dòng bình thường
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': API,
      '/uploads': API,
    },
  },
});
