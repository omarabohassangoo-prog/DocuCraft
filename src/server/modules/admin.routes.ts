import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { dbStore } from '../core/db.ts';
import { cacheStore } from '../core/cache.ts';
import { encryptSecret, maskSecret } from '../core/crypto.ts';
import { resolveTenantSecret } from '../core/secrets.ts';
import { AppError } from '../core/errors.ts';
import {
  attachTenantAndAuth,
  requireAuth,
  requirePermission,
  recordAuditLog,
  type AuthRequest,
} from '../core/auth-guard.ts';
import { pingPaymentGateway } from '../services/payments.service.ts';
import { pingNotificationProvider } from '../services/notifications.service.ts';
import { pingStorageProvider } from '../services/storage.service.ts';

export const adminRouter = Router();
adminRouter.use(attachTenantAndAuth);
adminRouter.use(requireAuth);

const MONTH_NAMES = [
  'يناير / Jan',
  'فبراير / Feb',
  'مارس / Mar',
  'أبريل / Apr',
  'مايو / May',
  'يونيو / Jun',
  'يوليو / Jul',
  'أغسطس / Aug',
  'سبتمبر / Sep',
  'أكتوبر / Oct',
  'نوفمبر / Nov',
  'ديسمبر / Dec',
];

adminRouter.get('/dashboard/analytics', (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const db = dbStore.snapshot();
    const tid = authReq.tenantId;
    const user = authReq.authUser!;

    if (!['super_admin', 'vendor'].includes(user.user_type)) {
      throw new AppError({
        status: 403,
        code: 'FORBIDDEN',
        message: 'Financial analytics are restricted to Super Admin and Vendor workspaces',
      });
    }

    const ownedVendorIds = new Set(
      db.vendors
        .filter((v) => v.tenant_id === tid && v.owner_user_id === user.id)
        .map((v) => v.id)
    );
    if (user.vendor_id) ownedVendorIds.add(user.vendor_id);
    const isVendor = user.user_type === 'vendor';

    const orders = db.orders.filter((o) => o.tenant_id === tid);
    const orderMap = new Map(orders.map((o) => [o.id, o]));

    const suborders = db.vendor_suborders.filter((s) => {
      if (s.tenant_id !== tid) return false;
      if (isVendor) return ownedVendorIds.has(s.vendor_id);
      return true;
    });
    const paidSuborders = suborders.filter((suborder) => {
      const order = orderMap.get(suborder.order_id);
      return order?.payment_status === 'paid' && order.order_status !== 'cancelled';
    });

    const grossRevenue = paidSuborders.reduce((acc, s) => acc + s.gross_amount, 0);
    const platformCommission = paidSuborders.reduce((acc, s) => acc + s.commission_amount, 0);
    const vendorNet = paidSuborders.reduce((acc, s) => acc + s.vendor_net_amount, 0);
    const activeVendors = isVendor
      ? db.vendors.filter((v) => v.tenant_id === tid && ownedVendorIds.has(v.id) && v.is_active).length
      : db.vendors.filter((v) => v.tenant_id === tid && v.is_active).length;
    const activeProducts = db.products.filter((p) => {
      if (p.tenant_id !== tid || p.deleted_at || p.status !== 'active') return false;
      if (isVendor) return ownedVendorIds.has(p.vendor_id);
      return true;
    }).length;
    const lowStockVariants = db.product_variants.filter((v) => {
      if (v.tenant_id !== tid) return false;
      if (isVendor) {
        const prod = db.products.find((p) => p.id === v.product_id);
        if (!prod || !ownedVendorIds.has(prod.vendor_id)) return false;
      }
      return v.stock_qty <= v.low_stock_threshold;
    });

    const now = new Date();
    const buckets = new Map<string, { month: string; revenue: number; commission: number; orders: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, { month: MONTH_NAMES[d.getMonth()], revenue: 0, commission: 0, orders: 0 });
    }

    const countedOrdersPerBucket = new Set<string>();
    for (const s of paidSuborders) {
      const parentOrder = orderMap.get(s.order_id);
      const createdAt = parentOrder?.created_at || s.updated_at;
      const d = new Date(createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.revenue = Number((bucket.revenue + s.gross_amount).toFixed(2));
        bucket.commission = Number((bucket.commission + s.commission_amount).toFixed(2));
        const orderBucketKey = `${key}:${s.order_id}`;
        if (!countedOrdersPerBucket.has(orderBucketKey)) {
          countedOrdersPerBucket.add(orderBucketKey);
          bucket.orders += 1;
        }
      }
    }

    const monthlySeries = Array.from(buckets.values());
    const paidDistinctOrders = new Set(paidSuborders.map((s) => s.order_id)).size;

    res.json({
      success: true,
      data: {
        kpis: {
          grossRevenue,
          platformCommission,
          vendorNet,
          totalOrders: paidDistinctOrders,
          suborderCount: paidSuborders.length,
          activeVendors,
          activeProducts,
          lowStockCount: lowStockVariants.length,
          pendingVendors: isVendor ? 0 : db.vendors.filter((v) => v.tenant_id === tid && v.kyc_status === 'pending').length,
          openInquiries: isVendor ? 0 : db.contact_inquiries.filter((c) => c.tenant_id === tid && c.status !== 'resolved').length,
        },
        lowStockVariants,
        monthlySeries,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Operational workspace summary for Moderator & Staff (no sensitive platform financial ledger)
adminRouter.get('/workspace/summary', (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.authUser!;
    if (!['super_admin', 'moderator', 'staff'].includes(user.user_type)) {
      throw new AppError({ status: 403, code: 'FORBIDDEN', message: 'Access denied to workspace summary' });
    }
    const db = dbStore.snapshot();
    const tid = authReq.tenantId;

    const pendingVendors = db.vendors.filter((v) => v.tenant_id === tid && v.kyc_status === 'pending').length;
    const verifiedVendors = db.vendors.filter((v) => v.tenant_id === tid && v.kyc_status === 'verified').length;
    const activeProducts = db.products.filter((p) => p.tenant_id === tid && !p.deleted_at && p.status === 'active').length;
    const draftProducts = db.products.filter((p) => p.tenant_id === tid && !p.deleted_at && p.status !== 'active').length;
    const openInquiries = db.contact_inquiries.filter((c) => c.tenant_id === tid && c.status !== 'resolved').length;
    const pendingSuborders = db.vendor_suborders.filter(
      (s) => s.tenant_id === tid && ['pending', 'packed'].includes(s.fulfillment_status)
    ).length;
    const shippedSuborders = db.vendor_suborders.filter(
      (s) => s.tenant_id === tid && ['shipped', 'delivered'].includes(s.fulfillment_status)
    ).length;

    res.json({
      success: true,
      data: {
        pendingVendors,
        verifiedVendors,
        activeProducts,
        draftProducts,
        openInquiries,
        pendingSuborders,
        shippedSuborders,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Vendor Store Settings (Read & Update owned vendor storefronts)
adminRouter.get('/vendor/store-settings', (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.authUser!;
    if (!['super_admin', 'vendor'].includes(user.user_type)) {
      throw new AppError({ status: 403, code: 'FORBIDDEN', message: 'Vendor workspace only' });
    }
    const db = dbStore.snapshot();
    const stores = db.vendors.filter(
      (v) => v.tenant_id === authReq.tenantId && (user.user_type === 'super_admin' || v.owner_user_id === user.id || v.id === user.vendor_id)
    );
    res.json({ success: true, data: { stores } });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/vendor/store-settings', async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.authUser!;
    if (!['super_admin', 'vendor'].includes(user.user_type)) {
      throw new AppError({ status: 403, code: 'FORBIDDEN', message: 'Vendor workspace only' });
    }
    const parsed = z
      .object({
        vendor_id: z.string().min(1),
        store_name_ar: z.string().min(2).max(120),
        store_name_en: z.string().min(2).max(120),
        tagline_ar: z.string().max(240).optional().default(''),
        tagline_en: z.string().max(240).optional().default(''),
        commercial_reg_no: z.string().max(80).nullable().optional(),
        logo_file_id: z.string().nullable().optional(),
      })
      .parse(req.body);

    const updated = await dbStore.withTransaction((db) => {
      const vendor = db.vendors.find((v) => v.id === parsed.vendor_id && v.tenant_id === authReq.tenantId);
      if (!vendor) {
        throw new AppError({ status: 404, code: 'VENDOR_NOT_FOUND', message: 'Vendor store not found' });
      }
      if (user.user_type === 'vendor' && vendor.owner_user_id !== user.id && vendor.id !== user.vendor_id) {
        throw new AppError({ status: 403, code: 'FORBIDDEN', message: 'Cannot edit another vendor storefront' });
      }
      vendor.store_name_i18n = { ar: parsed.store_name_ar.trim(), en: parsed.store_name_en.trim() };
      vendor.tagline_i18n = { ar: parsed.tagline_ar.trim(), en: parsed.tagline_en.trim() };
      if (parsed.commercial_reg_no !== undefined) {
        vendor.commercial_reg_no = parsed.commercial_reg_no ? parsed.commercial_reg_no.trim() : null;
      }
      if (parsed.logo_file_id !== undefined) {
        vendor.logo_file_id = parsed.logo_file_id;
      }
      return vendor;
    });

    cacheStore.invalidatePrefix(cacheStore.key(authReq.tenantId, ''));
    await recordAuditLog({
      tenantId: authReq.tenantId,
      actorUserId: user.id,
      action: 'vendor.settings_updated',
      entityType: 'vendors',
      entityId: updated.id,
      newValues: { store_name_i18n: updated.store_name_i18n },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { store: updated } });
  } catch (err) {
    next(err);
  }
});

// System Settings & SEO
adminRouter.get('/settings', requirePermission('system.settings.manage'), (req, res) => {
  const authReq = req as AuthRequest;
  const db = dbStore.snapshot();
  const settings = db.system_settings.filter((s) => s.tenant_id === authReq.tenantId);
  const adUnits = db.ad_units.filter((a) => a.tenant_id === authReq.tenantId);
  res.json({ success: true, data: { settings, adUnits } });
});

adminRouter.put('/settings', requirePermission('system.settings.manage'), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const { updates } = z
      .object({
        updates: z.array(
          z.object({
            setting_group: z.enum(['general', 'theme', 'seo', 'analytics', 'feature_flags', 'ecommerce']),
            setting_key: z.string().min(1),
            setting_value: z.unknown(),
            is_public: z.boolean().optional(),
          })
        ),
      })
      .parse(req.body);

    const invalidSetting = updates.find((update) => {
      if (update.setting_group === 'ecommerce' && update.setting_key === 'vat_rate') {
        return typeof update.setting_value !== 'number' || !Number.isFinite(update.setting_value) || update.setting_value < 0 || update.setting_value > 100;
      }
      if (update.setting_group === 'theme' && ['brand_primary_color', 'brand_accent_color'].includes(update.setting_key)) {
        return typeof update.setting_value !== 'string' || !/^#[0-9a-f]{6}$/i.test(update.setting_value);
      }
      if (update.setting_group === 'analytics' && update.setting_key === 'ga4_measurement_id') {
        return typeof update.setting_value !== 'string' || (update.setting_value !== '' && !/^G-[A-Z0-9]{6,}$/i.test(update.setting_value));
      }
      if (update.setting_group === 'seo' && update.setting_key === 'robots_txt') {
        return typeof update.setting_value !== 'string' || update.setting_value.length > 10000;
      }
      return false;
    });
    if (invalidSetting) {
      throw new AppError({ status: 400, code: 'INVALID_SETTING_VALUE', message: `Invalid value for ${invalidSetting.setting_key}` });
    }

    await dbStore.withTransaction((db) => {
      const nowIso = new Date().toISOString();
      for (const u of updates) {
        const existing = db.system_settings.find(
          (s) =>
            s.tenant_id === authReq.tenantId &&
            s.setting_group === u.setting_group &&
            s.setting_key === u.setting_key
        );
        if (existing) {
          existing.setting_value = u.setting_value;
          if (typeof u.is_public === 'boolean') existing.is_public = u.is_public;
          existing.updated_by = authReq.authUser!.id;
          existing.updated_at = nowIso;
        } else {
          db.system_settings.push({
            id: crypto.randomUUID(),
            tenant_id: authReq.tenantId,
            setting_group: u.setting_group,
            setting_key: u.setting_key,
            setting_value: u.setting_value,
            is_public: u.is_public ?? false,
            updated_by: authReq.authUser!.id,
            updated_at: nowIso,
          });
        }
      }
    });

    cacheStore.invalidatePrefix(cacheStore.key(authReq.tenantId, 'settings'));
    await recordAuditLog({
      tenantId: authReq.tenantId,
      actorUserId: authReq.authUser!.id,
      action: 'settings.updated',
      entityType: 'system_settings',
      entityId: null,
      newValues: { keys: updates.map((u) => `${u.setting_group}.${u.setting_key}`) },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { updated: updates.length } });
  } catch (err) {
    next(err);
  }
});

// AdSense Units Management
adminRouter.post('/adsense', requirePermission('seo.ads.manage'), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const parsed = z
      .object({
        id: z.string().optional(),
        name: z.string().min(2),
        adsense_client_id: z.string().regex(/^ca-pub-\d{16}$/),
        adsense_slot_id: z.string().min(4),
        placement: z.enum(['blog_sidebar', 'catalog_top', 'home_mid', 'article_middle']),
        ad_format: z.enum(['auto', 'rectangle', 'horizontal']).default('auto'),
        is_active: z.boolean().default(true),
      })
      .parse(req.body);

    const unit = await dbStore.withTransaction((db) => {
      const nowIso = new Date().toISOString();
      if (parsed.id) {
        const existing = db.ad_units.find((a) => a.id === parsed.id && a.tenant_id === authReq.tenantId);
        if (existing) {
          Object.assign(existing, parsed, { updated_at: nowIso });
          return existing;
        }
      }
      const created = {
        id: crypto.randomUUID(),
        tenant_id: authReq.tenantId,
        name: parsed.name,
        adsense_client_id: parsed.adsense_client_id,
        adsense_slot_id: parsed.adsense_slot_id,
        placement: parsed.placement,
        ad_format: parsed.ad_format,
        is_active: parsed.is_active,
        updated_at: nowIso,
      };
      db.ad_units.push(created);
      return created;
    });

    cacheStore.invalidatePrefix(cacheStore.key(authReq.tenantId, 'settings'));
    res.json({ success: true, data: { unit } });
  } catch (err) {
    next(err);
  }
});

// Encrypted Secrets Vault (.env secrets encrypted via AES-256-GCM; never returns plaintext)
adminRouter.get('/env-secrets', requirePermission('system.settings.manage'), (req, res) => {
  const authReq = req as AuthRequest;
  const db = dbStore.snapshot();
  const secrets = db.encrypted_secrets
    .filter((s) => s.tenant_id === authReq.tenantId)
    .map((s) => ({
      id: s.id,
      service_name: s.service_name,
      env_key: s.env_key,
      masked_preview: s.masked_preview,
      key_version: s.key_version,
      last_synced_at: s.last_synced_at,
      updated_at: s.updated_at,
    }));

  const envConfiguredKeys = [
    { service_name: 'stripe', env_key: 'STRIPE_SECRET_KEY', configured_in_env: Boolean(process.env.STRIPE_SECRET_KEY) },
    { service_name: 'paypal', env_key: 'PAYPAL_CLIENT_ID', configured_in_env: Boolean(process.env.PAYPAL_CLIENT_ID) },
    { service_name: 'mada_tap', env_key: 'TAP_SECRET_KEY', configured_in_env: Boolean(process.env.TAP_SECRET_KEY) },
    { service_name: 'email', env_key: 'RESEND_API_KEY', configured_in_env: Boolean(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY) },
    { service_name: 'sms', env_key: 'TWILIO_AUTH_TOKEN', configured_in_env: Boolean(process.env.TWILIO_AUTH_TOKEN) },
    { service_name: 'whatsapp', env_key: 'WHATSAPP_ACCESS_TOKEN', configured_in_env: Boolean(process.env.WHATSAPP_ACCESS_TOKEN) },
    { service_name: 'storage', env_key: 'STORAGE_ACCESS_KEY_ID', configured_in_env: Boolean(process.env.STORAGE_ACCESS_KEY_ID) },
  ];

  res.json({ success: true, data: { secrets, envConfiguredKeys } });
});

adminRouter.post('/env-secrets', requirePermission('system.settings.manage'), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const { service_name, env_key, plaintext_value } = z
      .object({
        service_name: z.string().min(2).max(60),
        env_key: z.string().regex(/^[A-Z0-9_]+$/),
        plaintext_value: z.string().min(4).max(500),
      })
      .parse(req.body);

    const enc = encryptSecret(plaintext_value, authReq.tenantId);
    const masked = maskSecret(plaintext_value);
    const nowIso = new Date().toISOString();

    const saved = await dbStore.withTransaction((db) => {
      const existing = db.encrypted_secrets.find(
        (s) => s.tenant_id === authReq.tenantId && s.env_key === env_key
      );
      if (existing) {
        existing.ciphertext = enc.ciphertext;
        existing.iv = enc.iv;
        existing.auth_tag = enc.auth_tag;
        existing.key_version += 1;
        existing.masked_preview = masked;
        existing.last_synced_at = nowIso;
        existing.updated_by = authReq.authUser!.id;
        existing.updated_at = nowIso;
        return existing;
      }
      const rec = {
        id: crypto.randomUUID(),
        tenant_id: authReq.tenantId,
        service_name,
        env_key,
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        auth_tag: enc.auth_tag,
        key_version: 1,
        masked_preview: masked,
        last_synced_at: nowIso,
        updated_by: authReq.authUser!.id,
        updated_at: nowIso,
      };
      db.encrypted_secrets.push(rec);
      return rec;
    });

    await recordAuditLog({
      tenantId: authReq.tenantId,
      actorUserId: authReq.authUser!.id,
      action: 'secret.rotated',
      entityType: 'encrypted_secrets',
      entityId: saved.id,
      newValues: { service_name, env_key, masked_preview: masked },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: {
        id: saved.id,
        service_name: saved.service_name,
        env_key: saved.env_key,
        masked_preview: saved.masked_preview,
        key_version: saved.key_version,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Real Live HTTP Ping against external service providers
adminRouter.post('/env-secrets/test-connection', requirePermission('system.settings.manage'), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const { service_name } = z.object({ service_name: z.string().min(1) }).parse(req.body);
    const db = dbStore.snapshot();

    let result: {
      configured: boolean;
      status: 'verified' | 'auth_failed' | 'not_configured';
      message: string;
      latency_ms: number;
    };

    if (service_name === 'stripe' || service_name === 'paypal' || service_name === 'mada_tap') {
      result = await pingPaymentGateway(db, authReq.tenantId, service_name);
    } else if (service_name === 'email' || service_name === 'sms' || service_name === 'whatsapp') {
      result = await pingNotificationProvider(db, authReq.tenantId, service_name);
    } else if (service_name === 'storage') {
      result = await pingStorageProvider(db, authReq.tenantId);
    } else {
      const hasAny = Boolean(resolveTenantSecret(db, authReq.tenantId, service_name));
      result = {
        configured: hasAny,
        status: hasAny ? 'verified' : 'not_configured',
        message: hasAny ? 'Secret key present in server vault/env' : 'Not configured',
        latency_ms: 0,
      };
    }

    res.json({
      success: true,
      data: {
        service_name,
        configured: result.configured,
        status: result.status,
        message: result.message,
        latency_ms: result.latency_ms,
        checked_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// CMS Page & Section Editor
adminRouter.get('/cms/pages', requirePermission('cms.manage'), (req, res) => {
  const authReq = req as AuthRequest;
  const db = dbStore.snapshot();
  const pages = db.cms_pages
    .filter((p) => p.tenant_id === authReq.tenantId)
    .map((p) => ({
      ...p,
      sections: db.cms_sections
        .filter((s) => s.page_id === p.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));
  res.json({ success: true, data: { pages } });
});

adminRouter.put('/cms/sections/:id', requirePermission('cms.manage'), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const { content_i18n, is_visible } = z
      .object({
        content_i18n: z.object({
          ar: z.record(z.string(), z.unknown()),
          en: z.record(z.string(), z.unknown()),
        }),
        is_visible: z.boolean().optional(),
      })
      .parse(req.body);

    const updated = await dbStore.withTransaction((db) => {
      const sec = db.cms_sections.find(
        (s) => s.id === req.params.id && s.tenant_id === authReq.tenantId
      );
      if (!sec) throw new AppError({ status: 404, code: 'SECTION_NOT_FOUND', message: 'CMS section not found' });
      sec.content_i18n = content_i18n;
      if (typeof is_visible === 'boolean') sec.is_visible = is_visible;
      sec.updated_at = new Date().toISOString();
      return sec;
    });

    cacheStore.invalidatePrefix(cacheStore.key(authReq.tenantId, 'cms:'));
    await recordAuditLog({
      tenantId: authReq.tenantId,
      actorUserId: authReq.authUser!.id,
      action: 'cms.section_updated',
      entityType: 'cms_sections',
      entityId: updated.id,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { section: updated } });
  } catch (err) {
    next(err);
  }
});

// RBAC Matrix Overview
adminRouter.get('/rbac/matrix', requirePermission('rbac.manage'), (req, res) => {
  const authReq = req as AuthRequest;
  const db = dbStore.snapshot();
  const roles = db.roles
    .filter((r) => r.tenant_id === authReq.tenantId)
    .map((r) => {
      const permIds = db.role_permissions
        .filter((rp) => rp.role_id === r.id)
        .map((rp) => rp.permission_id);
      return {
        ...r,
        permissions: db.permissions.filter((p) => permIds.includes(p.id)),
      };
    });
  res.json({ success: true, data: { roles, allPermissions: db.permissions } });
});
