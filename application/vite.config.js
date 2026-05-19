import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || env.VITE_API_BASE_URL || ''
  const allowedHost = proxyTarget ? new URL(proxyTarget).hostname : undefined

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      port: 8101,
      host: true,
      ...(allowedHost ? { allowedHosts: [allowedHost] } : {}),
      ...(proxyTarget
        ? {
            proxy: {
              '/api': {
                target: proxyTarget,
                changeOrigin: true,
                secure: false,
                ws: true,
              },
            },
          }
        : {}),
    },
  }
})
