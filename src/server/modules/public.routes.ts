import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { dbStore } from '../core/db.ts';
import { cacheStore } from '../core/cache.ts';
import { AppError } from '../core/errors.ts';
import { attachTenantAndAuth, type AuthRequest } from '../core/auth-guard.ts';

export const publicRouter = Router();
publicRouter.use(attachTenantAndAuth);

publicRouter.get('/bootstrap', async (req, res) => {
  const authReq = req as AuthRequest;
  const tenantId = authReq.tenantId;

  const payload = await cacheStore.getOrSetWithLock(
    cacheStore.key(tenantId, 'settings:public'),
    300,
    () => {
      const db = dbStore.snapshot();
      const tenant = db.tenants.find((t) => t.id === tenantId);
      const settingsList = db.system_settings.filter(
        (s) => s.tenant_id === tenantId && s.is_public
      );
      const settings: Record<string, unknown> = {};
      for (const s of settingsList) {
        settings[`${s.setting_group}.${s.setting_key}`] = s.setting_value;
      }
      const categories = db.categories
        .filter((c) => c.tenant_id === tenantId && c.is_active)
        .sort((a, b) => a.sort_order - b.sort_order);
      const adUnits = db.ad_units.filter((a) => a.tenant_id === tenantId && a.is_active);
      return {
        tenant,
        settings,
        categories,
        adUnits,
        tenants: db.tenants.map((t) => ({ id: t.id, slug: t.slug, name: t.name })),
      };
    }
  );

  res.json({ success: true, data: payload });
});

publicRouter.get('/pages/:slug', async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const { slug } = req.params;
    const tenantId = authReq.tenantId;

    const pageData = await cacheStore.getOrSetWithLock(
      cacheStore.key(tenantId, `cms:page:${slug}`),
      300,
      () => {
        const db = dbStore.snapshot();
        const page = db.cms_pages.find(
          (p) => p.tenant_id === tenantId && (p.slug === slug || p.page_key === slug) && p.is_published
        );
        if (!page) return null;
        const sections = db.cms_sections
          .filter((s) => s.tenant_id === tenantId && s.page_id === page.id && s.is_visible)
          .sort((a, b) => a.sort_order - b.sort_order);
        return { page, sections };
      }
    );

    if (!pageData) {
      throw new AppError({ status: 404, code: 'PAGE_NOT_FOUND', message: 'CMS page not found' });
    }

    res.json({ success: true, data: pageData });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/blog', (req, res) => {
  const authReq = req as AuthRequest;
  const db = dbStore.snapshot();
  const posts = db.blog_posts
    .filter((b) => b.tenant_id === authReq.tenantId && b.status === 'published')
    .map((b) => {
      const author = db.users.find((u) => u.id === b.author_id);
      return { ...b, author_name: author?.full_name || 'Editorial Team' };
    });
  res.json({ success: true, data: { posts } });
});

