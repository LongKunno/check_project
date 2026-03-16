import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Header quan trọng để Brave cho phép truy cập Localhost từ nội bộ
    headers: {
      'Access-Control-Allow-Private-Network': 'true'
    },
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: false, // Để Brave nhận diện là cùng origin qua proxy
        rewrite: (path) => path.replace(/^\/api/, ''),
        timeout: 600000,
        proxyTimeout: 600000,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.error('Proxy Error:', err);
          });
        }
      }
    }
  }
})
