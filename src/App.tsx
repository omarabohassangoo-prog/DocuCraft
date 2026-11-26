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
import { DashboardShell } from './client/pages/DashboardShell.tsx';

const RouterView: React.FC = () => {
  const { route } = useApp();

  if (route.startsWith('/dashboard')) {
    return <DashboardShell />;
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
