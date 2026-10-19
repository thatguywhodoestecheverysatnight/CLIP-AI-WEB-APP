import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, the same API router that runs on Vercel is mounted as middleware,
// so `npm run dev` gives you the full stack on one port.
const apiDev = () => ({
  name: 'clip-ai-api-dev',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url.startsWith('/api/')) return next();
      const mod = await server.ssrLoadModule('/server/router.js');
      return mod.default(req, res);
    });
  },
});

export default defineConfig({
  plugins: [react(), apiDev()],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
});
