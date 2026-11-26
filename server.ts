import dotenv from 'dotenv';
import express from 'express';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });

async function startServer() {
  const [{ createServer: createViteServer }, { createApiApp }, { dbStore }] = await Promise.all([
    import('vite'),
    import('./src/server/app.ts'),
    import('./src/server/core/db.ts'),
  ]);

  await dbStore.ensureReady().catch((err) => {
    console.warn('Database initialization notice:', err instanceof Error ? err.message : err);
  });

  const app = createApiApp();
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Ufuq Multi-Vendor Commerce server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
