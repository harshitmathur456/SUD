import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api/stream': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        ws: true
      },
      '/api/health': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      },
      '/api/cameras': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      },
      '/api/search': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      },
      '/api/watchlist': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      },
      '/api/alerts': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      },
      '/api/anpr': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      }
    }
  },
  plugins: [
    {
      name: 'pipeline-api-middleware',
      configureServer(server) {
        // Serve real-time output/detections.json from disk to frontend
        server.middlewares.use('/api/pipeline-detections', (req, res) => {
          const filePath = path.resolve(process.cwd(), 'output', 'detections.json');
          if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(data);
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify([]));
          }
        });
      }
    }
  ]
});
