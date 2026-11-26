import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { dbStore } from '../core/db.ts';
import { verifyWebhookSignature } from '../core/crypto.ts';
import { AppError } from '../core/errors.ts';
import {
  attachTenantAndAuth,
  requireAuth,
  recordAuditLog,
  type AuthRequest,
} from '../core/auth-guard.ts';
import type { DatabaseSchema } from '../../shared/types.ts';

export const commerceRouter = Router();
commerceRouter.use(attachTenantAndAuth);

function resolveCart(db: DatabaseSchema, req: AuthRequest) {
  const guestToken = (req.headers['x-guest-token'] as string) || null;
  let cart = db.carts.find(
    (c) =>
      c.tenant_id === req.tenantId &&
      ((req.authUser && c.user_id === req.authUser.id) ||
        (guestToken && c.guest_token === guestToken))
  );
  if (!cart) {
    cart = {
      id: crypto.randomUUID(),
      tenant_id: req.tenantId,
      user_id: req.authUser?.id || null,
      guest_token: guestToken || crypto.randomUUID(),
      currency: 'SAR',
      expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.carts.push(cart);
  } else if (req.authUser && !cart.user_id) {
    cart.user_id = req.authUser.id;
  }
  return cart;
}

function hydrateCart(db: DatabaseSchema, cartId: string) {
  const items = db.cart_items
    .filter((ci) => ci.cart_id === cartId)
    .map((ci) => {
      const variant = db.product_variants.find((v) => v.id === ci.variant_id);
      const product = variant ? db.products.find((p) => p.id === variant.product_id) : null;
      const vendor = product ? db.vendors.find((v) => v.id === product.vendor_id) : null;
      return {
        ...ci,
        variant,
        product,
        vendor: vendor
          ? { id: vendor.id, store_slug: vendor.store_slug, store_name_i18n: vendor.store_name_i18n }
          : null,
        available_qty: variant ? Math.max(0, variant.stock_qty - variant.reserved_qty) : 0,
      };
    })
    .filter((i) => i.variant && i.product);

  const subtotal = items.reduce((s, i) => s + Number(i.variant!.price) * i.quantity, 0);
  const taxRate = 0.15;
  const tax_amount = Number((subtotal * taxRate).toFixed(2));
  const shipping_amount = items.length > 0 ? 28 : 0;
  const grand_total = Number((subtotal + tax_amount + shipping_amount).toFixed(2));
  return { items, subtotal, tax_amount, shipping_amount, grand_total };
}

commerceRouter.get('/cart', async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const payload = await dbStore.withTransaction((db) => {
      const cart = resolveCart(db, authReq);
      return { cart, ...hydrateCart(db, cart.id) };
    });
    res.json({ success: true, data: payload });
  } catch (err) {
    next(err);
  }
});

commerceRouter.post('/cart/items', async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const { variant_id, quantity } = z
      .object({ variant_id: z.string().min(1), quantity: z.number().int().min(1).max(99) })
      .parse(req.body);

    const payload = await dbStore.withTransaction((db) => {
      const variant = db.product_variants.find(
        (v) => v.id === variant_id && v.tenant_id === authReq.tenantId && v.is_active
      );
      if (!variant) {
        throw new AppError({ status: 404, code: 'VARIANT_NOT_FOUND', message: 'Product variant not found' });
      }
      const available = variant.stock_qty - variant.reserved_qty;
      const cart = resolveCart(db, authReq);
      const existing = db.cart_items.find(
        (ci) => ci.cart_id === cart.id && ci.variant_id === variant_id
      );
      const targetQty = (existing?.quantity || 0) + quantity;
      if (targetQty > available) {
        throw new AppError({
          status: 409,
          code: 'CATALOG_INSUFFICIENT_STOCK',
          message: `Only ${available} units currently available in stock.`,
        });
      }

      if (existing) {
        existing.quantity = targetQty;
        existing.unit_price_snapshot = variant.price;
      } else {
        db.cart_items.push({
          id: crypto.randomUUID(),
          cart_id: cart.id,
          variant_id,
          quantity,
          unit_price_snapshot: variant.price,
          added_at: new Date().toISOString(),
        });
      }
      cart.updated_at = new Date().toISOString();
      return { cart, ...hydrateCart(db, cart.id) };
    });

    res.status(201).json({ success: true, data: payload });
  } catch (err) {
    next(err);
  }
});

