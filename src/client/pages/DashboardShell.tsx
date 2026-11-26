import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Store,
  Package,
  ShoppingBag,
  FileEdit,
  Newspaper,
  Megaphone,
  ShieldCheck,
  Settings,
  Activity,
  UserCheck,
  CheckSquare,
  LifeBuoy,
  ClipboardList,
  Truck,
  Headphones,
  BarChart3,
  Boxes,
  ShoppingCart,
  Landmark,
  Sliders,
  User,
  PackageCheck,
  MapPin,
  Lock,
  Menu,
  X,
  LogOut,
  Globe,
  Sun,
  Moon,
  ExternalLink,
} from 'lucide-react';
import type { SidebarMenuRecord, UserRoleType } from '../../shared/types.ts';
import { apiRequest } from '../lib/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { pickI18n, t } from '../i18n/dictionary.ts';
import { AdvancedDataTable } from '../components/crud/AdvancedDataTable.tsx';
const AdminAuditAndLogsView = React.lazy(() =>
  import('./AdminViews.tsx').then((module) => ({ default: module.AdminAuditAndLogsView }))
);
const AdminCmsEditorView = React.lazy(() =>
  import('./AdminViews.tsx').then((module) => ({ default: module.AdminCmsEditorView }))
);
const AdminOverviewView = React.lazy(() =>
  import('./AdminViews.tsx').then((module) => ({ default: module.AdminOverviewView }))
);
const AdminSeoAdsView = React.lazy(() =>
  import('./AdminViews.tsx').then((module) => ({ default: module.AdminSeoAdsView }))
);
const AdminSettingsVaultView = React.lazy(() =>
  import('./AdminViews.tsx').then((module) => ({ default: module.AdminSettingsVaultView }))
);
const AdminUsersRbacView = React.lazy(() =>
  import('./AdminViews.tsx').then((module) => ({ default: module.AdminUsersRbacView }))
);
import {
  CustomerDashboardView,
  ModeratorDashboardView,
  StaffDashboardView,
  VendorDashboardView,
} from './RoleViews.tsx';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Store,
  Package,
  ShoppingBag,
  FileEdit,
  Newspaper,
  Megaphone,
  ShieldCheck,
  Settings,
  Activity,
  UserCheck,
  CheckSquare,
  LifeBuoy,
  ClipboardList,
  Truck,
  Headphones,
  BarChart3,
  Boxes,
  ShoppingCart,
  Landmark,
  Sliders,
  User,
  PackageCheck,
  MapPin,
  Lock,
};

