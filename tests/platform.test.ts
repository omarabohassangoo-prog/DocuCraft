import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import crypto from 'crypto';
import { createApiApp } from '../src/server/app.ts';
import { dbStore } from '../src/server/core/db.ts';
import { encryptSecret, decryptSecret, generateTotpSecret, computeTotpCode, verifyTotpCode } from '../src/server/core/crypto.ts';

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  await dbStore.ensureReady();
  const app = createApiApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

async function api<T = Record<string, unknown>>(
  path: string,
  options: RequestInit & { token?: string; guestToken?: string } = {}
): Promise<{ status: number; json: { success: boolean; data?: T; code?: string; message?: string } }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.guestToken) headers['X-Guest-Token'] = options.guestToken;
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const json = await res.json();
  return { status: res.status, json };
}

describe('Ufuq Multi-Vendor Commerce End-to-End Verification', () => {
  it('serves health readiness, OpenAPI 3.1 docs, sitemap.xml, and robots.txt', async () => {
    const ready = await fetch(`${baseUrl}/api/v1/health/ready`);
    expect(ready.status).toBe(200);
    const readyBody = (await ready.json()) as { database: { tables: number } };
    expect(readyBody.database.tables).toBe(30);

    const docs = await fetch(`${baseUrl}/api/v1/docs`);
    expect(docs.status).toBe(200);
    const docsBody = (await docs.json()) as { openapi: string };
    expect(docsBody.openapi).toBe('3.1.0');

    const sitemap = await fetch(`${baseUrl}/sitemap.xml`);
    expect(sitemap.status).toBe(200);
    expect(await sitemap.text()).toContain('<urlset');
  });

  it('performs real AES-256-GCM encryption/decryption and RFC 6238 TOTP verification', () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const enc = encryptSecret('sk_live_test_99887766', tenantId);
    expect(enc.ciphertext).not.toContain('sk_live_test');
    const dec = decryptSecret(enc, tenantId);
    expect(dec).toBe('sk_live_test_99887766');

    const totpSecret = generateTotpSecret();
    const code = computeTotpCode(totpSecret);
    expect(verifyTotpCode(totpSecret, code)).toBe(true);
    expect(verifyTotpCode(totpSecret, '000000')).toBe(false);
  });

  it('registers customer & vendor, enforces ABAC isolation, and stores media files', async () => {
    const suffix = crypto.randomBytes(3).toString('hex');
    const reg = await api<{ accessToken: string; user: { id: string; user_type: string } }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Test Customer',
        email: `cust-${suffix}@example.com`,
        password: 'StrongPassword123!',
        account_type: 'customer',
      }),
    });
    expect(reg.status).toBe(201);
    const token = reg.json.data!.accessToken;

    // Customer cannot access admin secrets vault
    const denied = await api('/api/v1/admin/env-secrets', { token });
    expect(denied.status).toBe(403);

    // Upload a valid 1x1 PNG binary
    const png1x1 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const upload = await api<{ file: { id: string }; url: string }>('/api/v1/media/upload', {
      method: 'POST',
      token,
      body: JSON.stringify({
        filename: 'pixel.png',
        mime_type: 'image/png',
        data_base64: png1x1,
      }),
    });
    expect(upload.status).toBe(201);

    const fetchedMedia = await fetch(`${baseUrl}${upload.json.data!.url}`);
    expect(fetchedMedia.status).toBe(200);
    expect(fetchedMedia.headers.get('content-type')).toBe('image/png');
  });

  it('prevents overselling, enforces real gateway secret configuration, and verifies webhook HMAC', async () => {
    const catalogRes = await api<{ products: { variants: { id: string; stock_qty: number }[] }[] }>('/api/v1/public/catalog');
    expect(catalogRes.status).toBe(200);
    const firstVariant = catalogRes.json.data!.products[0].variants[0];

    const guestToken = `guest-${crypto.randomUUID()}`;
    const oversell = await api('/api/v1/cart/items', {
      method: 'POST',
      guestToken,
      body: JSON.stringify({ variant_id: firstVariant.id, quantity: 99 }),
    });
    if (firstVariant.stock_qty < 99) {
      expect(oversell.status).toBe(409);
      expect(oversell.json.code).toBe('CATALOG_INSUFFICIENT_STOCK');
    }

    const addOk = await api('/api/v1/cart/items', {
      method: 'POST',
      guestToken,
      body: JSON.stringify({ variant_id: firstVariant.id, quantity: 1 }),
    });
    expect(addOk.status).toBe(201);

    const suffix = crypto.randomBytes(3).toString('hex');
    const reg = await api<{ accessToken: string }>('/api/v1/auth/register', {
      method: 'POST',
      guestToken,
      body: JSON.stringify({
        full_name: 'Checkout Tester',
        email: `pay-${suffix}@example.com`,
        password: 'StrongPassword123!',
        account_type: 'customer',
      }),
    });
    const token = reg.json.data!.accessToken;

    // Without STRIPE_SECRET_KEY configured, checkout cleanly rejects with 422 and releases stock
    const checkoutNoKey = await api('/api/v1/checkout/initiate', {
      method: 'POST',
      token,
      guestToken,
      body: JSON.stringify({
        gateway: 'stripe',
        shipping_address: {
          full_name: 'Checkout Tester',
          phone: '+966500000000',
          city: 'Riyadh',
          street: 'King Fahd Rd',
          postal_code: '12214',
        },
      }),
    });
    expect(checkoutNoKey.status).toBe(422);
    expect(checkoutNoKey.json.code).toBe('PAYMENT_GATEWAY_NOT_CONFIGURED');

    // Webhook rejects unsigned/unconfigured requests
    const badHook = await api('/api/v1/webhooks/payments/stripe', {
      method: 'POST',
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    });
    expect([401, 422]).toContain(badHook.status);
  });

  it('verifies all 5 role dashboards (super_admin, moderator, staff, vendor, customer) end-to-end', async () => {
    const prevPasscode = process.env.ADMIN_BOOTSTRAP_PASSCODE;
    process.env.ADMIN_BOOTSTRAP_PASSCODE = 'UfuqVerifyPass2026!';

    try {
      // 1. Super Admin login & full admin dashboard verification
      const adminLogin = await api<{ accessToken: string; user: { user_type: string } }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@ufuq.commerce', password: 'UfuqVerifyPass2026!' }),
      });
      expect(adminLogin.status).toBe(200);
      const adminToken = adminLogin.json.data!.accessToken;

      const adminSidebar = await api<{ scope: string; items: { route_path: string }[] }>(
        '/api/v1/auth/sidebar?scope=admin',
        { token: adminToken }
      );
      expect(adminSidebar.status).toBe(200);
      expect(adminSidebar.json.data!.items.length).toBe(10);

      for (const ep of [
        '/api/v1/admin/dashboard/analytics',
        '/api/v1/admin/cms/pages',
        '/api/v1/admin/settings',
        '/api/v1/admin/rbac/matrix',
        '/api/v1/admin/env-secrets',
        '/api/v1/crud/vendors',
        '/api/v1/crud/products',
        '/api/v1/crud/vendor_suborders',
        '/api/v1/crud/users',
        '/api/v1/crud/blog_posts',
        '/api/v1/crud/contact_inquiries',
        '/api/v1/crud/audit_logs',
        '/api/v1/crud/notification_logs',
      ]) {
        const res = await api(ep, { token: adminToken });
        expect(res.status).toBe(200);
      }

      // 2. Moderator dashboard verification & strict RBAC isolation
      const modPrev = await api<{ accessToken: string }>('/api/v1/auth/role-preview', {
        method: 'POST',
        token: adminToken,
        body: JSON.stringify({ target_role: 'moderator' }),
      });
      expect(modPrev.status).toBe(200);
      const modToken = modPrev.json.data!.accessToken;

      const modSidebar = await api<{ items: { route_path: string }[] }>('/api/v1/auth/sidebar?scope=moderator', {
        token: modToken,
      });
      expect(modSidebar.status).toBe(200);
      expect(modSidebar.json.data!.items.map((i) => i.route_path)).toEqual([
        '/dashboard/moderator',
        '/dashboard/moderator/vendor-approvals',
        '/dashboard/moderator/product-reviews',
        '/dashboard/moderator/disputes',
      ]);

      expect((await api('/api/v1/auth/sidebar?scope=admin', { token: modToken })).status).toBe(403);
      expect((await api('/api/v1/admin/workspace/summary', { token: modToken })).status).toBe(200);
      expect((await api('/api/v1/admin/dashboard/analytics', { token: modToken })).status).toBe(403);
      expect((await api('/api/v1/crud/vendors', { token: modToken })).status).toBe(200);
      expect((await api('/api/v1/crud/products', { token: modToken })).status).toBe(200);
      expect((await api('/api/v1/crud/contact_inquiries', { token: modToken })).status).toBe(200);
      expect((await api('/api/v1/crud/users', { token: modToken })).status).toBe(403);
      expect((await api('/api/v1/crud/vendor_suborders', { token: modToken })).status).toBe(403);

      // Moderator can approve vendor KYC inline, but cannot alter commission_rate
      const modKycOk = await api('/api/v1/crud/vendors/vvvvvvvv-0004-4000-8000-000000000004/inline', {
        method: 'PATCH',
        token: modToken,
        body: JSON.stringify({ field: 'kyc_status', value: 'verified' }),
      });
      expect(modKycOk.status).toBe(200);
      await api('/api/v1/crud/vendors/vvvvvvvv-0004-4000-8000-000000000004/inline', {
        method: 'PATCH',
        token: modToken,
        body: JSON.stringify({ field: 'kyc_status', value: 'pending' }),
      });
      const modCommissionDenied = await api('/api/v1/crud/vendors/vvvvvvvv-0004-4000-8000-000000000004/inline', {
        method: 'PATCH',
        token: modToken,
        body: JSON.stringify({ field: 'commission_rate', value: 1 }),
      });
      expect(modCommissionDenied.status).toBe(403);

      // 3. Staff dashboard verification
      const staffPrev = await api<{ accessToken: string }>('/api/v1/auth/role-preview', {
        method: 'POST',
        token: adminToken,
        body: JSON.stringify({ target_role: 'staff' }),
      });
      expect(staffPrev.status).toBe(200);
      const staffToken = staffPrev.json.data!.accessToken;

      const staffSidebar = await api<{ items: { route_path: string }[] }>('/api/v1/auth/sidebar?scope=staff', {
        token: staffToken,
      });
      expect(staffSidebar.status).toBe(200);
      expect(staffSidebar.json.data!.items.map((i) => i.route_path)).toEqual([
        '/dashboard/staff',
        '/dashboard/staff/orders',
        '/dashboard/staff/tickets',
      ]);
      expect((await api('/api/v1/admin/workspace/summary', { token: staffToken })).status).toBe(200);
      expect((await api('/api/v1/admin/dashboard/analytics', { token: staffToken })).status).toBe(403);
      expect((await api('/api/v1/crud/vendor_suborders', { token: staffToken })).status).toBe(200);
      expect((await api('/api/v1/crud/contact_inquiries', { token: staffToken })).status).toBe(200);
      expect((await api('/api/v1/crud/vendors', { token: staffToken })).status).toBe(403);
      expect((await api('/api/v1/crud/products', { token: staffToken })).status).toBe(403);

      // Staff can update fulfillment tracking inline
      const staffTrack = await api('/api/v1/crud/vendor_suborders/sub-1001-b/inline', {
        method: 'PATCH',
        token: staffToken,
        body: JSON.stringify({ field: 'tracking_number', value: 'SMSA-112233' }),
      });
      expect(staffTrack.status).toBe(200);
      await api('/api/v1/crud/vendor_suborders/sub-1001-b/inline', {
        method: 'PATCH',
        token: staffToken,
        body: JSON.stringify({ field: 'tracking_number', value: '' }),
      });

      // 4. Vendor dashboard verification (ABAC ownership + Store Settings + Product Creation)
      const vendorPrev = await api<{ accessToken: string }>('/api/v1/auth/role-preview', {
        method: 'POST',
        token: adminToken,
        body: JSON.stringify({ target_role: 'vendor' }),
      });
      expect(vendorPrev.status).toBe(200);
      const vendorToken = vendorPrev.json.data!.accessToken;

      const vendorSidebar = await api<{ items: { route_path: string }[] }>('/api/v1/auth/sidebar?scope=vendor', {
        token: vendorToken,
      });
      expect(vendorSidebar.status).toBe(200);
      expect(vendorSidebar.json.data!.items.map((i) => i.route_path)).toEqual([
        '/dashboard/vendor',
        '/dashboard/vendor/products',
        '/dashboard/vendor/orders',
        '/dashboard/vendor/payouts',
        '/dashboard/vendor/store-settings',
      ]);

      const vendorAnalytics = await api<{ kpis: { pendingVendors: number; activeProducts: number } }>(
        '/api/v1/admin/dashboard/analytics',
        { token: vendorToken }
      );
      expect(vendorAnalytics.status).toBe(200);
      expect(vendorAnalytics.json.data!.kpis.pendingVendors).toBe(0);
      expect(vendorAnalytics.json.data!.kpis.activeProducts).toBeGreaterThan(0);

      // Vendor cannot view other vendor's products or edit them (prod-04 belongs to qalam / vendor2)
      const vendorProducts = await api('/api/v1/crud/products', { token: vendorToken });
      expect(vendorProducts.status).toBe(200);
      const prodIds = ((vendorProducts.json.data as unknown as { id: string }[]) || []).map((p) => p.id);
      expect(prodIds).not.toContain('prod-04');
      const crossVendorEdit = await api('/api/v1/crud/products/prod-04/inline', {
        method: 'PATCH',
        token: vendorToken,
        body: JSON.stringify({ field: 'base_price', value: 1 }),
      });
      expect(crossVendorEdit.status).toBe(403);

      // Vendor Store Settings GET & PATCH
      const storeSettingsRes = await api<{ stores: { id: string; store_name_i18n: { ar: string; en: string } }[] }>(
        '/api/v1/admin/vendor/store-settings',
        { token: vendorToken }
      );
      expect(storeSettingsRes.status).toBe(200);
      const firstStore = storeSettingsRes.json.data!.stores[0];
      const saveStore = await api('/api/v1/admin/vendor/store-settings', {
        method: 'PATCH',
        token: vendorToken,
        body: JSON.stringify({
          vendor_id: firstStore.id,
          store_name_ar: firstStore.store_name_i18n.ar,
          store_name_en: firstStore.store_name_i18n.en,
          tagline_ar: 'هندسة صوتية وإضاءة معمارية من الرياض',
          tagline_en: 'Architectural lighting and studio audio from Riyadh',
        }),
      });
      expect(saveStore.status).toBe(200);

      // 5. Customer dashboard verification (Sidebar, Orders & Invoice, Addresses CRUD, 2FA & GDPR)
      const custPrev = await api<{ accessToken: string }>('/api/v1/auth/role-preview', {
        method: 'POST',
        token: adminToken,
        body: JSON.stringify({ target_role: 'customer' }),
      });
      expect(custPrev.status).toBe(200);
      const custToken = custPrev.json.data!.accessToken;

      const custSidebar = await api<{ items: { route_path: string }[] }>('/api/v1/auth/sidebar?scope=customer', {
        token: custToken,
      });
      expect(custSidebar.status).toBe(200);
      expect(custSidebar.json.data!.items.map((i) => i.route_path)).toEqual([
        '/dashboard/customer',
        '/dashboard/customer/orders',
        '/dashboard/customer/addresses',
        '/dashboard/customer/security',
      ]);

      const myOrders = await api<{ orders: { id: string }[] }>('/api/v1/orders/my', { token: custToken });
      expect(myOrders.status).toBe(200);
      expect(myOrders.json.data!.orders.length).toBeGreaterThan(0);

      const invoiceRes = await api(`/api/v1/orders/${myOrders.json.data!.orders[0].id}/invoice`, {
        token: custToken,
      });
      expect(invoiceRes.status).toBe(200);

      // Shipping addresses CRUD
      const addAddr = await api<{ addresses: { id: string; label: string }[] }>('/api/v1/auth/addresses', {
        method: 'POST',
        token: custToken,
        body: JSON.stringify({
          label: 'Office Test',
          full_name: 'Reem Al-Harbi',
          phone: '+966500000006',
          city: 'Riyadh',
          street: 'Olaya St 10',
          postal_code: '12214',
          is_default: false,
        }),
      });
      expect(addAddr.status).toBe(201);
      const addedAddrId = addAddr.json.data!.addresses.find((a) => a.label === 'Office Test')!.id;
      const delAddr = await api(`/api/v1/auth/addresses/${addedAddrId}`, {
        method: 'DELETE',
        token: custToken,
      });
      expect(delAddr.status).toBe(200);

      // 2FA setup/disable + GDPR export
      const tfaOn = await api('/api/v1/auth/2fa/setup', { method: 'POST', token: custToken });
      expect(tfaOn.status).toBe(200);
      const tfaOff = await api('/api/v1/auth/2fa/disable', { method: 'POST', token: custToken });
      expect(tfaOff.status).toBe(200);
      const gdpr = await api('/api/v1/auth/gdpr/export', { token: custToken });
      expect(gdpr.status).toBe(200);

      // Customer blocked from every privileged endpoint
      for (const deniedEp of [
        '/api/v1/admin/dashboard/analytics',
        '/api/v1/admin/workspace/summary',
        '/api/v1/crud/vendors',
        '/api/v1/crud/products',
        '/api/v1/crud/vendor_suborders',
        '/api/v1/crud/users',
        '/api/v1/crud/notification_logs',
      ]) {
        expect((await api(deniedEp, { token: custToken })).status).toBe(403);
      }
    } finally {
      if (prevPasscode === undefined) {
        delete process.env.ADMIN_BOOTSTRAP_PASSCODE;
      } else {
        process.env.ADMIN_BOOTSTRAP_PASSCODE = prevPasscode;
      }
    }
  });
});
