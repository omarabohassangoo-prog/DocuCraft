import React, { useEffect, useState } from 'react';
import { CreditCard, Lock, Printer, CheckCircle2, Store as StoreIcon } from 'lucide-react';
import type { OrderItemRecord, OrderRecord, PaymentTransactionRecord, TenantRecord, VendorRecord, VendorSuborderRecord } from '../../shared/types.ts';
import { apiRequest } from '../lib/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { formatMoney, pickI18n, t } from '../i18n/dictionary.ts';

interface InvoicePayload {
  order: OrderRecord;
  suborders: (VendorSuborderRecord & { vendor?: VendorRecord; items: OrderItemRecord[] })[];
  payment?: PaymentTransactionRecord;
  tenant?: TenantRecord;
}

export const InvoiceView: React.FC<{ orderId: string }> = ({ orderId }) => {
  const { locale, navigate } = useApp();
  const [invoice, setInvoice] = useState<InvoicePayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<InvoicePayload>(`/orders/${orderId}/invoice`)
      .then(setInvoice)
      .catch((err) => setError(err.message));
  }, [orderId]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-red-600">{error}</div>
    );
  }
  if (!invoice) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-[var(--text-secondary)]">Loading VAT Invoice...</div>;
  }

  const { order, suborders, payment, tenant } = invoice;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-base font-bold">{t(locale, 'order_confirmed')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            <Printer className="h-4 w-4" />
            {t(locale, 'print_invoice')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/store')}
            className="rounded-lg border border-[var(--border-hairline)] px-4 py-2 text-xs font-medium"
          >
            {t(locale, 'nav_store')}
          </button>
        </div>
      </div>

      {/* Printable VAT Tax Invoice Document */}
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-8 space-y-8">
        <div className="flex flex-col sm:flex-row justify-between gap-6 border-b border-[var(--border-hairline)] pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand-primary)]">
              {locale === 'ar' ? 'فاتورة ضريبية مبسطة (VAT 15%)' : 'Simplified VAT Tax Invoice (15%)'}
            </p>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-1">
              {tenant?.name || t(locale, 'brand_name')}
            </h1>
            <p className="font-mono-tabular text-xs text-[var(--text-secondary)] mt-1">
              {order.order_number} · {new Date(order.created_at).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
            </p>
          </div>
          <div className="text-sm text-[var(--text-secondary)] space-y-1">
            <p className="font-semibold text-[var(--text-primary)]">{order.shipping_address.full_name}</p>
            <p>{order.shipping_address.street}, {order.shipping_address.city}</p>
            <p className="font-mono-tabular">{order.shipping_address.phone}</p>
            {payment && (
              <p className="font-mono-tabular text-xs">
                {payment.gateway.toUpperCase()} · {payment.gateway_tx_id}
              </p>
            )}
          </div>
        </div>

        {/* Multi-Vendor Split Suborders */}
        <div className="space-y-6">
          {suborders.map((sub) => (
            <div key={sub.id} className="rounded-xl border border-[var(--border-hairline)] overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--surface-muted)]/60 px-4 py-2.5 text-xs">
                <span className="font-bold text-[var(--text-primary)]">
                  {pickI18n(sub.vendor?.store_name_i18n, locale)} · <span className="font-mono-tabular">{sub.suborder_number}</span>
                </span>
                <span className="text-[var(--text-secondary)]">
                  {t(locale, sub.fulfillment_status)} {sub.tracking_number ? `· ${sub.tracking_number}` : ''}
                </span>
              </div>
              <table className="w-full text-start text-sm">
                <thead className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-start">{t(locale, 'product_title')}</th>
                    <th className="px-4 py-2 text-start">SKU</th>
                    <th className="px-4 py-2 text-start">{locale === 'ar' ? 'الكمية' : 'Qty'}</th>
                    <th className="px-4 py-2 text-start">{t(locale, 'price')}</th>
                    <th className="px-4 py-2 text-end">{t(locale, 'grand_total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {sub.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2.5 font-medium">{pickI18n(item.title_snapshot, locale)}</td>
                      <td className="px-4 py-2.5 font-mono-tabular text-xs text-[var(--text-secondary)]">{item.sku_snapshot}</td>
                      <td className="px-4 py-2.5 tabular-nums">{item.quantity}</td>
                      <td className="px-4 py-2.5 tabular-nums">{formatMoney(item.unit_price, order.currency, locale)}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums font-semibold">
                        {formatMoney(item.line_total, order.currency, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 border-t border-[var(--border-hairline)] pt-6">
          <div className="rounded-lg border border-[var(--border-hairline)] p-3 font-mono-tabular text-[11px] text-[var(--text-secondary)]">
            ZATCA / QR Verification Hash: {order.id.slice(0, 18).toUpperCase()}
          </div>
          <div className="w-full sm:w-72 space-y-2 text-sm">
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>{t(locale, 'subtotal')}</span>
              <span className="tabular-nums">{formatMoney(order.subtotal_amount, order.currency, locale)}</span>
            </div>
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>{t(locale, 'vat_15')}</span>
              <span className="tabular-nums">{formatMoney(order.tax_amount, order.currency, locale)}</span>
            </div>
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>{t(locale, 'shipping_flat')}</span>
              <span className="tabular-nums">{formatMoney(order.shipping_amount, order.currency, locale)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--border-hairline)] pt-2 text-lg font-bold text-[var(--text-primary)]">
              <span>{t(locale, 'grand_total')}</span>
              <span className="tabular-nums">{formatMoney(order.grand_total, order.currency, locale)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CheckoutPage: React.FC = () => {
  const { locale, user, cart, refreshCart, navigate, notify, searchQuery } = useApp();
  const [gateway, setGateway] = useState<'mada_tap' | 'stripe' | 'paypal'>('mada_tap');
  const [address, setAddress] = useState({
    full_name: user?.full_name?.split('|')[0]?.trim() || '',
    phone: user?.phone || '+966500000000',
    city: 'الرياض | Riyadh',
    street: 'حي العليا، طريق الملك فهد 42',
    postal_code: '12214',
  });
  const [processing, setProcessing] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);

  // Handle return callback from Stripe / PayPal / Tap hosted payment pages
  useEffect(() => {
    const params = new URLSearchParams(searchQuery || window.location.search);
    const returnedGateway = params.get('gateway');
    const returnedOrderId = params.get('order_id');
    const cancelled = params.get('cancelled');

    if (cancelled === 'true') {
      notify(locale === 'ar' ? 'تم إلغاء عملية الدفع لدى البوابة.' : 'Payment was cancelled at the gateway.', 'info');
      return;
    }

    const gatewayTxId =
      params.get('session_id') ||
      params.get('token') ||
      params.get('tap_id');

    if (returnedGateway && returnedOrderId && gatewayTxId && user) {
      setProcessing(true);
      apiRequest('/payments/capture', {
        method: 'POST',
        body: JSON.stringify({
          order_id: returnedOrderId,
          gateway_tx_id: gatewayTxId,
        }),
      })
        .then(async () => {
          await refreshCart();
          setCompletedOrderId(returnedOrderId);
          window.history.replaceState({}, '', '/checkout');
          notify(t(locale, 'order_confirmed'), 'success');
        })
        .catch((err) => {
          notify(err instanceof Error ? err.message : 'Payment verification failed', 'error');
        })
        .finally(() => setProcessing(false));
    }
  }, [searchQuery, user, locale, notify, refreshCart]);

  if (completedOrderId) {
    return <InvoiceView orderId={completedOrderId} />;
  }

  // Group cart items by vendor to visualize automated sub-order split
  const vendorGroups = new Map<string, { name: string; total: number; count: number }>();
  for (const item of cart.items) {
    const vid = item.vendor?.id || 'unknown';
    const existing = vendorGroups.get(vid) || {
      name: pickI18n(item.vendor?.store_name_i18n, locale) || 'Independent Studio',
      total: 0,
      count: 0,
    };
    existing.total += item.variant.price * item.quantity;
    existing.count += item.quantity;
    vendorGroups.set(vid, existing);
  }

  const handleCompleteCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      notify(locale === 'ar' ? 'يرجى تسجيل الدخول لإتمام الدفع' : 'Please sign in to complete checkout', 'info');
      navigate('/auth/login');
      return;
    }

    setProcessing(true);
    try {
      const init = await apiRequest<{
        order: OrderRecord;
        transaction: PaymentTransactionRecord;
        redirect_url: string | null;
      }>('/checkout/initiate', {
        method: 'POST',
        body: JSON.stringify({
          gateway,
          shipping_address: address,
        }),
      });

      if (init.redirect_url) {
        window.location.assign(init.redirect_url);
        return;
      }

      await apiRequest('/payments/capture', {
        method: 'POST',
        body: JSON.stringify({
          order_id: init.order.id,
          transaction_id: init.transaction.id,
        }),
      });

      await refreshCart();
      setCompletedOrderId(init.order.id);
      notify(t(locale, 'order_confirmed'), 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Checkout failed', 'error');
    } finally {
      setProcessing(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center space-y-4">
        <p className="text-base text-[var(--text-secondary)]">{t(locale, 'cart_empty')}</p>
        <button
          type="button"
          onClick={() => navigate('/store')}
          className="rounded-lg bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          {t(locale, 'explore_all')}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-8">
        {t(locale, 'checkout_title')}
      </h1>

      {!user && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <span>
            {locale === 'ar'
              ? 'سلتك محفوظة بأمان. سجّل الدخول أو أنشئ حساب عميل لإتمام الدفع وإصدار الفاتورة.'
              : 'Your cart is preserved. Sign in or create a customer account to authorize payment and receive your VAT invoice.'}
          </span>
          <button
            type="button"
            onClick={() => navigate('/auth/login')}
            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white"
          >
            {t(locale, 'nav_signin')}
          </button>
        </div>
      )}

      <form onSubmit={handleCompleteCheckout} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-4">
            <h2 className="text-base font-bold text-[var(--text-primary)]">{t(locale, 'shipping_details')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, 'full_name')}</label>
                <input
                  required
                  value={address.full_name}
                  onChange={(e) => setAddress({ ...address, full_name: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, 'phone')}</label>
                <input
                  required
                  value={address.phone}
                  onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, 'city')}</label>
                <input
                  required
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, 'postal_code')}</label>
                <input
                  required
                  value={address.postal_code}
                  onChange={(e) => setAddress({ ...address, postal_code: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, 'street')}</label>
              <input
                required
                value={address.street}
                onChange={(e) => setAddress({ ...address, street: e.target.value })}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text-primary)]">{t(locale, 'payment_gateway')}</h2>
              <Lock className="h-4 w-4 text-[var(--brand-primary)]" />
            </div>

            <div className="space-y-2.5">
              {[
                { id: 'mada_tap', label: t(locale, 'gateway_mada') },
                { id: 'stripe', label: t(locale, 'gateway_stripe') },
                { id: 'paypal', label: t(locale, 'gateway_paypal') },
              ].map((gw) => (
                <label
                  key={gw.id}
                  className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-colors ${
                    gateway === gw.id
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                      : 'border-[var(--border-hairline)] hover:bg-[var(--surface-muted)]/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="gateway"
                      checked={gateway === gw.id}
                      onChange={() => setGateway(gw.id as typeof gateway)}
                    />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{gw.label}</span>
                  </div>
                  <CreditCard className="h-4 w-4 text-[var(--text-secondary)]" />
                </label>
              ))}
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              {locale === 'ar'
                ? 'لا يتم تخزين أرقام البطاقات على خوادمنا مطلقاً؛ تتم المعالجة عبر رمز دفع مشفر وموقع.'
                : 'Zero raw cardholder numbers touch platform servers; payment authorization uses signed tokenization.'}
            </p>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-5">
            <h2 className="text-base font-bold text-[var(--text-primary)]">{t(locale, 'vendor_split_summary')}</h2>

            <div className="space-y-2.5">
              {Array.from(vendorGroups.entries()).map(([vid, info]) => (
                <div key={vid} className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)]/60 px-3.5 py-2.5 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                    <StoreIcon className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                    <span>{info.name} ({info.count})</span>
                  </div>
                  <span className="tabular-nums font-bold">{formatMoney(info.total, 'SAR', locale)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-[var(--border-hairline)] pt-4 text-sm">
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>{t(locale, 'subtotal')}</span>
                <span className="tabular-nums">{formatMoney(cart.subtotal, 'SAR', locale)}</span>
              </div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>{t(locale, 'vat_15')}</span>
                <span className="tabular-nums">{formatMoney(cart.tax_amount, 'SAR', locale)}</span>
              </div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>{t(locale, 'shipping_flat')}</span>
                <span className="tabular-nums">{formatMoney(cart.shipping_amount, 'SAR', locale)}</span>
              </div>
              <div className="flex justify-between border-t border-[var(--border-hairline)] pt-3 text-lg font-bold text-[var(--text-primary)]">
                <span>{t(locale, 'grand_total')}</span>
                <span className="tabular-nums">{formatMoney(cart.grand_total, 'SAR', locale)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={processing}
              className="w-full rounded-xl bg-[var(--brand-primary)] py-3.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 transition-colors"
            >
              {processing
                ? locale === 'ar'
                  ? 'جاري قفل المخزون وتوثيق الدفع...'
                  : 'Locking Inventory & Capturing Payment...'
                : t(locale, 'place_order_pay')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
