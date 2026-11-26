import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  AdUnitRecord,
  CategoryRecord,
  Locale,
  ProductRecord,
  ProductVariantRecord,
  SafeUserDTO,
  TenantRecord,
  ThemeMode,
  UserRoleType,
} from '../../shared/types.ts';
import { apiRequest, setApiAccessToken, setApiTenantId } from '../lib/api.ts';

export interface CartHydratedItem {
  id: string;
  variant_id: string;
  quantity: number;
  unit_price_snapshot: number;
  available_qty: number;
  variant: ProductVariantRecord;
  product: ProductRecord;
  vendor: { id: string; store_slug: string; store_name_i18n: { ar: string; en: string } } | null;
}

export interface CartState {
  items: CartHydratedItem[];
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  grand_total: number;
}

export interface BootstrapData {
  tenant: TenantRecord;
  settings: Record<string, unknown>;
  categories: CategoryRecord[];
  adUnits: AdUnitRecord[];
  tenants: { id: string; slug: string; name: string }[];
}

export interface AuthStatusInfo {
  needsAdminBootstrap: boolean;
  adminEmail: string;
  registrationEnabled: boolean;
  tenants: { id: string; slug: string; name: string }[];
}

interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'error' | 'info';
}

interface AppContextValue {
  route: string;
  searchQuery: string;
  navigate: (path: string) => void;
  locale: Locale;
  setLocale: (loc: Locale) => void;
  theme: ThemeMode;
  setTheme: (th: ThemeMode) => void;
  tenantId: string;
  switchTenant: (id: string) => void;
  user: SafeUserDTO | null;
  setAuthSession: (token: string, user: SafeUserDTO) => void;
  logout: () => Promise<void>;
  switchRolePreview: (role: UserRoleType) => Promise<void>;
  authStatus: AuthStatusInfo | null;
  refreshAuthStatus: () => Promise<void>;
  bootstrap: BootstrapData | null;
  refreshBootstrap: () => Promise<void>;
  cart: CartState;
  refreshCart: () => Promise<void>;
  addToCart: (variantId: string, quantity?: number) => Promise<void>;
  updateCartItem: (itemId: string, quantity: number) => Promise<void>;
  removeCartItem: (itemId: string) => Promise<void>;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  gdprConsent: 'all' | 'essential' | null;
  setGdprConsent: (val: 'all' | 'essential') => void;
  toasts: ToastMessage[];
  notify: (text: string, tone?: 'success' | 'error' | 'info') => void;
}

