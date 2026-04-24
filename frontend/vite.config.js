import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "^/(subjects|modules|note-groups|jobs|study-cards|question-cards|topic-chips|chat)": {
        target: "http://localhost:8000",
        changeOrigin: true
      }
    }
  }
});
