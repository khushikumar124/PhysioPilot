import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The API is proxied so the browser sees a single origin. This also keeps
    // camera access on a secure context when tunnelling for a phone demo.
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET ?? "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  // MediaPipe ships its own wasm loader; keep it out of the dep pre-bundler.
  optimizeDeps: { exclude: ["@mediapipe/tasks-vision"] },
});
