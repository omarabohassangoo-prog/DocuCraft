import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Plus, Download, Trash2, ShieldCheck, KeyRound, Printer, X } from 'lucide-react';
import type { OrderItemRecord, OrderRecord, VendorSuborderRecord } from '../../shared/types.ts';
import { apiRequest } from '../lib/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { formatMoney, pickI18n, t } from '../i18n/dictionary.ts';
import { AdvancedDataTable } from '../components/crud/AdvancedDataTable.tsx';
import { InvoiceView } from './CheckoutPage.tsx';

export const ModeratorDashboardView: React.FC<{ subpath: string }> = ({ subpath }) => {
  const { locale } = useApp();
  if (subpath.includes('vendor-approvals')) {
    return <AdvancedDataTable resource="vendors" initialStatusFilter="pending" />;
  }
  if (subpath.includes('product-reviews')) {
    return <AdvancedDataTable resource="products" />;
  }
  if (subpath.includes('disputes')) {
    return <AdvancedDataTable resource="contact_inquiries" />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
        <h2 className="text-base font-bold text-[var(--text-primary)]">
          {locale === 'ar' ? 'طابور المراقبة واعتماد التجار (KYC)' : 'Moderation Queue & Vendor KYC Approvals'}
        </h2>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          {locale === 'ar'
            ? 'اضغط على شارة الحالة في الجدول لتوثيق التاجر أو تفعيل المنتجات مباشرة.'
            : 'Click any status badge inline to verify vendor KYC or moderate catalog listings.'}
        </p>
      </div>
      <AdvancedDataTable resource="vendors" />
      <AdvancedDataTable resource="contact_inquiries" />
    </div>
  );
};

export const StaffDashboardView: React.FC<{ subpath: string }> = ({ subpath }) => {
  const { locale } = useApp();
  if (subpath.includes('orders')) {
    return <AdvancedDataTable resource="vendor_suborders" />;
  }
  if (subpath.includes('tickets')) {
    return <AdvancedDataTable resource="contact_inquiries" />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
        <h2 className="text-base font-bold text-[var(--text-primary)]">
          {locale === 'ar' ? 'العمليات اليومية وتجهيز الشحنات' : 'Daily Operations, Fulfillment & Tickets'}
        </h2>
      </div>
      <AdvancedDataTable resource="vendor_suborders" />
      <AdvancedDataTable resource="contact_inquiries" />
    </div>
  );
};