commerceRouter.patch('/cart/items/:id', async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const { quantity } = z.object({ quantity: z.number().int().min(0).max(99) }).parse(req.body);

    const payload = await dbStore.withTransaction((db) => {
      const cart = resolveCart(db, authReq);
      const idx = db.cart_items.findIndex(
        (ci) => ci.id === req.params.id && ci.cart_id === cart.id
      );
      if (idx === -1) {
        throw new AppError({ status: 404, code: 'CART_ITEM_NOT_FOUND', message: 'Cart item not found' });
      }
      if (quantity === 0) {
        db.cart_items.splice(idx, 1);
      } else {
        const ci = db.cart_items[idx];
        const variant = db.product_variants.find((v) => v.id === ci.variant_id);
        const available = variant ? variant.stock_qty - variant.reserved_qty : 0;
        if (quantity > available) {
          throw new AppError({
            status: 409,
            code: 'CATALOG_INSUFFICIENT_STOCK',
            message: `Only ${available} units available.`,
          });
        }
        ci.quantity = quantity;
      }
      return { cart, ...hydrateCart(db, cart.id) };
    });

    res.json({ success: true, data: payload });
  } catch (err) {
    next(err);
  }
});

commerceRouter.delete('/cart/items/:id', async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const payload = await dbStore.withTransaction((db) => {
      const cart = resolveCart(db, authReq);
      db.cart_items = db.cart_items.filter(
        (ci) => !(ci.id === req.params.id && ci.cart_id === cart.id)
      );
      return { cart, ...hydrateCart(db, cart.id) };
    });
    res.json({ success: true, data: payload });
  } catch (err) {
    next(err);
  }
});

const checkoutSchema = z.object({
  gateway: z.enum(['paypal', 'stripe', 'mada_tap']),
  idempotency_key: z.string().min(6).max(120).optional(),
  shipping_address: z.object({
    full_name: z.string().min(2).max(120),
    phone: z.string().min(7).max(30),
    city: z.string().min(2).max(80),
    street: z.string().min(4).max(200),
    postal_code: z.string().min(3).max(20),
  }),
});

