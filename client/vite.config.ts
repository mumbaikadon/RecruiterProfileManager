import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),            // client/src
      "@shared": path.resolve(__dirname, "../shared") // shared folder outside client
    },
  },
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  define: {
    // Only expose safe env vars
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'process.env.API_URL': JSON.stringify(process.env.API_URL),
  }
});
