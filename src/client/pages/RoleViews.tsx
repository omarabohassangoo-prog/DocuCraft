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
import { Plus, Download, Trash2, ShieldCheck, KeyRound, Printer, X, Save, MapPin, Store } from 'lucide-react';
import type { OrderItemRecord, OrderRecord, VendorRecord, VendorSuborderRecord } from '../../shared/types.ts';
import { apiRequest } from '../lib/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { formatMoney, pickI18n, t } from '../i18n/dictionary.ts';
import { AdvancedDataTable } from '../components/crud/AdvancedDataTable.tsx';
import { InvoiceView } from './CheckoutPage.tsx';

interface WorkspaceSummary {
  pendingVendors: number;
  verifiedVendors: number;
  activeProducts: number;
  draftProducts: number;
  openInquiries: number;
  pendingSuborders: number;
  shippedSuborders: number;
}

export const ModeratorDashboardView: React.FC<{ subpath: string }> = ({ subpath }) => {
  const { locale } = useApp();
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);

  useEffect(() => {
    apiRequest<WorkspaceSummary>('/admin/workspace/summary')
      .then(setSummary)
      .catch(() => {});
  }, [subpath]);

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
          <p className="text-xs text-[var(--text-secondary)]">
            {locale === 'ar' ? 'تجار بانتظار اعتماد KYC' : 'Pending Vendor KYC'}
          </p>
          <p className="text-2xl font-bold tabular-nums text-amber-600 mt-1">
            {summary?.pendingVendors ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
          <p className="text-xs text-[var(--text-secondary)]">
            {locale === 'ar' ? 'منتجات الكتالوج النشطة' : 'Active Catalog Listings'}
          </p>
          <p className="text-2xl font-bold tabular-nums text-[var(--brand-primary)] mt-1">
            {summary?.activeProducts ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
          <p className="text-xs text-[var(--text-secondary)]">
            {locale === 'ar' ? 'البلاغات والتذاكر المفتوحة' : 'Open Inquiries & Reports'}
          </p>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {summary?.openInquiries ?? 0}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
        <h2 className="text-base font-bold text-[var(--text-primary)]">
          {locale === 'ar' ? 'طابور المراقبة واعتماد التجار (KYC)' : 'Moderation Queue & Vendor KYC Approvals'}
        </h2>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          {locale === 'ar'
            ? 'اضغط على شارة الحالة في الجدول لتوثيق التاجر أو تفعيل المنتجات أو معالجة البلاغات مباشرة.'
            : 'Click any status badge inline to verify vendor KYC, moderate catalog listings, or resolve inquiries.'}
        </p>
      </div>
      <AdvancedDataTable resource="vendors" />
      <AdvancedDataTable resource="contact_inquiries" />
    </div>
  );
};