export const VendorDashboardView: React.FC<{ subpath: string }> = ({ subpath }) => {
  const { locale, notify, bootstrap } = useApp();
  const [analytics, setAnalytics] = useState<{
    kpis: { grossRevenue: number; platformCommission: number; vendorNet: number; activeProducts: number; suborderCount: number };
    monthlySeries: { month: string; revenue: number; commission: number }[];
  } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [newProd, setNewProd] = useState({
    title_ar: '',
    title_en: '',
    description_ar: '',
    description_en: '',
    base_price: '450',
    stock_qty: '15',
    category_id: '',
    visual_theme: 'speaker',
  });

  useEffect(() => {
    apiRequest<typeof analytics>('/admin/dashboard/analytics')
      .then(setAnalytics)
      .catch(() => {});
  }, [refreshTick]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/crud/products', {
        method: 'POST',
        body: JSON.stringify({
          ...newProd,
          base_price: Number(newProd.base_price),
          stock_qty: Number(newProd.stock_qty),
          category_id: newProd.category_id || bootstrap?.categories?.[0]?.id,
        }),
      });
      setShowCreateModal(false);
      setNewProd({
        title_ar: '',
        title_en: '',
        description_ar: '',
        description_en: '',
        base_price: '450',
        stock_qty: '15',
        category_id: '',
        visual_theme: 'speaker',
      });
      setRefreshTick((tVal) => tVal + 1);
      notify(locale === 'ar' ? 'تمت إضافة المنتج إلى متجرك بنجاح' : 'Product added to your studio catalog', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create product', 'error');
    }
  };

  if (subpath.includes('orders')) {
    return <AdvancedDataTable resource="vendor_suborders" />;
  }

  if (subpath.includes('products')) {
    return (
      <div className="space-y-6">
        <AdvancedDataTable
          resource="products"
          refreshTrigger={refreshTick}
          headerActions={
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              {locale === 'ar' ? 'منتج جديد' : 'New Product'}
            </button>
          }
        />

        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <form
              onSubmit={handleCreateProduct}
              className="w-full max-w-lg rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  {locale === 'ar' ? 'إضافة منتج جديد لمتجرك' : 'Publish New Product'}
                </h3>
                <button type="button" onClick={() => setShowCreateModal(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  required
                  placeholder="الاسم بالعربية"
                  value={newProd.title_ar}
                  onChange={(e) => setNewProd({ ...newProd, title_ar: e.target.value })}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs"
                />
                <input
                  required
                  placeholder="English Title"
                  value={newProd.title_en}
                  onChange={(e) => setNewProd({ ...newProd, title_en: e.target.value })}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  required
                  min={1}
                  placeholder="Price (SAR)"
                  value={newProd.base_price}
                  onChange={(e) => setNewProd({ ...newProd, base_price: e.target.value })}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs tabular-nums"
                />
                <input
                  type="number"
                  required
                  min={0}
                  placeholder="Initial Stock"
                  value={newProd.stock_qty}
                  onChange={(e) => setNewProd({ ...newProd, stock_qty: e.target.value })}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs tabular-nums"
                />
                <select
                  value={newProd.category_id}
                  onChange={(e) => setNewProd({ ...newProd, category_id: e.target.value })}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs"
                >
                  {(bootstrap?.categories || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {pickI18n(c.name_i18n, locale)}
                    </option>
                  ))}
                </select>
                <select
                  value={newProd.visual_theme}
                  onChange={(e) => setNewProd({ ...newProd, visual_theme: e.target.value })}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs"
                >
                  <option value="speaker">Acoustics / Audio</option>
                  <option value="lamp">Architectural Lamp</option>
                  <option value="fragrance">Botanical Fragrance</option>
                  <option value="leather">Saddlery Leather</option>
                  <option value="tray">Walnut Wood</option>
                  <option value="kettle">Coffee Kettle</option>
                </select>
              </div>
              <textarea
                rows={2}
                placeholder={locale === 'ar' ? 'وصف مختصر بالعربية' : 'Short description'}
                value={newProd.description_ar}
                onChange={(e) => setNewProd({ ...newProd, description_ar: e.target.value, description_en: e.target.value })}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs"
              />
              <button type="submit" className="w-full rounded-lg bg-[var(--brand-primary)] py-2.5 text-xs font-semibold text-white">
                {locale === 'ar' ? 'نشر المنتج' : 'Create Product'}
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (subpath.includes('payouts')) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
            <p className="text-xs text-[var(--text-secondary)]">{locale === 'ar' ? 'إجمالي المبيعات' : 'Gross Sales'}</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{formatMoney(analytics?.kpis.grossRevenue || 0, 'SAR', locale)}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
            <p className="text-xs text-[var(--text-secondary)]">{locale === 'ar' ? 'عمولة المنصة' : 'Platform Fee'}</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{formatMoney(analytics?.kpis.platformCommission || 0, 'SAR', locale)}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
            <p className="text-xs text-[var(--text-secondary)]">{locale === 'ar' ? 'صافي مستحقات التاجر' : 'Net Vendor Payout'}</p>
            <p className="text-2xl font-bold tabular-nums text-[var(--brand-primary)] mt-1">{formatMoney(analytics?.kpis.vendorNet || 0, 'SAR', locale)}</p>
          </div>
        </div>
        <AdvancedDataTable resource="vendor_suborders" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
          <p className="text-xs text-[var(--text-secondary)]">{locale === 'ar' ? 'صافي أرباح المتجر' : 'Vendor Net Earnings'}</p>
          <p className="text-2xl font-bold tabular-nums text-[var(--brand-primary)] mt-1">
            {formatMoney(analytics?.kpis.vendorNet || 0, 'SAR', locale)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
          <p className="text-xs text-[var(--text-secondary)]">{locale === 'ar' ? 'طلبات المتجر الفرعية' : 'Store Sub-Orders'}</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{analytics?.kpis.suborderCount || 0}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
          <p className="text-xs text-[var(--text-secondary)]">{locale === 'ar' ? 'المنتجات النشطة' : 'Active Products'}</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{analytics?.kpis.activeProducts || 0}</p>
        </div>
      </div>

      {analytics && (
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6">
          <h3 className="text-base font-bold text-[var(--text-primary)] mb-4">
            {locale === 'ar' ? 'أداء مبيعات المتجر' : 'Store Revenue Trend'}
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#0f4c3a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

interface CustomerOrder extends OrderRecord {
  suborders: (VendorSuborderRecord & { vendor_name?: { ar: string; en: string }; items: OrderItemRecord[] })[];
}

export const CustomerDashboardView: React.FC<{ subpath: string }> = ({ subpath }) => {
  const { locale, user, logout, notify } = useApp();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<{ id: string; ip_address: string; user_agent: string; is_current: boolean }[]>([]);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; current_sample_code: string } | null>(null);
  const [twoFaEnabled, setTwoFaEnabled] = useState(Boolean(user?.two_factor_enabled));

  useEffect(() => {
    apiRequest<{ orders: CustomerOrder[] }>('/orders/my')
      .then((res) => setOrders(res.orders || []))
      .catch(() => {});
    apiRequest<{ sessions: typeof sessions }>('/auth/sessions')
      .then((res) => setSessions(res.sessions || []))
      .catch(() => {});
  }, []);

  if (selectedInvoiceId) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedInvoiceId(null)}
          className="text-xs font-semibold text-[var(--brand-primary)] hover:underline no-print"
        >
          ← {locale === 'ar' ? 'العودة إلى طلباتي' : 'Back to Orders'}
        </button>
        <InvoiceView orderId={selectedInvoiceId} />
      </div>
    );
  }

  if (subpath.includes('security')) {
    const enable2FA = async () => {
      const res = await apiRequest<{ secret: string; current_sample_code: string }>('/auth/2fa/setup', { method: 'POST' });
      setTotpSetup(res);
      setTwoFaEnabled(true);
      notify(locale === 'ar' ? 'تم تفعيل التحقق الثنائي 2FA' : 'Two-factor authentication enabled', 'success');
    };

    const disable2FA = async () => {
      await apiRequest('/auth/2fa/disable', { method: 'POST' });
      setTotpSetup(null);
      setTwoFaEnabled(false);
    };

    const revokeSession = async (id: string) => {
      await apiRequest(`/auth/sessions/${id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    };

    const downloadGdprExport = async () => {
      const bundle = await apiRequest<Record<string, unknown>>('/auth/gdpr/export');
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ufuq-gdpr-export-${user?.id.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const eraseAccount = async () => {
      try {
        await apiRequest('/auth/gdpr/erase', { method: 'POST' });
        await logout();
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Cannot erase account', 'error');
      }
    };

    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[var(--brand-primary)]" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {locale === 'ar' ? 'المصادقة الثنائية (TOTP 2FA)' : 'Two-Factor Authentication (TOTP)'}
              </h3>
            </div>
            {twoFaEnabled ? (
              <button type="button" onClick={disable2FA} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">
                {locale === 'ar' ? 'تعطيل 2FA' : 'Disable 2FA'}
              </button>
            ) : (
              <button type="button" onClick={enable2FA} className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white">
                {locale === 'ar' ? 'تفعيل 2FA الآن' : 'Enable 2FA'}
              </button>
            )}
          </div>
          {totpSetup && (
            <div className="rounded-lg bg-[var(--surface-muted)] p-4 text-xs space-y-1 font-mono-tabular">
              <div>Secret: {totpSetup.secret}</div>
              <div>Current 6-digit TOTP Code: {totpSetup.current_sample_code}</div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-4">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            {locale === 'ar' ? 'الجلسات النشطة' : 'Active Login Sessions'}
          </h3>
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] p-3 text-xs">
                <div>
                  <div className="font-mono-tabular font-semibold">{s.ip_address} {s.is_current ? '· Current' : ''}</div>
                  <div className="text-[var(--text-secondary)] truncate max-w-md">{s.user_agent}</div>
                </div>
                {!s.is_current && (
                  <button type="button" onClick={() => revokeSession(s.id)} className="text-red-600 hover:underline">
                    {locale === 'ar' ? 'إنهاء' : 'Revoke'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--brand-primary)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {locale === 'ar' ? 'حقوق الخصوصية (GDPR)' : 'GDPR Privacy Controls'}
            </h3>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={downloadGdprExport} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] px-4 py-2 text-xs font-semibold">
              <Download className="h-3.5 w-3.5" />
              {locale === 'ar' ? 'تصدير بياناتي (JSON)' : 'Export My Data (JSON)'}
            </button>
            <button type="button" onClick={eraseAccount} className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-xs font-semibold text-red-700">
              <Trash2 className="h-3.5 w-3.5" />
              {locale === 'ar' ? 'طلب إخفاء الهوية والحذف' : 'Request Anonymization'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          {locale === 'ar' ? `مرحباً، ${user?.full_name}` : `Welcome, ${user?.full_name}`}
        </h2>
        <p className="text-xs text-[var(--text-secondary)] mt-1">{user?.email}</p>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-bold text-[var(--text-primary)]">
          {locale === 'ar' ? 'سجل الطلبات والفواتير الضريبية' : 'Order History & VAT Invoices'}
        </h3>
        {orders.length === 0 ? (
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-8 text-center text-sm text-[var(--text-secondary)]">
            {locale === 'ar' ? 'لا توجد طلبات مسجلة حتى الآن.' : 'No orders placed yet.'}
          </div>
        ) : (
          orders.map((ord) => (
            <div key={ord.id} className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
                <div>
                  <span className="font-mono-tabular text-sm font-bold text-[var(--text-primary)]">{ord.order_number}</span>
                  <span className="ms-3 text-xs text-[var(--text-secondary)]">
                    {new Date(ord.created_at).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums text-sm font-bold text-[var(--brand-primary)]">
                    {formatMoney(ord.grand_total, ord.currency, locale)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceId(ord.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-muted)]"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    {t(locale, 'print_invoice')}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                {ord.suborders.map((s) => (
                  <div key={s.id} className="flex justify-between">
                    <span>
                      {pickI18n(s.vendor_name, locale)} ({s.suborder_number})
                    </span>
                    <span>
                      {t(locale, s.fulfillment_status)} {s.tracking_number ? `· ${s.tracking_number}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
