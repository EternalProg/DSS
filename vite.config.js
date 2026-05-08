const path = require("path");
const { defineConfig } = require("vite");

module.exports = defineConfig({
  // Keep the existing /public folder as the Vite root.
  root: path.resolve(__dirname, "public"),
  build: {
    // Emit dist/ at repository root so Express can serve it.
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Frontend dev server -> backend API.
      "/api": {
        target: `http://localhost:${process.env.API_PORT || 3000}`,
        changeOrigin: true
      }
    }
  }
});
