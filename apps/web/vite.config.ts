import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL("../../", import.meta.url));
  const environment = loadEnv(mode, envDir, "");
  return {
    envDir,
    server: {
      port: Number(environment.AI_NOTES_WEB_PORT ?? 5173),
      proxy: {
        "/api": environment.AI_NOTES_API_URL ?? "http://127.0.0.1:8787",
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icon.svg"],
        manifest: {
          name: "AI Notes",
          short_name: "AI Notes",
          description: "A quiet, local-first notebook and knowledge workspace.",
          theme_color: "#f6f4ef",
          background_color: "#f6f4ef",
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/icon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,woff2}"],
          navigateFallback: "/index.html",
        },
      }),
    ],
  };
});