export const StaffDashboardView: React.FC<{ subpath: string }> = ({ subpath }) => {
  const { locale } = useApp();
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);

  useEffect(() => {
    apiRequest<WorkspaceSummary>('/admin/workspace/summary')
      .then(setSummary)
      .catch(() => {});
  }, [subpath]);

  if (subpath.includes('orders')) {
    return <AdvancedDataTable resource="vendor_suborders" />;
  }
  if (subpath.includes('tickets')) {
    return <AdvancedDataTable resource="contact_inquiries" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
          <p className="text-xs text-[var(--text-secondary)]">
            {locale === 'ar' ? 'شحنات بانتظار التجهيز' : 'Pending / Packed Sub-Orders'}
          </p>
          <p className="text-2xl font-bold tabular-nums text-amber-600 mt-1">
            {summary?.pendingSuborders ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
          <p className="text-xs text-[var(--text-secondary)]">
            {locale === 'ar' ? 'شحنات تم شحنها/تسليمها' : 'Shipped & Delivered'}
          </p>
          <p className="text-2xl font-bold tabular-nums text-[var(--brand-primary)] mt-1">
            {summary?.shippedSuborders ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
          <p className="text-xs text-[var(--text-secondary)]">
            {locale === 'ar' ? 'تذاكر الدعم المفتوحة' : 'Open Support Tickets'}
          </p>
          <p className="text-2xl font-bold tabular-nums mt-1">
            {summary?.openInquiries ?? 0}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
        <h2 className="text-base font-bold text-[var(--text-primary)]">
          {locale === 'ar' ? 'العمليات اليومية وتجهيز الشحنات' : 'Daily Operations, Fulfillment & Tickets'}
        </h2>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          {locale === 'ar'
            ? 'يمكنك تحديث رقم التتبع وحالة الشحن أو الرد على تذاكر العملاء مباشرة من الجداول أدناه.'
            : 'Update tracking numbers, fulfillment status, or ticket resolution inline below.'}
        </p>
      </div>
      <AdvancedDataTable resource="vendor_suborders" />
      <AdvancedDataTable resource="contact_inquiries" />
    </div>
  );
};

export const VendorDashboardView: React.FC<{ subpath: string }> = ({ subpath }) => {
  const { locale, notify, bootstrap, refreshBootstrap } = useApp();
  const [analytics, setAnalytics] = useState<{
    kpis: { grossRevenue: number; platformCommission: number; vendorNet: number; activeProducts: number; suborderCount: number };
    monthlySeries: { month: string; revenue: number; commission: number }[];
  } | null>(null);
  const [stores, setStores] = useState<VendorRecord[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [storeForm, setStoreForm] = useState({
    store_name_ar: '',
    store_name_en: '',
    tagline_ar: '',
    tagline_en: '',
    commercial_reg_no: '',
    logo_file_id: '',
  });
  const [savingStore, setSavingStore] = useState(false);

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
    primary_image_id: '',
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    apiRequest<typeof analytics>('/admin/dashboard/analytics')
      .then(setAnalytics)
      .catch(() => {});
  }, [refreshTick]);

  useEffect(() => {
    if (!subpath.includes('store-settings')) return;
    apiRequest<{ stores: VendorRecord[] }>('/admin/vendor/store-settings')
      .then((res) => {
        const list = res.stores || [];
        setStores(list);
        if (list.length > 0) {
          const active = list.find((s) => s.id === selectedStoreId) || list[0];
          setSelectedStoreId(active.id);
          setStoreForm({
            store_name_ar: active.store_name_i18n.ar,
            store_name_en: active.store_name_i18n.en,
            tagline_ar: active.tagline_i18n?.ar || '',
            tagline_en: active.tagline_i18n?.en || '',
            commercial_reg_no: active.commercial_reg_no || '',
            logo_file_id: active.logo_file_id || '',
          });
        }
      })
      .catch(() => {});
  }, [subpath, refreshTick]);

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
      const res = await apiRequest<{ file: { id: string }; url: string }>('/media/upload', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          mime_type: file.type,
          data_base64: dataBase64,
        }),
      });
      setNewProd((prev) => ({ ...prev, primary_image_id: res.file.id }));
      notify(locale === 'ar' ? 'تم رفع الصورة وتخزينها بنجاح' : 'Image uploaded successfully', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Image upload failed', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

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
        primary_image_id: '',
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
              <div className="rounded-lg border border-dashed border-[var(--border-hairline)] p-3 text-xs space-y-2">
                <label className="block font-medium text-[var(--text-secondary)]">
                  {locale === 'ar' ? 'صورة المنتج (JPEG / PNG / WebP / AVIF)' : 'Product Image (JPEG / PNG / WebP / AVIF)'}
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  disabled={uploadingImage}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                  }}
                  className="block w-full text-xs"
                />
                {newProd.primary_image_id && (
                  <img
                    src={`/api/v1/public/media/${newProd.primary_image_id}`}
                    alt="Uploaded preview"
                    className="h-20 w-28 rounded-lg object-cover border border-[var(--border-hairline)]"
                  />
                )}
              </div>
              <textarea
                rows={2}
                placeholder={locale === 'ar' ? 'وصف مختصر بالعربية' : 'Short description'}
                value={newProd.description_ar}
                onChange={(e) => setNewProd({ ...newProd, description_ar: e.target.value, description_en: e.target.value })}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={uploadingImage}
                className="w-full rounded-lg bg-[var(--brand-primary)] py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {uploadingImage
                  ? locale === 'ar'
                    ? 'جاري رفع الصورة...'
                    : 'Uploading image...'
                  : locale === 'ar'
                    ? 'نشر المنتج'
                    : 'Create Product'}
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

  if (subpath.includes('store-settings')) {
    const activeStore = stores.find((s) => s.id === selectedStoreId) || stores[0];

    const handleSelectStore = (id: string) => {
      setSelectedStoreId(id);
      const found = stores.find((s) => s.id === id);
      if (found) {
        setStoreForm({
          store_name_ar: found.store_name_i18n.ar,
          store_name_en: found.store_name_i18n.en,
          tagline_ar: found.tagline_i18n?.ar || '',
          tagline_en: found.tagline_i18n?.en || '',
          commercial_reg_no: found.commercial_reg_no || '',
          logo_file_id: found.logo_file_id || '',
        });
      }
    };

    const handleLogoUpload = async (file: File) => {
      setUploadingImage(true);
      try {
        const dataBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Failed to read logo file'));
          reader.readAsDataURL(file);
        });
        const res = await apiRequest<{ file: { id: string } }>('/media/upload', {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            mime_type: file.type,
            data_base64: dataBase64,
          }),
        });
        setStoreForm((prev) => ({ ...prev, logo_file_id: res.file.id }));
        notify(locale === 'ar' ? 'تم رفع شعار المتجر بنجاح' : 'Store logo uploaded', 'success');
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Logo upload failed', 'error');
      } finally {
        setUploadingImage(false);
      }
    };

    const handleSaveStore = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeStore) return;
      setSavingStore(true);
      try {
        await apiRequest('/admin/vendor/store-settings', {
          method: 'PATCH',
          body: JSON.stringify({
            vendor_id: activeStore.id,
            store_name_ar: storeForm.store_name_ar,
            store_name_en: storeForm.store_name_en,
            tagline_ar: storeForm.tagline_ar,
            tagline_en: storeForm.tagline_en,
            commercial_reg_no: storeForm.commercial_reg_no || null,
            logo_file_id: storeForm.logo_file_id || null,
          }),
        });
        setRefreshTick((n) => n + 1);
        await refreshBootstrap();
        notify(locale === 'ar' ? 'تم حفظ إعدادات المتجر بنجاح' : 'Storefront settings updated', 'success');
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Failed to save store settings', 'error');
      } finally {
        setSavingStore(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-[var(--brand-primary)]" />
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">
                  {locale === 'ar' ? 'إعدادات المتجر والهوية التجارية' : 'Storefront Profile & Branding'}
                </h2>
                {activeStore && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Slug: {activeStore.store_slug} · KYC: {t(locale, activeStore.kyc_status)} ·{' '}
                    {locale === 'ar' ? `العمولة: ${activeStore.commission_rate}%` : `Commission: ${activeStore.commission_rate}%`}
                  </p>
                )}
              </div>
            </div>

            {stores.length > 1 && (
              <select
                value={selectedStoreId}
                onChange={(e) => handleSelectStore(e.target.value)}
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-1.5 text-xs font-medium"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {pickI18n(s.store_name_i18n, locale)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <form onSubmit={handleSaveStore} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  {locale === 'ar' ? 'اسم المتجر (عربي)' : 'Store Name (Arabic)'}
                </label>
                <input
                  required
                  value={storeForm.store_name_ar}
                  onChange={(e) => setStoreForm({ ...storeForm, store_name_ar: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  {locale === 'ar' ? 'اسم المتجر (إنجليزي)' : 'Store Name (English)'}
                </label>
                <input
                  required
                  value={storeForm.store_name_en}
                  onChange={(e) => setStoreForm({ ...storeForm, store_name_en: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  {locale === 'ar' ? 'الوصف التعريفي (عربي)' : 'Tagline (Arabic)'}
                </label>
                <input
                  value={storeForm.tagline_ar}
                  onChange={(e) => setStoreForm({ ...storeForm, tagline_ar: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  {locale === 'ar' ? 'الوصف التعريفي (إنجليزي)' : 'Tagline (English)'}
                </label>
                <input
                  value={storeForm.tagline_en}
                  onChange={(e) => setStoreForm({ ...storeForm, tagline_en: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  {locale === 'ar' ? 'رقم السجل التجاري' : 'Commercial Registration No.'}
                </label>
                <input
                  value={storeForm.commercial_reg_no}
                  onChange={(e) => setStoreForm({ ...storeForm, commercial_reg_no: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  {locale === 'ar' ? 'شعار المتجر (اختياري)' : 'Store Logo (Optional)'}
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  disabled={uploadingImage}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f);
                  }}
                  className="block w-full text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {storeForm.logo_file_id ? (
                <img
                  src={`/api/v1/public/media/${storeForm.logo_file_id}`}
                  alt="Store logo"
                  className="h-12 w-12 rounded-lg object-cover border border-[var(--border-hairline)]"
                />
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={savingStore || uploadingImage}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {locale === 'ar' ? 'حفظ التغييرات' : 'Save Store Settings'}
              </button>
            </div>
          </form>
        </div>
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

interface SavedAddressItem {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  city: string;
  street: string;
  postal_code: string;
  is_default: boolean;
}

export const CustomerDashboardView: React.FC<{ subpath: string }> = ({ subpath }) => {
  const { locale, user, logout, notify, navigate } = useApp();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<{ id: string; ip_address: string; user_agent: string; is_current: boolean }[]>([]);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; current_sample_code: string } | null>(null);
  const [twoFaEnabled, setTwoFaEnabled] = useState(Boolean(user?.two_factor_enabled));
  const [addresses, setAddresses] = useState<SavedAddressItem[]>([]);
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addrForm, setAddrForm] = useState({
    label: '',
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    city: '',
    street: '',
    postal_code: '',
    is_default: false,
  });

  useEffect(() => {
    apiRequest<{ orders: CustomerOrder[] }>('/orders/my')
      .then((res) => setOrders(res.orders || []))
      .catch(() => {});
    apiRequest<{ sessions: typeof sessions }>('/auth/sessions')
      .then((res) => setSessions(res.sessions || []))
      .catch(() => {});
    apiRequest<{ addresses: SavedAddressItem[] }>('/auth/addresses')
      .then((res) => setAddresses(res.addresses || []))
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

  if (subpath.includes('addresses')) {
    const handleAddAddress = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const res = await apiRequest<{ addresses: SavedAddressItem[] }>('/auth/addresses', {
          method: 'POST',
          body: JSON.stringify({
            ...addrForm,
            label: addrForm.label || (locale === 'ar' ? 'المنزل' : 'Home'),
          }),
        });
        setAddresses(res.addresses || []);
        setShowAddrForm(false);
        setAddrForm({
          label: '',
          full_name: user?.full_name || '',
          phone: user?.phone || '',
          city: '',
          street: '',
          postal_code: '',
          is_default: false,
        });
        notify(locale === 'ar' ? 'تم حفظ عنوان التوصيل بنجاح' : 'Shipping address saved', 'success');
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Failed to save address', 'error');
      }
    };

    const handleSetDefault = async (id: string) => {
      try {
        const res = await apiRequest<{ addresses: SavedAddressItem[] }>(`/auth/addresses/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_default: true }),
        });
        setAddresses(res.addresses || []);
        notify(locale === 'ar' ? 'تم تعيين العنوان الافتراضي' : 'Default address updated', 'success');
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Update failed', 'error');
      }
    };

    const handleDeleteAddress = async (id: string) => {
      try {
        const res = await apiRequest<{ addresses: SavedAddressItem[] }>(`/auth/addresses/${id}`, {
          method: 'DELETE',
        });
        setAddresses(res.addresses || []);
        notify(locale === 'ar' ? 'تم حذف العنوان' : 'Address removed', 'info');
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Delete failed', 'error');
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[var(--brand-primary)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              {locale === 'ar' ? 'عناوين التوصيل المحفوظة' : 'Saved Shipping Addresses'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowAddrForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3.5 py-2 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            {locale === 'ar' ? 'إضافة عنوان جديد' : 'Add Address'}
          </button>
        </div>

        {showAddrForm && (
          <form
            onSubmit={handleAddAddress}
            className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                placeholder={locale === 'ar' ? 'تسمية العنوان (المنزل / العمل)' : 'Label (Home / Office)'}
                value={addrForm.label}
                onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs"
              />
              <input
                required
                placeholder={t(locale, 'full_name')}
                value={addrForm.full_name}
                onChange={(e) => setAddrForm({ ...addrForm, full_name: e.target.value })}
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs"
              />
              <input
                required
                placeholder={t(locale, 'phone')}
                value={addrForm.phone}
                onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })}
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs font-mono-tabular"
              />
              <input
                required
                placeholder={t(locale, 'city')}
                value={addrForm.city}
                onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs"
              />
              <input
                required
                placeholder={t(locale, 'street')}
                value={addrForm.street}
                onChange={(e) => setAddrForm({ ...addrForm, street: e.target.value })}
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs"
              />
              <input
                required
                placeholder={t(locale, 'postal_code')}
                value={addrForm.postal_code}
                onChange={(e) => setAddrForm({ ...addrForm, postal_code: e.target.value })}
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs font-mono-tabular"
              />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={addrForm.is_default}
                onChange={(e) => setAddrForm({ ...addrForm, is_default: e.target.checked })}
              />
              <span>{locale === 'ar' ? 'تعيين كعنوان افتراضي' : 'Set as default shipping address'}</span>
            </label>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white">
                {locale === 'ar' ? 'حفظ العنوان' : 'Save Address'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddrForm(false)}
                className="rounded-lg border border-[var(--border-hairline)] px-4 py-2 text-xs"
              >
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </form>
        )}

        {addresses.length === 0 ? (
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-8 text-center text-sm text-[var(--text-secondary)]">
            {locale === 'ar' ? 'لا توجد عناوين محفوظة بعد.' : 'No shipping addresses saved yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map((addr) => (
              <div key={addr.id} className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[var(--text-primary)]">{addr.label}</span>
                  {addr.is_default && (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {locale === 'ar' ? 'افتراضي' : 'Default'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-primary)]">{addr.full_name}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {addr.street} · {addr.city} ({addr.postal_code})
                </p>
                <p className="text-xs font-mono-tabular text-[var(--text-secondary)]">{addr.phone}</p>
                <div className="flex items-center gap-3 pt-2 border-t border-[var(--border-hairline)] text-xs">
                  {!addr.is_default && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(addr.id)}
                      className="font-semibold text-[var(--brand-primary)] hover:underline"
                    >
                      {locale === 'ar' ? 'تعيين كافتراضي' : 'Set Default'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteAddress(addr.id)}
                    className="text-red-600 hover:underline"
                  >
                    {locale === 'ar' ? 'حذف' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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

  const isOrdersPage = subpath.includes('orders');
  const totalSpent = orders.reduce((acc, o) => acc + o.grand_total, 0);

  return (
    <div className="space-y-6">
      {!isOrdersPage && (
        <>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {locale === 'ar' ? `مرحباً، ${user?.full_name}` : `Welcome, ${user?.full_name}`}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{user?.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate('/dashboard/customer/addresses')}
                className="rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--surface-muted)]"
              >
                {locale === 'ar' ? 'إدارة العناوين' : 'Manage Addresses'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard/customer/security')}
                className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white"
              >
                {locale === 'ar' ? 'الأمان و 2FA' : 'Security & 2FA'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
              <p className="text-xs text-[var(--text-secondary)]">{locale === 'ar' ? 'إجمالي الطلبات' : 'Total Orders'}</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{orders.length}</p>
            </div>
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
              <p className="text-xs text-[var(--text-secondary)]">{locale === 'ar' ? 'إجمالي المشتريات' : 'Total Spent'}</p>
              <p className="text-2xl font-bold tabular-nums text-[var(--brand-primary)] mt-1">
                {formatMoney(totalSpent, 'SAR', locale)}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5">
              <p className="text-xs text-[var(--text-secondary)]">{locale === 'ar' ? 'عناوين التوصيل' : 'Saved Addresses'}</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{addresses.length}</p>
            </div>
          </div>
        </>
      )}

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
