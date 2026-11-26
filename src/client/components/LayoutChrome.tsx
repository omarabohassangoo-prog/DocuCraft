import React from 'react';
import { ShoppingBag, X, Plus, Minus, Trash2, Globe, Sun, Moon, Palette, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { t, pickI18n, formatMoney } from '../i18n/dictionary.ts';
import { ProductArtwork } from './ProductArtwork.tsx';

export const PublicHeader: React.FC = () => {
  const { route, navigate, locale, user, cart, setCartOpen } = useApp();
  const totalQty = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  const navLinks = [
    { path: '/store', label: t(locale, 'nav_store') },
    { path: '/stores', label: t(locale, 'nav_stores') },
    { path: '/pricing', label: t(locale, 'nav_pricing') },
    { path: '/blog', label: t(locale, 'nav_blog') },
    { path: '/about', label: t(locale, 'nav_about') },
  ];

  const getDashboardHome = () => {
    if (!user) return '/auth/login';
    const map: Record<string, string> = {
      super_admin: '/dashboard/admin',
      moderator: '/dashboard/moderator',
      staff: '/dashboard/staff',
      vendor: '/dashboard/vendor',
      customer: '/dashboard/customer',
    };
    return map[user.user_type] || '/dashboard/customer';
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-hairline)] bg-[var(--surface-card)]/95 backdrop-blur-md no-print">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 text-start focus:outline-none"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white font-bold text-base">
            أ
          </span>
          <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            {t(locale, 'brand_name')}
          </span>
        </button>

        {/* Zone 2: Primary Navigation (4-5 clean links) */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary Navigation">
          {navLinks.map((item) => {
            const active = route === item.path || (item.path !== '/' && route.startsWith(item.path + '/'));
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'text-[var(--brand-primary)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Cart Trigger + Single Primary Action */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={t(locale, 'nav_cart')}
            className="relative flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">{t(locale, 'nav_cart')}</span>
            {totalQty > 0 && (
              <span className="tabular-nums text-xs font-bold text-[var(--brand-primary)]">
                ({totalQty})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate(getDashboardHome())}
            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors whitespace-nowrap"
          >
            {user ? t(locale, 'nav_dashboard') : t(locale, 'nav_signin')}
          </button>
        </div>
      </div>

      {/* Mobile Compact Secondary Bar */}
      <div className="flex md:hidden items-center justify-around border-t border-[var(--border-hairline)] px-2 py-2 overflow-x-auto">
        {navLinks.map((item) => (
          <button
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
            className={`px-2 py-1 text-xs font-medium whitespace-nowrap ${
              route === item.path ? 'text-[var(--brand-primary)] font-semibold' : 'text-[var(--text-secondary)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
};

export const PublicFooter: React.FC = () => {
  const { navigate, locale, setLocale, theme, setTheme, bootstrap, tenantId, switchTenant } = useApp();
  const commercialReg = String(bootstrap?.settings?.['general.commercial_reg_no'] || 'CR-1010847291 · VAT-310948271000003');
  const tenants = bootstrap?.tenants || [];

  return (
    <footer className="border-t border-[var(--border-hairline)] bg-[var(--surface-card)] mt-20 no-print">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white font-bold text-sm">
                أ
              </span>
              <span className="font-bold text-[var(--text-primary)]">{t(locale, 'brand_name')}</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {locale === 'ar'
                ? 'منصة تجارة إلكترونية متعددة التجار مبنية بدقة معمارية مع تقسيم طلبات آلي وفواتير ضريبية فورية.'
                : 'Architectural multi-vendor marketplace with atomic stock locking, split checkout, and instant VAT invoicing.'}
            </p>
            <p className="font-mono-tabular text-xs text-[var(--text-secondary)]">{commercialReg}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
              {locale === 'ar' ? 'المنصة' : 'Platform'}
            </h3>
            <ul className="space-y-2 text-sm">
              <li><button type="button" onClick={() => navigate('/store')} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t(locale, 'nav_store')}</button></li>
              <li><button type="button" onClick={() => navigate('/stores')} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t(locale, 'nav_stores')}</button></li>
              <li><button type="button" onClick={() => navigate('/services')} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t(locale, 'nav_services')}</button></li>
              <li><button type="button" onClick={() => navigate('/pricing')} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t(locale, 'nav_pricing')}</button></li>
              <li><button type="button" onClick={() => navigate('/contact')} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t(locale, 'nav_contact')}</button></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
              {locale === 'ar' ? 'السياسات والامتثال' : 'Compliance & Legal'}
            </h3>
            <ul className="space-y-2 text-sm">
              <li><button type="button" onClick={() => navigate('/policies/privacy')} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t(locale, 'privacy_policy')}</button></li>
              <li><button type="button" onClick={() => navigate('/policies/terms')} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t(locale, 'terms_of_use')}</button></li>
              <li><button type="button" onClick={() => navigate('/policies/refund')} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t(locale, 'refund_policy')}</button></li>
              <li><a href="/api/v1/docs" target="_blank" rel="noreferrer" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">OpenAPI 3.1 Docs</a></li>
              <li><a href="/sitemap.xml" target="_blank" rel="noreferrer" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">XML Sitemap</a></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              {locale === 'ar' ? 'التفضيلات والمستأجر' : 'Locale, Theme & Tenant'}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
              >
                <Globe className="h-3.5 w-3.5" />
                {locale === 'ar' ? 'English' : 'العربية'}
              </button>

              <button
                type="button"
                onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'brand' : 'light')}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
              >
                {theme === 'dark' ? <Moon className="h-3.5 w-3.5" /> : theme === 'brand' ? <Palette className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                {theme === 'dark' ? (locale === 'ar' ? 'داكن' : 'Dark') : theme === 'brand' ? (locale === 'ar' ? 'هوية العلامة' : 'Brand') : (locale === 'ar' ? 'فاتح' : 'Light')}
              </button>
            </div>

            {tenants.length > 1 && (
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  {locale === 'ar' ? 'مساحة المستأجر (Tenant)' : 'Tenant Workspace'}
                </label>
                <select
                  value={tenantId}
                  onChange={(e) => switchTenant(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                >
                  {tenants.map((ten) => (
                    <option key={ten.id} value={ten.id}>
                      {ten.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-6 text-xs text-[var(--text-secondary)]">
          <span>© 2026 {t(locale, 'brand_name')} · Multi-Tenant Hyperscale Commerce</span>
          <span>PCI-DSS Tokenized Checkout · GDPR Compliant · TLS 1.3</span>
        </div>
      </div>
    </footer>
  );
};

export const CartDrawer: React.FC = () => {
  const { cart, cartOpen, setCartOpen, updateCartItem, removeCartItem, navigate, locale } = useApp();
  if (!cartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end no-print">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => setCartOpen(false)}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-[var(--surface-card)] border-s border-[var(--border-hairline)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[var(--brand-primary)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">{t(locale, 'shopping_cart')}</h2>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cart.items.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">{t(locale, 'cart_empty')}</p>
              <button
                type="button"
                onClick={() => {
                  setCartOpen(false);
                  navigate('/store');
                }}
                className="rounded-lg border border-[var(--border-hairline)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-muted)]"
              >
                {t(locale, 'explore_all')}
              </button>
            </div>
          ) : (
            cart.items.map((item) => (
              <div
                key={item.id}
                className="flex gap-3.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-canvas)] p-3"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)]">
                  <ProductArtwork theme={item.product.visual_theme} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-secondary)]">
                    {pickI18n(item.vendor?.store_name_i18n, locale)}
                  </p>
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {pickI18n(item.product.title_i18n, locale)}
                  </p>
                  <p className="font-mono-tabular text-xs text-[var(--text-secondary)] mt-0.5">
                    {item.variant.sku}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="tabular-nums text-sm font-bold text-[var(--text-primary)]">
                      {formatMoney(item.variant.price * item.quantity, item.product.currency, locale)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateCartItem(item.id, item.quantity - 1)}
                        className="rounded border border-[var(--border-hairline)] p-1 hover:bg-[var(--surface-muted)]"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="tabular-nums px-1.5 text-xs font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        disabled={item.quantity >= item.available_qty}
                        onClick={() => updateCartItem(item.id, item.quantity + 1)}
                        className="rounded border border-[var(--border-hairline)] p-1 hover:bg-[var(--surface-muted)] disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.id)}
                        className="ms-1 rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.items.length > 0 && (
          <div className="border-t border-[var(--border-hairline)] bg-[var(--surface-canvas)] p-5 space-y-3">
            <div className="space-y-1.5 text-sm">
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
              <div className="flex justify-between border-t border-[var(--border-hairline)] pt-2 text-base font-bold text-[var(--text-primary)]">
                <span>{t(locale, 'grand_total')}</span>
                <span className="tabular-nums">{formatMoney(cart.grand_total, 'SAR', locale)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setCartOpen(false);
                navigate('/checkout');
              }}
              className="w-full rounded-xl bg-[var(--brand-primary)] py-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors"
            >
              {t(locale, 'proceed_checkout')}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};

export const GdprConsentBar: React.FC = () => {
  const { gdprConsent, setGdprConsent, locale, navigate } = useApp();
  if (gdprConsent !== null) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-40 mx-auto max-w-4xl rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)]/95 p-4 shadow-lg backdrop-blur-md no-print">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)] leading-relaxed">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--brand-primary)] mt-0.5" />
          <p>
            {t(locale, 'gdpr_banner_text')}{' '}
            <button
              type="button"
              onClick={() => navigate('/policies/privacy')}
              className="underline font-medium text-[var(--text-primary)]"
            >
              {t(locale, 'privacy_policy')}
            </button>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setGdprConsent('essential')}
            className="rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
          >
            {t(locale, 'gdpr_essential_only')}
          </button>
          <button
            type="button"
            onClick={() => setGdprConsent('all')}
            className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            {t(locale, 'gdpr_accept_all')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AdSenseSlot: React.FC<{ placement: 'blog_sidebar' | 'catalog_top' | 'home_mid' | 'article_middle' }> = ({
  placement,
}) => {
  const { route, bootstrap, gdprConsent } = useApp();
  const isSuppressedRoute =
    route.startsWith('/checkout') || route.startsWith('/auth') || route.startsWith('/dashboard');
  const adsEnabled = bootstrap?.settings?.['feature_flags.enable_adsense'] === true;
  const unit = bootstrap?.adUnits?.find((a) => a.placement === placement && a.is_active);
  const validClient = Boolean(unit && /^ca-pub-\d{10,20}$/.test(unit.adsense_client_id));
  const shouldRender = !isSuppressedRoute && adsEnabled && gdprConsent === 'all' && validClient;

  React.useEffect(() => {
    if (!shouldRender || !unit) return;
    const scriptId = 'ufuq-adsense-script';
    if (!document.getElementById(scriptId)) {
      const s = document.createElement('script');
      s.id = scriptId;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(unit.adsense_client_id)}`;
      document.head.appendChild(s);
    }
    try {
      const win = window as Window & { adsbygoogle?: unknown[] };
      win.adsbygoogle = win.adsbygoogle || [];
      win.adsbygoogle.push({});
    } catch {
      // ignore adblock or duplicate push
    }
  }, [shouldRender, unit]);

  if (!shouldRender || !unit) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-2 no-print">
      <ins
        className="adsbygoogle block"
        data-ad-client={unit.adsense_client_id}
        data-ad-slot={unit.adsense_slot_id}
        data-ad-format={unit.ad_format}
        data-full-width-responsive="true"
      />
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useApp();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 end-4 z-50 flex flex-col gap-2 no-print">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg ${
            toast.tone === 'error'
              ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100'
              : toast.tone === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100'
                : 'border-[var(--border-hairline)] bg-[var(--surface-card)] text-[var(--text-primary)]'
          }`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
};
