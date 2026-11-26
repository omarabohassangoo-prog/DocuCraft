import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { KeyRound, CheckCircle2, Save, Plus, Shield } from 'lucide-react';
import type {
  AdUnitRecord,
  CmsPageRecord,
  CmsSectionRecord,
  PermissionRecord,
  RoleRecord,
  SystemSettingRecord,
} from '../../shared/types.ts';
import { apiRequest } from '../lib/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { formatMoney, pickI18n } from '../i18n/dictionary.ts';
import { AdvancedDataTable } from '../components/crud/AdvancedDataTable.tsx';

interface AnalyticsData {
  kpis: {
    grossRevenue: number;
    platformCommission: number;
    vendorNet: number;
    totalOrders: number;
    suborderCount: number;
    activeVendors: number;
    activeProducts: number;
    lowStockCount: number;
    pendingVendors: number;
    openInquiries: number;
  };
  monthlySeries: { month: string; revenue: number; commission: number; orders: number }[];
}

export const AdminOverviewView: React.FC = () => {
  const { locale } = useApp();
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    apiRequest<AnalyticsData>('/admin/dashboard/analytics')
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return <div className="p-8 text-sm text-[var(--text-secondary)]">Loading analytics...</div>;
  }

  const cards = [
    {
      label: locale === 'ar' ? 'إجمالي المبيعات (GMV)' : 'Gross Merchandise Value',
      value: formatMoney(data.kpis.grossRevenue, 'SAR', locale),
      sub: `${data.kpis.totalOrders} ${locale === 'ar' ? 'طلب رئيسي' : 'orders'}`,
    },
    {
      label: locale === 'ar' ? 'عمولة المنصة المحققة' : 'Platform Commission',
      value: formatMoney(data.kpis.platformCommission, 'SAR', locale),
      sub: `${data.kpis.suborderCount} ${locale === 'ar' ? 'طلب فرعي للتجار' : 'vendor sub-orders'}`,
    },
    {
      label: locale === 'ar' ? 'المتاجر النشطة' : 'Active Vendors',
      value: String(data.kpis.activeVendors),
      sub: `${data.kpis.pendingVendors} ${locale === 'ar' ? 'بانتظار اعتماد KYC' : 'pending KYC'}`,
    },
    {
      label: locale === 'ar' ? 'المنتجات النشطة' : 'Active Catalog SKUs',
      value: String(data.kpis.activeProducts),
      sub: `${data.kpis.lowStockCount} ${locale === 'ar' ? 'تنبيه مخزون منخفض' : 'low-stock alerts'}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, idx) => (
          <div key={idx} className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5 space-y-1.5">
            <p className="text-xs font-medium text-[var(--text-secondary)]">{c.label}</p>
            <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">{c.value}</p>
            <p className="text-xs text-[var(--text-secondary)] tabular-nums">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            {locale === 'ar' ? 'منحنى الإيرادات والعمولات الشهري' : 'Monthly Revenue & Platform Commission'}
          </h3>
          <span className="text-xs text-[var(--text-secondary)] tabular-nums">SAR</span>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.monthlySeries}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#0f4c3a"
                fill="#0f4c3a"
                fillOpacity={0.18}
                name={locale === 'ar' ? 'الإيرادات' : 'Revenue'}
              />
              <Area
                type="monotone"
                dataKey="commission"
                stroke="#b45309"
                fill="#b45309"
                fillOpacity={0.22}
                name={locale === 'ar' ? 'العمولة' : 'Commission'}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export const AdminCmsEditorView: React.FC = () => {
  const { locale, notify } = useApp();
  const [pages, setPages] = useState<(CmsPageRecord & { sections: CmsSectionRecord[] })[]>([]);
  const [selectedSection, setSelectedSection] = useState<CmsSectionRecord | null>(null);
  const [draftAr, setDraftAr] = useState('');
  const [draftEn, setDraftEn] = useState('');

  const loadPages = () => {
    apiRequest<{ pages: (CmsPageRecord & { sections: CmsSectionRecord[] })[] }>('/admin/cms/pages')
      .then((res) => {
        setPages(res.pages || []);
        if (!selectedSection && res.pages?.[0]?.sections?.[0]) {
          const sec = res.pages[0].sections[0];
          setSelectedSection(sec);
          setDraftAr(JSON.stringify(sec.content_i18n.ar, null, 2));
          setDraftEn(JSON.stringify(sec.content_i18n.en, null, 2));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectSec = (sec: CmsSectionRecord) => {
    setSelectedSection(sec);
    setDraftAr(JSON.stringify(sec.content_i18n.ar, null, 2));
    setDraftEn(JSON.stringify(sec.content_i18n.en, null, 2));
  };

  const handleSave = async () => {
    if (!selectedSection) return;
    try {
      const arObj = JSON.parse(draftAr);
      const enObj = JSON.parse(draftEn);
      await apiRequest(`/admin/cms/sections/${selectedSection.id}`, {
        method: 'PUT',
        body: JSON.stringify({ content_i18n: { ar: arObj, en: enObj }, is_visible: true }),
      });
      notify(locale === 'ar' ? 'تم حفظ القسم وتحديث الكاش فوراً' : 'CMS section saved & cache invalidated', 'success');
      loadPages();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Invalid JSON or save error', 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-4 space-y-4">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          {locale === 'ar' ? 'الصفحات والأقسام الديناميكية' : 'CMS Pages & Sections'}
        </h3>
        <div className="space-y-3">
          {pages.map((p) => (
            <div key={p.id} className="space-y-1">
              <div className="text-xs font-semibold text-[var(--text-secondary)]">
                /{p.slug} — {pickI18n(p.title_i18n, locale)}
              </div>
              {p.sections.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => selectSec(sec)}
                  className={`w-full rounded-lg border px-3 py-2 text-start text-xs font-medium ${
                    selectedSection?.id === sec.id
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                      : 'border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
                  }`}
                >
                  {sec.section_type} (#{sec.sort_order})
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-8 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            {locale === 'ar' ? 'محرر المحتوى ثنائي اللغة' : 'Bilingual Section Editor'}
          </h3>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white"
          >
            <Save className="h-3.5 w-3.5" />
            {locale === 'ar' ? 'حفظ ونشر' : 'Save & Publish'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">العربية (AR JSON)</label>
            <textarea
              rows={14}
              value={draftAr}
              onChange={(e) => setDraftAr(e.target.value)}
              dir="rtl"
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] p-3 font-mono-tabular text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">English (EN JSON)</label>
            <textarea
              rows={14}
              value={draftEn}
              onChange={(e) => setDraftEn(e.target.value)}
              dir="ltr"
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] p-3 font-mono-tabular text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminSeoAdsView: React.FC = () => {
  const { locale, notify, refreshBootstrap } = useApp();
  const [adUnits, setAdUnits] = useState<AdUnitRecord[]>([]);
  const [ga4Id, setGa4Id] = useState('');
  const [robotsTxt, setRobotsTxt] = useState('');
  const [newAd, setNewAd] = useState({
    name: '',
    adsense_client_id: 'ca-pub-7429103847102934',
    adsense_slot_id: '',
    placement: 'blog_sidebar' as AdUnitRecord['placement'],
  });

  const load = () => {
    apiRequest<{ settings: SystemSettingRecord[]; adUnits: AdUnitRecord[] }>('/admin/settings')
      .then((res) => {
        setAdUnits(res.adUnits || []);
        const ga = res.settings.find((s) => s.setting_key === 'ga4_measurement_id');
        const rb = res.settings.find((s) => s.setting_key === 'robots_txt');
        if (ga) setGa4Id(String(ga.setting_value || ''));
        if (rb) setRobotsTxt(String(rb.setting_value || ''));
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const saveSeo = async () => {
    await apiRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        updates: [
          { setting_group: 'analytics', setting_key: 'ga4_measurement_id', setting_value: ga4Id, is_public: true },
          { setting_group: 'seo', setting_key: 'robots_txt', setting_value: robotsTxt, is_public: false },
        ],
      }),
    });
    await refreshBootstrap();
    notify(locale === 'ar' ? 'تم حفظ إعدادات SEO و GA4' : 'SEO & GA4 settings updated', 'success');
  };

  const toggleAdUnit = async (unit: AdUnitRecord) => {
    await apiRequest('/admin/adsense', {
      method: 'POST',
      body: JSON.stringify({ ...unit, is_active: !unit.is_active }),
    });
    await refreshBootstrap();
    load();
  };

  const createAdUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/admin/adsense', {
      method: 'POST',
      body: JSON.stringify(newAd),
    });
    setNewAd({ ...newAd, name: '', adsense_slot_id: '' });
    await refreshBootstrap();
    load();
    notify(locale === 'ar' ? 'تمت إضافة وحدة AdSense' : 'AdSense unit created', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            {locale === 'ar' ? 'إعدادات GA4 و Robots.txt و Sitemap' : 'GA4 Analytics, Robots.txt & Sitemap'}
          </h3>
          <button
            type="button"
            onClick={saveSeo}
            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white"
          >
            {locale === 'ar' ? 'حفظ SEO' : 'Save SEO'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">GA4 Measurement ID</label>
            <input
              value={ga4Id}
              onChange={(e) => setGa4Id(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">robots.txt</label>
            <textarea
              rows={4}
              value={robotsTxt}
              onChange={(e) => setRobotsTxt(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs font-mono-tabular"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-5">
        <h3 className="text-base font-bold text-[var(--text-primary)]">Google AdSense Units</h3>
        <div className="space-y-2.5">
          {adUnits.map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-hairline)] p-3.5 text-sm"
            >
              <div>
                <div className="font-semibold text-[var(--text-primary)]">{u.name}</div>
                <div className="font-mono-tabular text-xs text-[var(--text-secondary)]">
                  {u.placement} · {u.adsense_client_id} · Slot {u.adsense_slot_id}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleAdUnit(u)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  u.is_active
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-[var(--surface-muted)] text-[var(--text-secondary)]'
                }`}
              >
                {u.is_active ? (locale === 'ar' ? 'مفعل' : 'Active') : (locale === 'ar' ? 'معطل' : 'Paused')}
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={createAdUnit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 border-t border-[var(--border-hairline)] pt-4">
          <input
            required
            placeholder="Unit Name"
            value={newAd.name}
            onChange={(e) => setNewAd({ ...newAd, name: e.target.value })}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs"
          />
          <input
            required
            placeholder="Slot ID"
            value={newAd.adsense_slot_id}
            onChange={(e) => setNewAd({ ...newAd, adsense_slot_id: e.target.value })}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs font-mono-tabular"
          />
          <select
            value={newAd.placement}
            onChange={(e) => setNewAd({ ...newAd, placement: e.target.value as AdUnitRecord['placement'] })}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs"
          >
            <option value="blog_sidebar">blog_sidebar</option>
            <option value="catalog_top">catalog_top</option>
            <option value="home_mid">home_mid</option>
            <option value="article_middle">article_middle</option>
          </select>
          <button type="submit" className="inline-flex items-center justify-center gap-1 rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-xs font-semibold text-white">
            <Plus className="h-3.5 w-3.5" />
            {locale === 'ar' ? 'إضافة وحدة' : 'Add Ad Unit'}
          </button>
        </form>
      </div>
    </div>
  );
};

