import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// En desarrollo, /api va al backend local (puerto 3000). Con `npm run dev:prod` va al servidor de producción,
// para revisar la web nueva con los datos reales (¡cuidado: borrar u ocultar registros afecta producción!).
const API_PRODUCCION = 'https://services.planinfor.cl:8091';

export default defineConfig(({ mode }) => ({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'MINGEO IRF - Control de Riesgos',
        short_name: 'MINGEO IRF',
        description: 'Aplicación Offline para Intervención y Riesgos en Faenas',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: mode === 'produccion' ? API_PRODUCCION : 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
}));
