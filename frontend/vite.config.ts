import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: true,
    port: 9000,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 9000,
      overlay: false,
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true, // ✅ CRITICAL: Cleans old files before building
    sourcemap: false,
    minify: 'esbuild', // Uses built-in esbuild - no extra install needed
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
