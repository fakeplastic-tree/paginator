import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      babel: {
        plugins: mode === 'development' ? [['babel-plugin-react-compiler']] : [],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 10000,
    allowedHosts: ['paginator.onrender.com', 'localhost'],  
  },
}))
