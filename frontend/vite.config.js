import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: path.resolve(__dirname, ".."),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  test: {
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"]
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "^/(auth|me|admin|subjects|public|modules|note-groups|jobs|study-cards|question-cards|topic-chips|topics|concepts|chat|routes)": {
        target: "http://localhost:8000",
        changeOrigin: true
      }
    }
  }
});
