import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { apiRouter } from './server/routes/api';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. Health check endpoints FIRST for immediate Cloud Run startup probes
  app.get(['/health', '/api/health'], (req, res) => {
    res.status(200).json({
      status: 'Healthy',
      service: 'AquaSpill-Server',
      port: PORT,
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Body parser with 100MB limit for imagery, chunks & archive uploads
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));
  app.use(express.raw({ type: 'application/octet-stream', limit: '100mb' }));

  // 3. Mount API router
  app.use('/api', apiRouter);
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found', path: req.path });
  });

  // 4. Vite development middleware vs Static Production bundle
  const isDev =
    process.env.NODE_ENV === 'development' ||
    process.env.npm_lifecycle_event === 'dev' ||
    (Boolean(process.argv[1] && process.argv[1].endsWith('server.ts')) && process.env.NODE_ENV !== 'production');

  const isProduction = !isDev;

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const cwdDist = path.join(process.cwd(), 'dist');
    const distPath = fs.existsSync(path.join(cwdDist, 'index.html'))
      ? cwdDist
      : (typeof __dirname !== 'undefined' && fs.existsSync(path.join(__dirname, 'index.html')))
      ? __dirname
      : cwdDist;

    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Aqua Spill: Frontend assets not found. Run npm run build.');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Aqua Spill] Server operational at http://0.0.0.0:${PORT} (${isProduction ? 'Production' : 'Development'})`);
  });

  // Graceful shutdown handling for Cloud Run container lifecycle
  const shutdown = () => {
    console.log('[Aqua Spill] Gracefully terminating server...');
    server.close(() => {
      console.log('[Aqua Spill] Server stopped.');
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('[Aqua Spill] Fatal error starting server:', err);
  process.exit(1);
});
