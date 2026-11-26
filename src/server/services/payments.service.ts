import crypto from 'crypto';
import { resolveTenantSecret } from '../core/secrets.ts';
import { verifyWebhookSignature } from '../core/crypto.ts';
import { AppError } from '../core/errors.ts';
import type { DatabaseSchema } from '../../shared/types.ts';

export type PaymentGatewayType = 'stripe' | 'paypal' | 'mada_tap';

export interface GatewaySessionResult {
  gateway: PaymentGatewayType;
  gateway_tx_id: string;
  redirect_url: string;
  raw?: Record<string, unknown>;
}

export interface GatewayVerificationResult {
  captured: boolean;
  gateway_tx_id: string;
  last4?: string;
  raw: Record<string, unknown>;
}

export function getPayPalBaseUrl(): string {
  return process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new AppError({
      status: 502,
      code: 'PAYPAL_AUTH_FAILED',
      message: data.error_description || 'PayPal OAuth authentication failed',
    });
  }
  return data.access_token;
}

export async function createGatewayPaymentSession(params: {
  db: DatabaseSchema;
  tenantId: string;
  gateway: PaymentGatewayType;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  baseAppUrl: string;
}): Promise<GatewaySessionResult> {
  const {
    db,
    tenantId,
    gateway,
    orderId,
    orderNumber,
    amount,
    currency,
    customerEmail,
    customerName,
    customerPhone,
    baseAppUrl,
  } = params;

  const cleanBase = baseAppUrl.replace(/\/$/, '');

  if (gateway === 'stripe') {
    const secretKey = resolveTenantSecret(db, tenantId, 'STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new AppError({
        status: 422,
        code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
        message:
          'Stripe is not configured. Please add STRIPE_SECRET_KEY in Admin -> Encrypted Secrets Vault or environment variables.',
      });
    }

    const body = new URLSearchParams();
    body.set('mode', 'payment');
    body.set('customer_email', customerEmail);
    body.set('client_reference_id', orderId);
    body.set('success_url', `${cleanBase}/checkout?gateway=stripe&order_id=${orderId}&session_id={CHECKOUT_SESSION_ID}`);
    body.set('cancel_url', `${cleanBase}/checkout?cancelled=true&order_id=${orderId}`);
    body.set('line_items[0][price_data][currency]', currency.toLowerCase());
    body.set('line_items[0][price_data][unit_amount]', String(Math.round(amount * 100)));
    body.set('line_items[0][price_data][product_data][name]', `Ufuq Order ${orderNumber}`);
    body.set('line_items[0][quantity]', '1');
    body.set('metadata[order_id]', orderId);
    body.set('metadata[tenant_id]', tenantId);

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
    if (!res.ok || !data.id || !data.url) {
      throw new AppError({
        status: 502,
        code: 'STRIPE_SESSION_FAILED',
        message: data.error?.message || 'Failed to create Stripe Checkout Session',
      });
    }
    return {
      gateway: 'stripe',
      gateway_tx_id: data.id,
      redirect_url: data.url,
      raw: data as unknown as Record<string, unknown>,
    };
  }

  if (gateway === 'paypal') {
    const clientId = resolveTenantSecret(db, tenantId, 'PAYPAL_CLIENT_ID');
    const clientSecret = resolveTenantSecret(db, tenantId, 'PAYPAL_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new AppError({
        status: 422,
        code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
        message:
          'PayPal is not configured. Please add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in Admin -> Encrypted Secrets Vault or environment variables.',
      });
    }

    const accessToken = await getPayPalAccessToken(clientId, clientSecret);
    const paypalCurrency = currency === 'SAR' ? 'USD' : currency;
    const paypalAmount = currency === 'SAR' ? (amount / 3.75).toFixed(2) : amount.toFixed(2);

    const res = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: orderId,
            custom_id: `${tenantId}:${orderId}`,
            description: `Ufuq Order ${orderNumber}`,
            amount: {
              currency_code: paypalCurrency,
              value: paypalAmount,
            },
          },
        ],
        application_context: {
          return_url: `${cleanBase}/checkout?gateway=paypal&order_id=${orderId}`,
          cancel_url: `${cleanBase}/checkout?cancelled=true&order_id=${orderId}`,
        },
      }),
    });

    const data = (await res.json()) as {
      id?: string;
      links?: { rel: string; href: string }[];
      message?: string;
    };
    const approveLink = data.links?.find((l) => l.rel === 'approve')?.href;
    if (!res.ok || !data.id || !approveLink) {
      throw new AppError({
        status: 502,
        code: 'PAYPAL_ORDER_FAILED',
        message: data.message || 'Failed to create PayPal order',
      });
    }
    return {
      gateway: 'paypal',
      gateway_tx_id: data.id,
      redirect_url: approveLink,
      raw: data as unknown as Record<string, unknown>,
    };
  }

  // Mada / Tap Payments Charges v2
  const tapKey = resolveTenantSecret(db, tenantId, 'TAP_SECRET_KEY');
  if (!tapKey) {
    throw new AppError({
      status: 422,
      code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
      message:
        'Mada / Tap Payments is not configured. Please add TAP_SECRET_KEY in Admin -> Encrypted Secrets Vault or environment variables.',
    });
  }

  const nameParts = customerName.trim().split(/\s+/);
  const firstName = nameParts[0] || 'Customer';
  const lastName = nameParts.slice(1).join(' ') || 'User';

  const res = await fetch('https://api.tap.company/v2/charges', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tapKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Number(amount.toFixed(2)),
      currency,
      threeDSecure: true,
      save_card: false,
      description: `Ufuq Order ${orderNumber}`,
      reference: {
        transaction: orderId,
        order: orderNumber,
      },
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: customerEmail,
        phone: {
          country_code: '966',
          number: customerPhone.replace(/^\+?966/, '').replace(/\D/g, '') || '500000000',
        },
      },
      source: { id: 'src_all' },
      post: { url: `${cleanBase}/api/v1/webhooks/payments/mada_tap` },
      redirect: { url: `${cleanBase}/checkout?gateway=mada_tap&order_id=${orderId}` },
    }),
  });

  const data = (await res.json()) as {
    id?: string;
    transaction?: { url?: string };
    errors?: { description?: string }[];
  };
  if (!res.ok || !data.id || !data.transaction?.url) {
    throw new AppError({
      status: 502,
      code: 'TAP_CHARGE_FAILED',
      message: data.errors?.[0]?.description || 'Failed to initiate Mada / Tap charge',
    });
  }

  return {
    gateway: 'mada_tap',
    gateway_tx_id: data.id,
    redirect_url: data.transaction.url,
    raw: data as unknown as Record<string, unknown>,
  };
}

