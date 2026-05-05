import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "다이어트 노트",
        short_name: "다이어트노트",
        description: "체중, 운동, 단식, 비용을 기록하는 심플한 다이어트 노트",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "icon.svg",
            sizes: "192x192",
            type: "image/svg+xml"
          }
        ]
      }
    })
  ]
});