const EMPTY_CART: CartState = {
  items: [],
  subtotal: 0,
  tax_amount: 0,
  shipping_amount: 0,
  grand_total: 0,
};

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [route, setRoute] = useState<string>(() => window.location.pathname || '/');
  const [searchQuery, setSearchQuery] = useState<string>(() => window.location.search || '');
  const [locale, setLocaleState] = useState<Locale>('ar');
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [tenantId, setTenantIdState] = useState<string>('11111111-1111-4111-8111-111111111111');
  const [user, setUser] = useState<SafeUserDTO | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatusInfo | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [cart, setCart] = useState<CartState>(EMPTY_CART);
  const [cartOpen, setCartOpen] = useState(false);
  const [gdprConsent, setGdprConsent] = useState<'all' | 'essential' | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, tone: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  const navigate = useCallback((path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const [pathname, query] = normalized.split('?');
    const nextSearch = query ? `?${query}` : '';
    if (normalized !== `${window.location.pathname}${window.location.search}`) {
      window.history.pushState({}, '', normalized);
    }
    setRoute(pathname || '/');
    setSearchQuery(nextSearch);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(window.location.pathname || '/');
      setSearchQuery(window.location.search || '');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Sync HTML lang/dir and Theme classes
  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('dark', 'theme-brand');
    const resolvedTheme =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme;
    if (resolvedTheme === 'dark') html.classList.add('dark');
    if (resolvedTheme === 'brand') html.classList.add('theme-brand');

    const primary = bootstrap?.settings?.['theme.brand_primary_color'];
    const accent = bootstrap?.settings?.['theme.brand_accent_color'];
    if (typeof primary === 'string' && resolvedTheme !== 'dark') {
      html.style.setProperty('--brand-primary', primary);
    } else if (resolvedTheme === 'dark') {
      html.style.removeProperty('--brand-primary');
    }
    if (typeof accent === 'string' && resolvedTheme !== 'dark') {
      html.style.setProperty('--brand-accent', accent);
    } else if (resolvedTheme === 'dark') {
      html.style.removeProperty('--brand-accent');
    }
  }, [theme, bootstrap]);

  const setLocale = useCallback(
    (loc: Locale) => {
      setLocaleState(loc);
      if (user) {
        apiRequest('/auth/preferences', {
          method: 'PATCH',
          body: JSON.stringify({ preferred_locale: loc }),
        }).catch(() => {});
      }
    },
    [user]
  );

  const setTheme = useCallback(
    (th: ThemeMode) => {
      setThemeState(th);
      if (user) {
        apiRequest('/auth/preferences', {
          method: 'PATCH',
          body: JSON.stringify({ preferred_theme: th }),
        }).catch(() => {});
      }
    },
    [user]
  );

  const refreshBootstrap = useCallback(async () => {
    try {
      const data = await apiRequest<BootstrapData>('/public/bootstrap');
      setBootstrap(data);
    } catch {
      // silent fallback
    }
  }, []);

  const refreshAuthStatus = useCallback(async () => {
    try {
      const data = await apiRequest<AuthStatusInfo>('/auth/status');
      setAuthStatus(data);
    } catch {
      // silent fallback
    }
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      const data = await apiRequest<CartState>('/cart');
      setCart({
        items: data.items || [],
        subtotal: data.subtotal || 0,
        tax_amount: data.tax_amount || 0,
        shipping_amount: data.shipping_amount || 0,
        grand_total: data.grand_total || 0,
      });
    } catch {
      // silent fallback
    }
  }, []);

  useEffect(() => {
    refreshBootstrap();
    refreshAuthStatus();
    refreshCart();
  }, [tenantId, refreshBootstrap, refreshAuthStatus, refreshCart]);

  const switchTenant = useCallback(
    (id: string) => {
      setApiTenantId(id);
      setTenantIdState(id);
      setApiAccessToken(null);
      setUser(null);
      notify(locale === 'ar' ? 'تم تبديل بيئة المستأجر بنجاح' : 'Switched tenant workspace', 'info');
    },
    [locale, notify]
  );

  const setAuthSession = useCallback(
    (token: string, nextUser: SafeUserDTO) => {
      setApiAccessToken(token);
      setUser(nextUser);
      refreshCart();
      refreshAuthStatus();
    },
    [refreshCart, refreshAuthStatus]
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setApiAccessToken(null);
    setUser(null);
    navigate('/');
    notify(locale === 'ar' ? 'تم تسجيل الخروج بأمان' : 'Signed out securely', 'info');
  }, [locale, navigate, notify]);

  const switchRolePreview = useCallback(
    async (role: UserRoleType) => {
      const data = await apiRequest<{ accessToken: string; user: SafeUserDTO }>('/auth/role-preview', {
        method: 'POST',
        body: JSON.stringify({ target_role: role }),
      });
      setApiAccessToken(data.accessToken);
      setUser(data.user);
      const scopeRouteMap: Record<UserRoleType, string> = {
        super_admin: '/dashboard/admin',
        moderator: '/dashboard/moderator',
        staff: '/dashboard/staff',
        vendor: '/dashboard/vendor',
        customer: '/dashboard/customer',
      };
      navigate(scopeRouteMap[role]);
    },
    [navigate]
  );

  const addToCart = useCallback(
    async (variantId: string, quantity = 1) => {
      const data = await apiRequest<CartState>('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ variant_id: variantId, quantity }),
      });
      setCart(data);
      setCartOpen(true);
      notify(locale === 'ar' ? 'تمت إضافة المنتج إلى السلة' : 'Added item to cart', 'success');
    },
    [locale, notify]
  );

  const updateCartItem = useCallback(async (itemId: string, quantity: number) => {
    const data = await apiRequest<CartState>(`/cart/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
    setCart(data);
  }, []);

  const removeCartItem = useCallback(async (itemId: string) => {
    const data = await apiRequest<CartState>(`/cart/items/${itemId}`, {
      method: 'DELETE',
    });
    setCart(data);
  }, []);

  return (
    <AppContext.Provider
      value={{
        route,
        searchQuery,
        navigate,
        locale,
        setLocale,
        theme,
        setTheme,
        tenantId,
        switchTenant,
        user,
        setAuthSession,
        logout,
        switchRolePreview,
        authStatus,
        refreshAuthStatus,
        bootstrap,
        refreshBootstrap,
        cart,
        refreshCart,
        addToCart,
        updateCartItem,
        removeCartItem,
        cartOpen,
        setCartOpen,
        gdprConsent,
        setGdprConsent,
        toasts,
        notify,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