export async function verifyAndCaptureGatewayPayment(params: {
  db: DatabaseSchema;
  tenantId: string;
  gateway: PaymentGatewayType;
  gatewayTxId: string;
}): Promise<GatewayVerificationResult> {
  const { db, tenantId, gateway, gatewayTxId } = params;

  if (gateway === 'stripe') {
    const secretKey = resolveTenantSecret(db, tenantId, 'STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new AppError({
        status: 422,
        code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
        message: 'STRIPE_SECRET_KEY is required to verify Stripe payments.',
      });
    }
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(gatewayTxId)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const data = (await res.json()) as {
      id?: string;
      payment_status?: string;
      status?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new AppError({
        status: 502,
        code: 'STRIPE_VERIFY_FAILED',
        message: data.error?.message || 'Unable to verify Stripe Checkout Session',
      });
    }
    const captured = data.payment_status === 'paid' || data.status === 'complete';
    return {
      captured,
      gateway_tx_id: data.id || gatewayTxId,
      raw: data as unknown as Record<string, unknown>,
    };
  }

  if (gateway === 'paypal') {
    const clientId = resolveTenantSecret(db, tenantId, 'PAYPAL_CLIENT_ID');
    const clientSecret = resolveTenantSecret(db, tenantId, 'PAYPAL_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new AppError({
        status: 422,
        code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
        message: 'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required.',
      });
    }
    const accessToken = await getPayPalAccessToken(clientId, clientSecret);
    const res = await fetch(
      `${getPayPalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(gatewayTxId)}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const data = (await res.json()) as { id?: string; status?: string; message?: string };
    if (!res.ok) {
      throw new AppError({
        status: 502,
        code: 'PAYPAL_CAPTURE_FAILED',
        message: data.message || 'Unable to capture PayPal order',
      });
    }
    return {
      captured: data.status === 'COMPLETED',
      gateway_tx_id: data.id || gatewayTxId,
      raw: data as unknown as Record<string, unknown>,
    };
  }

  const tapKey = resolveTenantSecret(db, tenantId, 'TAP_SECRET_KEY');
  if (!tapKey) {
    throw new AppError({
      status: 422,
      code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
      message: 'TAP_SECRET_KEY is required to verify Tap/Mada charges.',
    });
  }
  const res = await fetch(`https://api.tap.company/v2/charges/${encodeURIComponent(gatewayTxId)}`, {
    headers: { Authorization: `Bearer ${tapKey}` },
  });
  const data = (await res.json()) as {
    id?: string;
    status?: string;
    card?: { last_four?: string };
    errors?: { description?: string }[];
  };
  if (!res.ok) {
    throw new AppError({
      status: 502,
      code: 'TAP_VERIFY_FAILED',
      message: data.errors?.[0]?.description || 'Unable to verify Tap charge',
    });
  }
  return {
    captured: data.status === 'CAPTURED',
    gateway_tx_id: data.id || gatewayTxId,
    last4: data.card?.last_four,
    raw: data as unknown as Record<string, unknown>,
  };
}

