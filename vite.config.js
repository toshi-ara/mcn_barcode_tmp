import { defineConfig } from "vite";
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: "./",
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        "name": "MCN barcode reader (tmp)",
        "short_name": "barcode reader (tmp)",
        "start_url": "/mcn_barcode_tmp/",
        "scope": "/mcn_barcode_tmp/",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": "#317EFB",
        "icons": [
          {
            "src": "icons/icon-192.png",
            "sizes": "192x192",
            "type": "image/png"
          },
          {
            "src": "icons/icon-512.png",
            "sizes": "512x512",
            "type": "image/png"
          }
        ]
      }
    })
  ],
});

