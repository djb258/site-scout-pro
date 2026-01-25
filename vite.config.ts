import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@sys": path.resolve(__dirname, "./src/sys"),
      "@data": path.resolve(__dirname, "./src/data"),
      "@app": path.resolve(__dirname, "./src/app"),
      "@ai": path.resolve(__dirname, "./src/ai"),
      "@ui": path.resolve(__dirname, "./src/ui"),
    },
  },
}));