export const AdminUsersRbacView: React.FC = () => {
  const { locale } = useApp();
  const [roles, setRoles] = useState<(RoleRecord & { permissions: PermissionRecord[] })[]>([]);

  useEffect(() => {
    apiRequest<{ roles: (RoleRecord & { permissions: PermissionRecord[] })[] }>('/admin/rbac/matrix')
      .then((res) => setRoles(res.roles || []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <AdvancedDataTable resource="users" />

      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[var(--brand-primary)]" />
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            {locale === 'ar' ? 'مصفوفة الأدوار والصلاحيات (RBAC / ABAC)' : 'RBAC / ABAC Permission Matrix'}
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((r) => (
            <div key={r.id} className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-canvas)] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[var(--text-primary)]">{pickI18n(r.name_i18n, locale)}</span>
                <span className="font-mono-tabular text-xs text-[var(--brand-primary)]">{r.code}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{r.description}</p>
              <div className="flex flex-wrap gap-1 pt-1">
                {r.permissions.slice(0, 8).map((p) => (
                  <span key={p.id} className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono-tabular text-[10px] text-[var(--text-secondary)]">
                    {p.code}
                  </span>
                ))}
                {r.permissions.length > 8 && (
                  <span className="text-[10px] text-[var(--text-secondary)]">+{r.permissions.length - 8}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const AdminSettingsVaultView: React.FC = () => {
  const { locale, notify, refreshBootstrap } = useApp();
  const [brandColor, setBrandColor] = useState('#0f4c3a');
  const [accentColor, setAccentColor] = useState('#b45309');
  const [vatRate, setVatRate] = useState(15);
  const [adsEnabled, setAdsEnabled] = useState(true);
  const [maintenance, setMaintenance] = useState(false);

  const [vaultSecrets, setVaultSecrets] = useState<
    { id: string; service_name: string; env_key: string; masked_preview: string; key_version: number }[]
  >([]);
  const [envStatus, setEnvStatus] = useState<
    { service_name: string; env_key: string; configured_in_env: boolean }[]
  >([]);
  const [secretForm, setSecretForm] = useState({
    service_name: 'stripe',
    env_key: 'STRIPE_SECRET_KEY',
    plaintext_value: '',
  });
  const [pingResult, setPingResult] = useState<string | null>(null);

  const loadVault = () => {
    apiRequest<{
      secrets: { id: string; service_name: string; env_key: string; masked_preview: string; key_version: number }[];
      envConfiguredKeys: { service_name: string; env_key: string; configured_in_env: boolean }[];
    }>('/admin/env-secrets')
      .then((res) => {
        setVaultSecrets(res.secrets || []);
        setEnvStatus(res.envConfiguredKeys || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    apiRequest<{ settings: SystemSettingRecord[] }>('/admin/settings')
      .then((res) => {
        const findVal = (k: string) => res.settings.find((s) => s.setting_key === k)?.setting_value;
        if (findVal('brand_primary_color')) setBrandColor(String(findVal('brand_primary_color')));
        if (findVal('brand_accent_color')) setAccentColor(String(findVal('brand_accent_color')));
        if (findVal('vat_rate') !== undefined) setVatRate(Number(findVal('vat_rate')));
        if (findVal('enable_adsense') !== undefined) setAdsEnabled(Boolean(findVal('enable_adsense')));
        if (findVal('maintenance_mode') !== undefined) setMaintenance(Boolean(findVal('maintenance_mode')));
      })
      .catch(() => {});
    loadVault();
  }, []);

  const saveSettings = async () => {
    await apiRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        updates: [
          { setting_group: 'theme', setting_key: 'brand_primary_color', setting_value: brandColor, is_public: true },
          { setting_group: 'theme', setting_key: 'brand_accent_color', setting_value: accentColor, is_public: true },
          { setting_group: 'ecommerce', setting_key: 'vat_rate', setting_value: vatRate, is_public: true },
          { setting_group: 'feature_flags', setting_key: 'enable_adsense', setting_value: adsEnabled, is_public: true },
          { setting_group: 'feature_flags', setting_key: 'maintenance_mode', setting_value: maintenance, is_public: true },
        ],
      }),
    });
    await refreshBootstrap();
    notify(locale === 'ar' ? 'تم تحديث إعدادات المنصة والهوية' : 'Platform settings saved', 'success');
  };

  const saveSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/admin/env-secrets', {
        method: 'POST',
        body: JSON.stringify(secretForm),
      });
      setSecretForm({ ...secretForm, plaintext_value: '' });
      loadVault();
      notify(locale === 'ar' ? 'تم تشفير المفتاح بـ AES-256-GCM وحفظه بأمان' : 'Secret encrypted (AES-256-GCM) & stored', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to encrypt secret', 'error');
    }
  };

  const testConnection = async (serviceName: string) => {
    try {
      const res = await apiRequest<{
        service_name: string;
        status: string;
        message: string;
        latency_ms: number;
      }>('/admin/env-secrets/test-connection', {
        method: 'POST',
        body: JSON.stringify({ service_name: serviceName }),
      });
      setPingResult(`${res.service_name}: ${res.status} — ${res.message} (${res.latency_ms}ms)`);
    } catch (err) {
      setPingResult(err instanceof Error ? err.message : 'Ping failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            {locale === 'ar' ? 'إعدادات الهوية والألوان والضرائب' : 'Brand Theme, VAT & Feature Flags'}
          </h3>
          <button
            type="button"
            onClick={saveSettings}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white"
          >
            <Save className="h-3.5 w-3.5" />
            {locale === 'ar' ? 'حفظ الإعدادات' : 'Save Settings'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Primary Brand Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-9 w-12 rounded border border-[var(--border-hairline)]" />
              <input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-1.5 font-mono-tabular text-xs" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Accent Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-12 rounded border border-[var(--border-hairline)]" />
              <input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-1.5 font-mono-tabular text-xs" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">VAT Rate (%)</label>
            <input type="number" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm tabular-nums" />
          </div>
        </div>

        <div className="flex flex-wrap gap-6 pt-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={adsEnabled} onChange={(e) => setAdsEnabled(e.target.checked)} />
            <span>{locale === 'ar' ? 'تفعيل إعلانات AdSense بالمدونة' : 'Enable AdSense slots on public editorial pages'}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={maintenance} onChange={(e) => setMaintenance(e.target.checked)} />
            <span>{locale === 'ar' ? 'وضع الصيانة' : 'Maintenance Mode'}</span>
          </label>
        </div>
      </div>

      {/* AES-256-GCM Encrypted Secrets Vault */}
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[var(--brand-primary)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {locale === 'ar' ? 'خزنة المفاتيح المشفرة (.env AES-256-GCM Vault)' : 'Encrypted .env Secrets Vault (AES-256-GCM)'}
            </h3>
          </div>
          {pingResult && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono-tabular text-[var(--brand-primary)]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {pingResult}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {envStatus.map((item) => {
            const stored = vaultSecrets.find((s) => s.env_key === item.env_key);
            return (
              <div key={item.env_key} className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase text-[var(--text-primary)]">{item.service_name}</span>
                  <button
                    type="button"
                    onClick={() => testConnection(item.service_name)}
                    className="text-[11px] font-semibold text-[var(--brand-primary)] hover:underline"
                  >
                    {locale === 'ar' ? 'فحص الاتصال الحي' : 'Live Ping'}
                  </button>
                </div>
                <div className="font-mono-tabular text-[11px] text-[var(--text-secondary)]">{item.env_key}</div>
                <div className="font-mono-tabular text-xs text-[var(--text-primary)]">
                  {stored
                    ? `${stored.masked_preview} (v${stored.key_version})`
                    : item.configured_in_env
                      ? 'Configured in ENV'
                      : locale === 'ar'
                        ? 'غير مضبوط بعد'
                        : 'Not Configured'}
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={saveSecret} className="grid grid-cols-1 sm:grid-cols-4 gap-3 border-t border-[var(--border-hairline)] pt-4">
          <select
            value={secretForm.service_name}
            onChange={(e) => {
              const map: Record<string, string> = {
                stripe: 'STRIPE_SECRET_KEY',
                paypal: 'PAYPAL_CLIENT_ID',
                mada_tap: 'TAP_SECRET_KEY',
                email: 'RESEND_API_KEY',
                sms: 'TWILIO_AUTH_TOKEN',
                whatsapp: 'WHATSAPP_ACCESS_TOKEN',
                storage: 'STORAGE_ACCESS_KEY_ID',
              };
              setSecretForm({
                ...secretForm,
                service_name: e.target.value,
                env_key: map[e.target.value] || 'CUSTOM_API_KEY',
              });
            }}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs"
          >
            <option value="stripe">Stripe</option>
            <option value="paypal">PayPal</option>
            <option value="mada_tap">Mada / Tap</option>
            <option value="email">Resend / SendGrid / SMTP</option>
            <option value="sms">Twilio SMS</option>
            <option value="whatsapp">WhatsApp Cloud</option>
            <option value="storage">S3 / R2 Storage</option>
          </select>

          <input
            required
            value={secretForm.env_key}
            onChange={(e) => setSecretForm({ ...secretForm, env_key: e.target.value.toUpperCase() })}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs font-mono-tabular"
          />

          <input
            type="password"
            required
            placeholder={locale === 'ar' ? 'أدخل المفتاح السري الجديد...' : 'Enter secret key value...'}
            value={secretForm.plaintext_value}
            onChange={(e) => setSecretForm({ ...secretForm, plaintext_value: e.target.value })}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-xs font-mono-tabular"
          />

          <button type="submit" className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white">
            {locale === 'ar' ? 'تشفير وحفظ' : 'Encrypt & Store'}
          </button>
        </form>
      </div>
    </div>
  );
};

export const AdminAuditAndLogsView: React.FC = () => (
  <div className="space-y-6">
    <AdvancedDataTable resource="audit_logs" />
    <AdvancedDataTable resource="notification_logs" />
  </div>
);