export const DashboardShell: React.FC = () => {
  const {
    route,
    navigate,
    locale,
    setLocale,
    theme,
    setTheme,
    user,
    bootstrap,
    tenantId,
    switchTenant,
    logout,
    switchRolePreview,
    isRolePreview,
    notify,
    exitRolePreview,
  } = useApp();
  const [sidebarItems, setSidebarItems] = useState<SidebarMenuRecord[]>([]);
  const [sidebarLoadError, setSidebarLoadError] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scopeFromRole: Record<UserRoleType, 'admin' | 'moderator' | 'staff' | 'vendor' | 'customer'> = {
    super_admin: 'admin',
    moderator: 'moderator',
    staff: 'staff',
    vendor: 'vendor',
    customer: 'customer',
  };

  const expectedScope = user ? scopeFromRole[user.user_type] || 'customer' : 'customer';

  useEffect(() => {
    if (!user) return;
    setSidebarLoadError(false);
    apiRequest<{ items: SidebarMenuRecord[] }>(`/auth/sidebar?scope=${expectedScope}`)
      .then((res) => setSidebarItems(res.items || []))
      .catch(() => setSidebarLoadError(true));
  }, [user, expectedScope, tenantId]);

  useEffect(() => {
    if (!user) return;
    if (route === '/dashboard' || !route.startsWith(`/dashboard/${expectedScope}`)) {
      navigate(`/dashboard/${expectedScope}`);
    }
  }, [user, route, expectedScope, navigate]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center space-y-4">
        <p className="text-base text-[var(--text-secondary)]">
          {locale === 'ar' ? 'يرجى تسجيل الدخول للوصول إلى لوحة التحكم.' : 'Please sign in to access your dashboard.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/auth/login')}
          className="rounded-xl bg-[var(--brand-primary)] px-6 py-2.5 text-sm font-semibold text-white"
        >
          {t(locale, 'nav_signin')}
        </button>
      </div>
    );
  }

  // Group sidebar items by group_i18n
  const groups = new Map<string, SidebarMenuRecord[]>();
  for (const item of sidebarItems) {
    const grpLabel = pickI18n(item.group_i18n, locale);
    const list = groups.get(grpLabel) || [];
    list.push(item);
    groups.set(grpLabel, list);
  }

  const renderMainContent = () => {
    if (expectedScope === 'admin') {
      if (route === '/dashboard/admin/vendors') return <AdvancedDataTable resource="vendors" />;
      if (route === '/dashboard/admin/products') return <AdvancedDataTable resource="products" />;
      if (route === '/dashboard/admin/orders') return <AdvancedDataTable resource="vendor_suborders" />;
      if (route === '/dashboard/admin/cms') return <AdminCmsEditorView />;
      if (route === '/dashboard/admin/blog') {
        return (
          <div className="space-y-6">
            <AdvancedDataTable resource="blog_posts" />
            <AdvancedDataTable resource="contact_inquiries" />
          </div>
        );
      }
      if (route === '/dashboard/admin/seo-ads') return <AdminSeoAdsView />;
      if (route === '/dashboard/admin/users-roles') return <AdminUsersRbacView />;
      if (route === '/dashboard/admin/settings') return <AdminSettingsVaultView />;
      if (route === '/dashboard/admin/audit-logs') return <AdminAuditAndLogsView />;
      return <AdminOverviewView />;
    }

    if (expectedScope === 'moderator') return <ModeratorDashboardView subpath={route} />;
    if (expectedScope === 'staff') return <StaffDashboardView subpath={route} />;
    if (expectedScope === 'vendor') return <VendorDashboardView subpath={route} />;
    return <CustomerDashboardView subpath={route} />;
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[var(--surface-card)]">
      <div className="flex h-16 items-center justify-between border-b border-[var(--border-hairline)] px-5">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 font-bold text-[var(--text-primary)]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white text-sm">
            أ
          </span>
          <span className="text-sm">{t(locale, 'brand_name')}</span>
        </button>
        <button
          type="button"
          aria-label={locale === 'ar' ? 'إغلاق القائمة' : 'Close navigation menu'}
          className="lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {sidebarLoadError ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            <p>{locale === 'ar' ? 'تعذر تحميل قائمة الإدارة.' : 'Could not load the dashboard menu.'}</p>
            <button
              type="button"
              onClick={() => {
                setSidebarLoadError(false);
                apiRequest<{ items: SidebarMenuRecord[] }>(`/auth/sidebar?scope=${expectedScope}`)
                  .then((res) => setSidebarItems(res.items || []))
                  .catch(() => setSidebarLoadError(true));
              }}
              className="mt-2 underline underline-offset-2"
            >
              {locale === 'ar' ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        ) : Array.from(groups.entries()).map(([groupName, items]) => (
          <div key={groupName} className="space-y-1">
            <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              {groupName}
            </div>
            {items.map((item) => {
              const Icon = ICON_MAP[item.icon_name] || LayoutDashboard;
              const active = route === item.route_path;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    navigate(item.route_path);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[var(--brand-primary)] text-white'
                      : 'text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{pickI18n(item.label_i18n, locale)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--border-hairline)] p-4 space-y-2">
        <div className="text-xs font-semibold text-[var(--text-primary)] truncate">{user.full_name}</div>
        <div className="text-[11px] text-[var(--text-secondary)]">{t(locale, user.user_type)}</div>
        <button
          type="button"
          onClick={logout}
          className="mt-2 flex w-full items-center gap-2 rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <LogOut className="h-3.5 w-3.5" />
          {t(locale, 'sign_out')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[var(--surface-canvas)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-e border-[var(--border-hairline)] no-print">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden no-print">
          <button
            type="button"
            aria-label={locale === 'ar' ? 'إغلاق القائمة' : 'Close navigation menu'}
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-64 max-w-[80vw] h-full border-e border-[var(--border-hairline)]">
            {sidebarContent}
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Dashboard Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[var(--border-hairline)] bg-[var(--surface-card)]/95 px-4 sm:px-6 backdrop-blur-md no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden rounded-lg border border-[var(--border-hairline)] p-1.5"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-sm font-bold text-[var(--text-primary)]">
              {t(locale, user.user_type)}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {user.user_type === 'super_admin' && (bootstrap?.tenants.length || 0) > 1 && (
              <select
                value={tenantId}
                onChange={(event) => switchTenant(event.target.value)}
                aria-label={locale === 'ar' ? 'مساحة المستأجر الحالية' : 'Current tenant workspace'}
                className="max-w-40 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)]"
              >
                {bootstrap!.tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                ))}
              </select>
            )}

            {isRolePreview && (
              <button
                type="button"
                onClick={exitRolePreview}
                className="rounded-lg border border-[var(--border-hairline)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--surface-muted)]"
              >
                {locale === 'ar' ? 'إنهاء المعاينة' : 'Exit preview'}
              </button>
            )}

            {user.user_type === 'super_admin' && (
              <select
                value={user.user_type}
                aria-label={locale === 'ar' ? 'معاينة لوحة دور آخر' : 'Preview another role dashboard'}
                onChange={(event) => {
                  void switchRolePreview(event.target.value as UserRoleType).catch((err) => {
                    notify(err instanceof Error ? err.message : 'Could not start role preview', 'error');
                  });
                }}
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)]"
              >
                <option value="super_admin">{t(locale, 'super_admin')}</option>
                <option value="moderator">{t(locale, 'moderator')}</option>
                <option value="staff">{t(locale, 'staff')}</option>
                <option value="vendor">{t(locale, 'vendor')}</option>
                <option value="customer">{t(locale, 'customer')}</option>
              </select>
            )}

            <button
              type="button"
              onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
              className="rounded-lg border border-[var(--border-hairline)] p-2 text-xs hover:bg-[var(--surface-muted)]"
              title="Toggle Language"
            >
              <Globe className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-lg border border-[var(--border-hairline)] p-2 text-xs hover:bg-[var(--surface-muted)]"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => navigate('/store')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-muted)]"
            >
              <span>{t(locale, 'nav_store')}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <React.Fragment key={tenantId}>{renderMainContent()}</React.Fragment>
        </main>
      </div>
    </div>
  );
};