publicRouter.get('/blog/:slug', (req, res, next) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const db = dbStore.snapshot();
    const post = db.blog_posts.find(
      (b) => b.tenant_id === authReq.tenantId && b.slug === req.params.slug && b.status === 'published'
    );
    if (!post) {
      throw new AppError({ status: 404, code: 'POST_NOT_FOUND', message: 'Article not found' });
    }
    const author = db.users.find((u) => u.id === post.author_id);
    res.json({ success: true, data: { post: { ...post, author_name: author?.full_name || 'Editorial Team' } } });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/catalog', (req, res) => {
  const authReq = req as AuthRequest;
  const db = dbStore.snapshot();
  const search = String(req.query.search || '').trim().toLowerCase();
  const categorySlug = String(req.query.category || '').trim();
  const vendorSlug = String(req.query.vendor || '').trim();
  const featuredOnly = req.query.featured === 'true';
  const sort = String(req.query.sort || 'newest');

  let items = db.products.filter(
    (p) => p.tenant_id === authReq.tenantId && p.status === 'active' && !p.deleted_at
  );

  if (featuredOnly) {
    items = items.filter((p) => p.is_featured);
  }

  if (categorySlug && categorySlug !== 'all') {
    const cat = db.categories.find((c) => c.slug === categorySlug && c.tenant_id === authReq.tenantId);
    if (cat) items = items.filter((p) => p.category_id === cat.id);
  }

  if (vendorSlug && vendorSlug !== 'all') {
    const vnd = db.vendors.find((v) => v.store_slug === vendorSlug && v.tenant_id === authReq.tenantId);
    if (vnd) items = items.filter((p) => p.vendor_id === vnd.id);
  }

  if (search) {
    items = items.filter(
      (p) =>
        p.title_i18n.ar.toLowerCase().includes(search) ||
        p.title_i18n.en.toLowerCase().includes(search) ||
        p.description_i18n.ar.toLowerCase().includes(search) ||
        p.description_i18n.en.toLowerCase().includes(search)
    );
  }

  if (sort === 'price_asc') items.sort((a, b) => a.base_price - b.base_price);
  else if (sort === 'price_desc') items.sort((a, b) => b.base_price - a.base_price);
  else if (sort === 'rating') items.sort((a, b) => b.rating_avg - a.rating_avg);
  else items.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const enriched = items.map((p) => {
    const vendor = db.vendors.find((v) => v.id === p.vendor_id);
    const category = db.categories.find((c) => c.id === p.category_id);
    const variants = db.product_variants.filter((v) => v.product_id === p.id && v.is_active);
    const totalStock = variants.reduce((acc, v) => acc + Math.max(0, v.stock_qty - v.reserved_qty), 0);
    return {
      ...p,
      vendor: vendor ? { id: vendor.id, store_slug: vendor.store_slug, store_name_i18n: vendor.store_name_i18n } : null,
      category: category ? { id: category.id, slug: category.slug, name_i18n: category.name_i18n } : null,
      variants,
      available_stock: totalStock,
    };
  });

  res.json({ success: true, data: { products: enriched } });
});

publicRouter.get('/products/:slug', (req, res, next) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const db = dbStore.snapshot();
    const product = db.products.find(
      (p) => p.tenant_id === authReq.tenantId && p.slug === req.params.slug && !p.deleted_at
    );
    if (!product) {
      throw new AppError({ status: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });
    }
    const vendor = db.vendors.find((v) => v.id === product.vendor_id);
    const category = db.categories.find((c) => c.id === product.category_id);
    const variants = db.product_variants.filter((v) => v.product_id === product.id && v.is_active);
    res.json({
      success: true,
      data: {
        product: {
          ...product,
          vendor,
          category,
          variants,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/stores', (req, res) => {
  const authReq = req as AuthRequest;
  const db = dbStore.snapshot();
  const stores = db.vendors
    .filter((v) => v.tenant_id === authReq.tenantId && v.is_active)
    .map((v) => ({
      ...v,
      product_count: db.products.filter((p) => p.vendor_id === v.id && p.status === 'active' && !p.deleted_at).length,
    }));
  res.json({ success: true, data: { stores } });
});

publicRouter.post('/contact', async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const rl = cacheStore.checkRateLimit(`rl:contact:${req.ip}`, 5, 600);
    if (!rl.allowed) {
      throw new AppError({ status: 429, code: 'RATE_LIMITED', message: 'Contact form rate limit reached. Please wait a few minutes.' });
    }

    const parsed = z
      .object({
        sender_name: z.string().min(2).max(120),
        sender_email: z.string().email(),
        sender_phone: z.string().max(30).optional(),
        subject: z.string().min(3).max(200),
        message: z.string().min(10).max(2000),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      throw new AppError({ status: 400, code: 'VALIDATION_ERROR', message: 'Please complete all required inquiry fields.' });
    }

    const inquiry = await dbStore.withTransaction((db) => {
      const record = {
        id: crypto.randomUUID(),
        tenant_id: authReq.tenantId,
        sender_name: parsed.data.sender_name,
        sender_email: parsed.data.sender_email,
        sender_phone: parsed.data.sender_phone || null,
        subject: parsed.data.subject,
        message: parsed.data.message,
        status: 'new' as const,
        created_at: new Date().toISOString(),
      };
      db.contact_inquiries.unshift(record);
      return record;
    });

    res.status(201).json({ success: true, data: { inquiry } });
  } catch (err) {
    next(err);
  }
});
