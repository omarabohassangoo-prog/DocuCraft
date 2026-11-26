import express, { type Express } from 'express';
import dotenv from 'dotenv';
import { dbStore } from './core/db.ts';
import { cacheStore } from './core/cache.ts';
import { problemDetailsHandler } from './core/errors.ts';
import { authRouter } from './modules/auth.routes.ts';
import { publicRouter } from './modules/public.routes.ts';
import { commerceRouter } from './modules/commerce.routes.ts';
import { crudRouter } from './modules/crud.routes.ts';
import { adminRouter } from './modules/admin.routes.ts';

dotenv.config();

export function createApiApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));

  // Ensure Postgres state is initialized & synchronized before handling API/SEO requests
  app.use(async (req, res, next) => {
    if (
      req.path.startsWith('/api/') ||
      req.path === '/sitemap.xml' ||
      req.path === '/robots.txt' ||
      req.path === '/ads.txt'
    ) {
      try {
        await dbStore.ensureReady();
      } catch (err) {
        next(err);
        return;
      }
    }
    next();
  });

  // Security headers (OWASP Top 10)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      !req.path.startsWith('/api/v1/webhooks/')
    ) {
      const origin = req.headers.origin;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      if (origin && host) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host && !originHost.includes('localhost')) {
            res.status(403).json({ success: false, code: 'CSRF_ORIGIN_MISMATCH', title: 'Forbidden Origin' });
            return;
          }
        } catch {
          // ignore malformed origin
        }
      }
    }
    next();
  });

  // Health Probes (Kubernetes & Vercel Serverless)
  app.get('/api/v1/health/live', (_req, res) => {
    res.json({ status: 'ok', service: 'ufuq-modular-monolith', timestamp: new Date().toISOString() });
  });

  app.get('/api/v1/health/ready', (_req, res) => {
    const db = dbStore.snapshot();
    res.json({
      status: 'ready',
      runtime: process.env.VERCEL === '1' ? 'vercel-serverless' : 'node-server',
      storage: dbStore.isPostgresEnabled() ? 'postgresql' : 'file-store',
      database: { connected: true, tenants: db.tenants.length, tables: 30 },
      cache: cacheStore.stats(),
      timestamp: new Date().toISOString(),
    });
  });

  // OpenAPI 3.1 Specification Endpoint
  app.get('/api/v1/docs', (_req, res) => {
    res.json({
      openapi: '3.1.0',
      info: {
        title: 'Ufuq Multi-Vendor Commerce API',
        version: '1.0.0',
        description: 'Modular Monolith Multi-Tenant E-Commerce REST API',
      },
      paths: {
        '/api/v1/health/ready': { get: { summary: 'Readiness probe' } },
        '/api/v1/auth/login': { post: { summary: 'Authenticate user with optional 2FA challenge' } },
        '/api/v1/auth/register': { post: { summary: 'Register customer or vendor account' } },
        '/api/v1/auth/sidebar': { get: { summary: 'Resolve dynamic RBAC sidebar menu' } },
        '/api/v1/public/catalog': { get: { summary: 'Filterable multi-vendor product catalog' } },
        '/api/v1/checkout/initiate': { post: { summary: 'Atomic stock reservation and vendor sub-order split' } },
        '/api/v1/payments/capture': { post: { summary: 'Confirm tokenized payment and dispatch invoices' } },
        '/api/v1/crud/{resource}': { get: { summary: 'Paginated CRUD listing with Look Fields' } },
        '/api/v1/admin/env-secrets': { post: { summary: 'Encrypt and store service API secret with AES-256-GCM' } },
      },
    });
  });

  // Dynamic SEO Sitemap, Robots.txt & Ads.txt
  app.get('/sitemap.xml', (req, res) => {
    const db = dbStore.snapshot();
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const urls = [
      '/',
      '/store',
      '/stores',
      '/about',
      '/services',
      '/pricing',
      '/blog',
      '/contact',
      '/policies/privacy',
      '/policies/terms',
      '/policies/refund',
      ...db.products.filter((p) => p.status === 'active').map((p) => `/products/${p.slug}`),
      ...db.blog_posts.filter((b) => b.status === 'published').map((b) => `/blog/${b.slug}`),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${baseUrl}${u}</loc><changefreq>daily</changefreq></url>`)
      .join('\n')}\n</urlset>`;
    res.type('application/xml').send(xml);
  });

  app.get('/robots.txt', (_req, res) => {
    const db = dbStore.snapshot();
    const setting = db.system_settings.find(
      (s) => s.setting_group === 'seo' && s.setting_key === 'robots_txt'
    );
    const body =
      typeof setting?.setting_value === 'string'
        ? setting.setting_value
        : 'User-agent: *\nAllow: /\nDisallow: /dashboard/\nDisallow: /api/\nDisallow: /checkout';
    res.type('text/plain').send(body);
  });

  app.get('/ads.txt', (_req, res) => {
    const db = dbStore.snapshot();
    const unit = db.ad_units.find((a) => a.is_active);
    const pubId = unit?.adsense_client_id?.replace('ca-', '') || 'pub-7429103847102934';
    res.type('text/plain').send(`google.com, ${pubId}, DIRECT, f08c47fec0942fa0`);
  });

  // Modular API Routers
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/public', publicRouter);
  app.use('/api/v1', commerceRouter);
  app.use('/api/v1/crud', crudRouter);
  app.use('/api/v1/admin', adminRouter);

  // Unified RFC 9457 Error Handler
  app.use('/api', problemDetailsHandler);

  return app;
}