export function verifyStripeSignature(
  rawBody: string,
  stripeSigHeader: string,
  webhookSecret: string
): boolean {
  const parts = stripeSigHeader.split(',').reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const signedPayload = `${t}.${rawBody}`;
  const expected = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
  const a = Buffer.from(v1);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyGatewayWebhook(
  provider: string,
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  secret: string
): boolean {
  if (provider === 'stripe') {
    const header = String(headers['stripe-signature'] || '');
    return verifyStripeSignature(rawBody, header, secret);
  }
  const sig = String(headers['x-webhook-signature'] || headers['hashstring'] || '');
  if (!sig) return false;
  return verifyWebhookSignature(rawBody, sig, secret);
}

export async function pingPaymentGateway(
  db: DatabaseSchema,
  tenantId: string,
  service: PaymentGatewayType
): Promise<{ configured: boolean; status: 'verified' | 'auth_failed' | 'not_configured'; message: string; latency_ms: number }> {
  const started = Date.now();
  if (service === 'stripe') {
    const key = resolveTenantSecret(db, tenantId, 'STRIPE_SECRET_KEY');
    if (!key) {
      return { configured: false, status: 'not_configured', message: 'STRIPE_SECRET_KEY missing', latency_ms: 0 };
    }
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${key}` },
    });
    return {
      configured: true,
      status: res.ok ? 'verified' : 'auth_failed',
      message: res.ok ? 'Stripe API live balance check OK' : `Stripe HTTP ${res.status}`,
      latency_ms: Date.now() - started,
    };
  }

  if (service === 'paypal') {
    const id = resolveTenantSecret(db, tenantId, 'PAYPAL_CLIENT_ID');
    const sec = resolveTenantSecret(db, tenantId, 'PAYPAL_CLIENT_SECRET');
    if (!id || !sec) {
      return { configured: false, status: 'not_configured', message: 'PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET missing', latency_ms: 0 };
    }
    try {
      await getPayPalAccessToken(id, sec);
      return {
        configured: true,
        status: 'verified',
        message: `PayPal OAuth2 (${process.env.PAYPAL_MODE || 'sandbox'}) verified`,
        latency_ms: Date.now() - started,
      };
    } catch (err) {
      return {
        configured: true,
        status: 'auth_failed',
        message: err instanceof Error ? err.message : 'PayPal auth error',
        latency_ms: Date.now() - started,
      };
    }
  }

  const tapKey = resolveTenantSecret(db, tenantId, 'TAP_SECRET_KEY');
  if (!tapKey) {
    return { configured: false, status: 'not_configured', message: 'TAP_SECRET_KEY missing', latency_ms: 0 };
  }
  const res = await fetch('https://api.tap.company/v2/charges?limit=1', {
    headers: { Authorization: `Bearer ${tapKey}` },
  });
  return {
    configured: true,
    status: res.ok ? 'verified' : 'auth_failed',
    message: res.ok ? 'Tap / Mada API authenticated' : `Tap HTTP ${res.status}`,
    latency_ms: Date.now() - started,
  };
}
