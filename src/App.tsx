import React from 'react';
import { AppProvider, useApp } from './client/context/AppContext.tsx';
import {
  CartDrawer,
  GdprConsentBar,
  PublicFooter,
  PublicHeader,
  ToastContainer,
} from './client/components/LayoutChrome.tsx';
import {
  BlogPage,
  CatalogPage,
  CmsGenericPage,
  ContactPage,
  HomePage,
  ProductDetailPage,
  VendorDirectoryPage,
} from './client/pages/PublicPages.tsx';
import { CheckoutPage, InvoiceView } from './client/pages/CheckoutPage.tsx';
import { AuthPages } from './client/pages/AuthPages.tsx';

const DashboardShell = React.lazy(() =>
  import('./client/pages/DashboardShell.tsx').then((module) => ({ default: module.DashboardShell }))
);

const RouterView: React.FC = () => {
  const { route, user, bootstrap, navigate, locale } = useApp();
  const maintenanceEnabled = bootstrap?.settings['feature_flags.maintenance_mode'] === true;

  if (maintenanceEnabled && user?.user_type !== 'super_admin' && !route.startsWith('/auth/')) {
    return (
      <main lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className="flex min-h-screen items-center justify-center bg-[var(--surface-canvas)] px-5 py-16">
        <section className="w-full max-w-xl rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-8 text-center shadow-sm sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-primary)]">Ufuq Commerce</p>
          <h1 className="mt-4 text-2xl font-bold text-[var(--text-primary)]">
            {locale === 'ar' ? 'المتجر تحت الصيانة' : 'We’ll be back soon'}
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
            {locale === 'ar'
              ? 'نعمل على تحسين المنصة. يرجى العودة بعد قليل.'
              : 'We’re improving the platform. Please check back shortly.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/auth/login')}
            className="mt-7 rounded-lg bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            {locale === 'ar' ? 'دخول المدير' : 'Admin sign in'}
          </button>
        </section>
      </main>
    );
  }

  if (route.startsWith('/dashboard')) {
    return (
      <React.Suspense
        fallback={(
          <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center text-sm text-[var(--text-secondary)]">
            {locale === 'ar' ? 'جارٍ تحميل لوحة التحكم...' : 'Loading dashboard...'}
          </div>
        )}
      >
        <DashboardShell />
      </React.Suspense>
    );
  }

  const renderPublicView = () => {
    if (route === '/' || route === '') return <HomePage />;
    if (route === '/store') return <CatalogPage />;
    if (route === '/stores') return <VendorDirectoryPage />;
    if (route.startsWith('/products/')) {
      const slug = route.replace('/products/', '').split('/')[0];
      return <ProductDetailPage slug={slug} />;
    }
    if (route === '/about') return <CmsGenericPage slug="about" />;
    if (route === '/services') return <CmsGenericPage slug="services" />;
    if (route === '/pricing') return <CmsGenericPage slug="pricing" />;
    if (route.startsWith('/policies/')) {
      const slug = route.replace('/policies/', '').split('/')[0];
      return <CmsGenericPage slug={slug} />;
    }
    if (route === '/blog') return <BlogPage />;
    if (route.startsWith('/blog/')) {
      const slug = route.replace('/blog/', '').split('/')[0];
      return <BlogPage slug={slug} />;
    }
    if (route === '/contact') return <ContactPage />;
    if (route === '/checkout') return <CheckoutPage />;
    if (route.startsWith('/orders/') && route.endsWith('/invoice')) {
      const parts = route.split('/');
      return <InvoiceView orderId={parts[2]} />;
    }
    if (route === '/auth/register') return <AuthPages mode="register" />;
    if (route === '/auth/forgot-password') return <AuthPages mode="forgot" />;
    if (route.startsWith('/auth/')) return <AuthPages mode="login" />;

    return <HomePage />;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">{renderPublicView()}</main>
      <PublicFooter />
      <CartDrawer />
      <GdprConsentBar />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <RouterView />
      <ToastContainer />
    </AppProvider>
  );
}
