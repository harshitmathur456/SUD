import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
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