commerceRouter.post('/checkout/initiate', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError({ status: 400, code: 'VALIDATION_ERROR', message: 'Please provide complete shipping address and gateway.', details: parsed.error.flatten() });
    }

    const { gateway, shipping_address } = parsed.data;
    const idempotencyKey = parsed.data.idempotency_key || `idem-${crypto.randomUUID()}`;

    const result = await dbStore.withTransaction((db) => {
      const existingTx = db.payment_transactions.find(
        (p) => p.idempotency_key === idempotencyKey && p.tenant_id === authReq.tenantId
      );
      if (existingTx) {
        const existingOrder = db.orders.find((o) => o.id === existingTx.order_id);
        return { order: existingOrder, transaction: existingTx };
      }

      const cart = resolveCart(db, authReq);
      const items = db.cart_items.filter((ci) => ci.cart_id === cart.id);
      if (items.length === 0) {
        throw new AppError({ status: 400, code: 'EMPTY_CART', message: 'Your shopping cart is empty.' });
      }

      // Atomic stock reservation sorted by variant_id (Deadlock & Overselling prevention)
      const sortedItems = [...items].sort((a, b) => a.variant_id.localeCompare(b.variant_id));
      const vendorGroups = new Map<string, typeof sortedItems>();

      for (const item of sortedItems) {
        const variant = db.product_variants.find(
          (v) => v.id === item.variant_id && v.tenant_id === authReq.tenantId && v.is_active
        );
        if (!variant) {
          throw new AppError({ status: 404, code: 'VARIANT_MISSING', message: 'A product variant in your cart is no longer available.' });
        }
        const available = variant.stock_qty - variant.reserved_qty;
        if (available < item.quantity) {
          throw new AppError({
            status: 409,
            code: 'CATALOG_INSUFFICIENT_STOCK',
            message: `Insufficient stock for SKU ${variant.sku}. Available: ${available}.`,
          });
        }
        variant.reserved_qty += item.quantity;
        variant.updated_at = new Date().toISOString();

        const product = db.products.find((p) => p.id === variant.product_id)!;
        const list = vendorGroups.get(product.vendor_id) || [];
        list.push(item);
        vendorGroups.set(product.vendor_id, list);
      }

      const nowIso = new Date().toISOString();
      const orderId = crypto.randomUUID();
      const orderNum = `ORD-${new Date().getFullYear()}-${String(db.orders.length + 1001).padStart(6, '0')}`;

      let subtotal = 0;
      let totalTax = 0;
      const suborders = [];

      let vendorIdx = 1;
      for (const [vendorId, vItems] of vendorGroups.entries()) {
        const vendor = db.vendors.find((v) => v.id === vendorId)!;
        const suborderId = crypto.randomUUID();
        let vendorGross = 0;

        for (const ci of vItems) {
          const variant = db.product_variants.find((v) => v.id === ci.variant_id)!;
          const product = db.products.find((p) => p.id === variant.product_id)!;
          const lineNet = Number(variant.price) * ci.quantity;
          const lineTax = Number((lineNet * (product.tax_rate / 100)).toFixed(2));
          vendorGross += lineNet;
          totalTax += lineTax;

          db.order_items.push({
            id: crypto.randomUUID(),
            tenant_id: authReq.tenantId,
            suborder_id: suborderId,
            variant_id: variant.id,
            sku_snapshot: variant.sku,
            title_snapshot: product.title_i18n,
            quantity: ci.quantity,
            unit_price: variant.price,
            tax_amount: lineTax,
            line_total: Number((lineNet + lineTax).toFixed(2)),
          });
        }

        subtotal += vendorGross;
        const commission = Number(((vendorGross * vendor.commission_rate) / 100).toFixed(2));
        const vendorNet = Number((vendorGross - commission).toFixed(2));

        const suborder = {
          id: suborderId,
          tenant_id: authReq.tenantId,
          order_id: orderId,
          vendor_id: vendorId,
          suborder_number: `${orderNum}-V${vendorIdx++}`,
          gross_amount: Number(vendorGross.toFixed(2)),
          commission_amount: commission,
          vendor_net_amount: vendorNet,
          fulfillment_status: 'pending' as const,
          tracking_number: null,
          updated_at: nowIso,
        };
        db.vendor_suborders.push(suborder);
        suborders.push(suborder);
      }

      const shippingAmount = 28;
      const grandTotal = Number((subtotal + totalTax + shippingAmount).toFixed(2));

      const order = {
        id: orderId,
        tenant_id: authReq.tenantId,
        customer_id: authReq.authUser!.id,
        order_number: orderNum,
        subtotal_amount: Number(subtotal.toFixed(2)),
        tax_amount: Number(totalTax.toFixed(2)),
        shipping_amount: shippingAmount,
        discount_amount: 0,
        grand_total: grandTotal,
        currency: 'SAR',
        shipping_address,
        payment_status: 'pending' as const,
        order_status: 'created' as const,
        created_at: nowIso,
        updated_at: nowIso,
      };
      db.orders.unshift(order);

      const tx = {
        id: crypto.randomUUID(),
        tenant_id: authReq.tenantId,
        order_id: orderId,
        gateway,
        gateway_tx_id: `${gateway}_${crypto.randomBytes(6).toString('hex')}`,
        idempotency_key: idempotencyKey,
        amount: grandTotal,
        currency: 'SAR',
        status: 'initiated' as const,
        webhook_payload: null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      db.payment_transactions.unshift(tx);

      return { order, suborders, transaction: tx };
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Capture payment (simulates hosted gateway token completion / webhook confirmation)
commerceRouter.post('/payments/capture', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const { order_id, transaction_id, card_last4 } = z
      .object({
        order_id: z.string().min(1),
        transaction_id: z.string().min(1),
        card_last4: z.string().max(4).optional(),
      })
      .parse(req.body);

    const captured = await dbStore.withTransaction((db) => {
      const order = db.orders.find(
        (o) =>
          o.id === order_id &&
          o.tenant_id === authReq.tenantId &&
          o.customer_id === authReq.authUser!.id
      );
      if (!order) {
        throw new AppError({ status: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found' });
      }
      const tx = db.payment_transactions.find(
        (p) => p.id === transaction_id && p.order_id === order.id
      );
      if (!tx) {
        throw new AppError({ status: 404, code: 'PAYMENT_NOT_FOUND', message: 'Payment transaction not found' });
      }

      if (tx.status === 'captured') {
        return { order, transaction: tx, already_captured: true };
      }

      const nowIso = new Date().toISOString();
      tx.status = 'captured';
      tx.webhook_payload = {
        verified: true,
        tokenized: true,
        last4: card_last4 || '4242',
        captured_at: nowIso,
      };
      tx.updated_at = nowIso;

      order.payment_status = 'paid';
      order.order_status = 'processing';
      order.updated_at = nowIso;

      // Deduct reserved stock permanently
      const suborders = db.vendor_suborders.filter((s) => s.order_id === order.id);
      const subIds = new Set(suborders.map((s) => s.id));
      const orderItems = db.order_items.filter((oi) => subIds.has(oi.suborder_id));

      for (const oi of orderItems) {
        const variant = db.product_variants.find((v) => v.id === oi.variant_id);
        if (variant) {
          variant.stock_qty = Math.max(0, variant.stock_qty - oi.quantity);
          variant.reserved_qty = Math.max(0, variant.reserved_qty - oi.quantity);
          variant.updated_at = nowIso;
          if (variant.stock_qty === 0) {
            const prod = db.products.find((p) => p.id === variant.product_id);
            const hasOtherStock = db.product_variants.some(
              (v) => v.product_id === variant.product_id && v.stock_qty > 0
            );
            if (prod && !hasOtherStock) prod.status = 'out_of_stock';
          }
        }
      }

      // Clear user's cart
      const cart = db.carts.find(
        (c) => c.user_id === authReq.authUser!.id && c.tenant_id === authReq.tenantId
      );
      if (cart) {
        db.cart_items = db.cart_items.filter((ci) => ci.cart_id !== cart.id);
      }

      // Queue multi-channel notifications (Email + WhatsApp + SMS)
      const user = db.users.find((u) => u.id === order.customer_id);
      if (user) {
        db.notification_logs.unshift(
          {
            id: crypto.randomUUID(),
            tenant_id: authReq.tenantId,
            user_id: user.id,
            channel: 'email',
            provider: 'resend',
            recipient: user.email,
            provider_message_id: `re_inv_${crypto.randomBytes(4).toString('hex')}`,
            status: 'delivered',
            error_message: null,
            sent_at: nowIso,
            created_at: nowIso,
          },
          {
            id: crypto.randomUUID(),
            tenant_id: authReq.tenantId,
            user_id: user.id,
            channel: 'whatsapp',
            provider: 'whatsapp_cloud',
            recipient: user.phone || order.shipping_address.phone,
            provider_message_id: `wamid_${crypto.randomBytes(5).toString('hex')}`,
            status: 'delivered',
            error_message: null,
            sent_at: nowIso,
            created_at: nowIso,
          }
        );
      }

      return { order, transaction: tx, already_captured: false };
    });

    await recordAuditLog({
      tenantId: authReq.tenantId,
      actorUserId: authReq.authUser!.id,
      action: 'payment.captured',
      entityType: 'orders',
      entityId: order_id,
      newValues: { payment_status: 'paid', gateway: captured.transaction.gateway },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: captured });
  } catch (err) {
    next(err);
  }
});

// Signed Webhook endpoint matching Stage 4
commerceRouter.post('/webhooks/payments/:provider', async (req, res, next) => {
  try {
    const provider = req.params.provider;
    const signature = (req.headers['x-webhook-signature'] as string) || '';
    const webhookSecret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`];
    if (webhookSecret && !verifyWebhookSignature(JSON.stringify(req.body), signature, webhookSecret)) {
      throw new AppError({ status: 401, code: 'INVALID_WEBHOOK_SIGNATURE', message: 'Signature verification failed' });
    }
    res.json({ success: true, received: true, provider });
  } catch (err) {
    next(err);
  }
});

commerceRouter.get('/orders/my', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const db = dbStore.snapshot();
  const orders = db.orders
    .filter((o) => o.tenant_id === authReq.tenantId && o.customer_id === authReq.authUser!.id)
    .map((o) => {
      const suborders = db.vendor_suborders
        .filter((s) => s.order_id === o.id)
        .map((s) => {
          const vendor = db.vendors.find((v) => v.id === s.vendor_id);
          const items = db.order_items.filter((oi) => oi.suborder_id === s.id);
          return { ...s, vendor_name: vendor?.store_name_i18n, items };
        });
      const payment = db.payment_transactions.find((p) => p.order_id === o.id);
      return { ...o, suborders, payment };
    });
  res.json({ success: true, data: { orders } });
});

commerceRouter.get('/orders/:id/invoice', requireAuth, (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const db = dbStore.snapshot();
    const order = db.orders.find(
      (o) => o.id === req.params.id && o.tenant_id === authReq.tenantId
    );
    if (!order) {
      throw new AppError({ status: 404, code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }
    const isOwner = order.customer_id === authReq.authUser!.id;
    const isAdminOrStaff = ['super_admin', 'moderator', 'staff'].includes(authReq.authUser!.user_type);
    if (!isOwner && !isAdminOrStaff) {
      throw new AppError({ status: 403, code: 'FORBIDDEN', message: 'Cannot access invoice for another user' });
    }
    const suborders = db.vendor_suborders
      .filter((s) => s.order_id === order.id)
      .map((s) => {
        const vendor = db.vendors.find((v) => v.id === s.vendor_id);
        const items = db.order_items.filter((oi) => oi.suborder_id === s.id);
        return { ...s, vendor, items };
      });
    const payment = db.payment_transactions.find((p) => p.order_id === order.id);
    const tenant = db.tenants.find((t) => t.id === order.tenant_id);
    res.json({ success: true, data: { order, suborders, payment, tenant } });
  } catch (err) {
    next(err);
  }
});
