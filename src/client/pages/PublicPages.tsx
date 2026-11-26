import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  Star,
  Store as StoreIcon,
  Send,
  ShieldCheck,
} from 'lucide-react';
import type {
  BlogPostRecord,
  CmsPageRecord,
  CmsSectionRecord,
  ProductRecord,
  ProductVariantRecord,
  VendorRecord,
} from '../../shared/types.ts';
import { apiRequest } from '../lib/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { formatMoney, formatRelativeDate, pickI18n, t } from '../i18n/dictionary.ts';
import { HeroAtelierShowcase, ProductArtwork } from '../components/ProductArtwork.tsx';
import { AdSenseSlot } from '../components/LayoutChrome.tsx';

export interface CatalogProduct extends ProductRecord {
  vendor: { id: string; store_slug: string; store_name_i18n: { ar: string; en: string } } | null;
  category: { id: string; slug: string; name_i18n: { ar: string; en: string } } | null;
  variants: ProductVariantRecord[];
  available_stock: number;
}

const ProductCard: React.FC<{ product: CatalogProduct }> = ({ product }) => {
  const { locale, navigate, addToCart } = useApp();
  const primaryVariant = product.variants[0];
  const inStock = product.available_stock > 0 && primaryVariant;

  return (
    <article className="group flex flex-col rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] overflow-hidden transition-all hover:border-[var(--brand-primary)]/45 hover:shadow-sm">
      <button
        type="button"
        onClick={() => navigate(`/products/${product.slug}`)}
        className="block aspect-[4/3] w-full overflow-hidden bg-[var(--surface-muted)]/60 p-4 text-start"
      >
        {product.primary_image_id ? (
          <img
            src={`/api/v1/public/media/${product.primary_image_id}`}
            alt={pickI18n(product.title_i18n, locale)}
            loading="lazy"
            className="h-full w-full rounded-lg object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <ProductArtwork
            theme={product.visual_theme}
            className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
      </button>

      <div className="flex flex-1 flex-col p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
          <span>
            {pickI18n(product.vendor?.store_name_i18n, locale)} · {pickI18n(product.category?.name_i18n, locale)}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums font-medium text-[var(--text-primary)]">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            {product.rating_avg.toFixed(1)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/products/${product.slug}`)}
          className="text-start"
        >
          <h3 className="text-base font-bold text-[var(--text-primary)] leading-snug group-hover:text-[var(--brand-primary)] transition-colors">
            {pickI18n(product.title_i18n, locale)}
          </h3>
        </button>

        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
          {pickI18n(product.description_i18n, locale)}
        </p>

        <div className="mt-auto pt-3 flex items-center justify-between gap-3 border-t border-[var(--border-hairline)]">
          <div>
            <span className="tabular-nums text-base font-bold text-[var(--text-primary)]">
              {formatMoney(product.base_price, product.currency, locale)}
            </span>
          </div>

          <button
            type="button"
            disabled={!inStock}
            onClick={() => primaryVariant && addToCart(primaryVariant.id, 1)}
            className="rounded-lg bg-[var(--brand-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-45 transition-colors"
          >
            {inStock ? t(locale, 'add_to_cart') : t(locale, 'out_of_stock')}
          </button>
        </div>
      </div>
    </article>
  );
};

export const HomePage: React.FC = () => {
  const { locale, navigate } = useApp();
  const [sections, setSections] = useState<CmsSectionRecord[]>([]);
  const [featured, setFeatured] = useState<CatalogProduct[]>([]);
  const [stores, setStores] = useState<(VendorRecord & { product_count: number })[]>([]);

  useEffect(() => {
    apiRequest<{ page: CmsPageRecord; sections: CmsSectionRecord[] }>('/public/pages/home')
      .then((res) => setSections(res.sections || []))
      .catch(() => {});
    apiRequest<{ products: CatalogProduct[] }>('/public/catalog?featured=true')
      .then((res) => setFeatured((res.products || []).slice(0, 6)))
      .catch(() => {});
    apiRequest<{ stores: (VendorRecord & { product_count: number })[] }>('/public/stores')
      .then((res) => setStores((res.stores || []).slice(0, 4)))
      .catch(() => {});
  }, []);

  const heroSection = sections.find((s) => s.section_type === 'hero_banner');
  const storySection = sections.find((s) => s.section_type === 'features_grid');
  const heroCopy = (heroSection?.content_i18n?.[locale] || {}) as Record<string, string>;
  const storyCopy = (storySection?.content_i18n?.[locale] || {}) as {
    title?: string;
    items?: { title: string; body: string }[];
  };

  const ArrowIcon = locale === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-20">
      {/* Editorial Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6 space-y-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand-accent)]">
              {heroCopy.kicker || (locale === 'ar' ? 'سوق منتقى للعلامات المستقلة' : 'Curated Independent Market')}
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)] leading-[1.15]">
              {heroCopy.headline ||
                (locale === 'ar'
                  ? 'حِرَفية استثنائية من متاجر مستقلة في سلة واحدة'
                  : 'Exceptional craft from independent studios in one unified cart')}
            </h1>
            <p className="text-base text-[var(--text-secondary)] leading-relaxed max-w-xl">
              {heroCopy.subtitle ||
                (locale === 'ar'
                  ? 'تسوّق من نخبة التجار المعتمدين مع دفع موحد وفاتورة ضريبية فورية.'
                  : 'Discover verified ateliers with split-vendor checkout and instant VAT invoicing.')}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate(heroCopy.cta_href || '/store')}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] transition-colors"
              >
                <span>{heroCopy.cta_label || t(locale, 'explore_all')}</span>
                <ArrowIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate(heroCopy.secondary_href || '/stores')}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                {heroCopy.secondary_label || t(locale, 'nav_stores')}
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <HeroAtelierShowcase className="w-full h-auto text-[var(--text-primary)]" />
          </div>
        </div>
      </section>

      {/* Featured Catalog Grid */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-end justify-between border-b border-[var(--border-hairline)] pb-4">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t(locale, 'featured_products')}</h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/store')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-primary)] hover:underline"
          >
            <span>{t(locale, 'explore_all')}</span>
            <ArrowIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((prod) => (
            <ProductCard key={prod.id} product={prod} />
          ))}
        </div>
      </section>

      {/* Architecture Features Grid from CMS */}
      {storyCopy.items && storyCopy.items.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-8 sm:p-10 space-y-8">
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{storyCopy.title}</h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {storyCopy.items.map((item, idx) => (
                <div key={idx} className="space-y-2 border-t border-[var(--border-hairline)] pt-4">
                  <span className="font-mono-tabular text-xs font-semibold text-[var(--brand-accent)]">
                    0{idx + 1}
                  </span>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">{item.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Verified Vendors Directory Preview */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t(locale, 'verified_studios')}</h2>
          <button
            type="button"
            onClick={() => navigate('/stores')}
            className="text-sm font-semibold text-[var(--brand-primary)] hover:underline"
          >
            {t(locale, 'nav_stores')}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stores.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => navigate(`/store?vendor=${st.store_slug}`)}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-5 text-start hover:border-[var(--brand-primary)]/50 transition-colors space-y-2"
            >
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <StoreIcon className="h-4 w-4 text-[var(--brand-primary)]" />
                <span className="tabular-nums">
                  {st.product_count} {t(locale, 'products_count')}
                </span>
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">{pickI18n(st.store_name_i18n, locale)}</h3>
              <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                {pickI18n(st.tagline_i18n, locale)}
              </p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export const CatalogPage: React.FC = () => {
  const { locale, bootstrap, searchQuery } = useApp();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [stores, setStores] = useState<VendorRecord[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [vendor, setVendor] = useState(() => {
    const params = new URLSearchParams(searchQuery);
    return params.get('vendor') || 'all';
  });
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(searchQuery);
    const qVendor = params.get('vendor');
    if (qVendor) setVendor(qVendor);
  }, [searchQuery]);

  useEffect(() => {
    apiRequest<{ stores: VendorRecord[] }>('/public/stores')
      .then((res) => setStores(res.stores || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ search, category, vendor, sort });
    apiRequest<{ products: CatalogProduct[] }>(`/public/catalog?${qs.toString()}`)
      .then((res) => setProducts(res.products || []))
      .finally(() => setLoading(false));
  }, [search, category, vendor, sort]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--border-hairline)] pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">{t(locale, 'nav_store')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {products.length} {t(locale, 'products_count')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3 h-4 w-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(locale, 'search_placeholder')}
              className="w-60 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] ps-9 pe-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="all">{t(locale, 'all_categories')}</option>
            {(bootstrap?.categories || []).map((c) => (
              <option key={c.id} value={c.slug}>
                {pickI18n(c.name_i18n, locale)}
              </option>
            ))}
          </select>

          <select
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="all">{t(locale, 'all_vendors')}</option>
            {stores.map((v) => (
              <option key={v.id} value={v.store_slug}>
                {pickI18n(v.store_name_i18n, locale)}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="newest">{t(locale, 'sort_newest')}</option>
            <option value="price_asc">{t(locale, 'sort_price_asc')}</option>
            <option value="price_desc">{t(locale, 'sort_price_desc')}</option>
            <option value="rating">{t(locale, 'sort_rating')}</option>
          </select>
        </div>
      </div>

      <AdSenseSlot placement="catalog_top" />

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-80 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-muted)] animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-12 text-center text-sm text-[var(--text-secondary)]">
          {t(locale, 'no_products_found')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((prod) => (
            <ProductCard key={prod.id} product={prod} />
          ))}
        </div>
      )}
    </div>
  );
};

export const ProductDetailPage: React.FC<{ slug: string }> = ({ slug }) => {
  const { locale, navigate, addToCart } = useApp();
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ product: CatalogProduct }>(`/public/products/${slug}`)
      .then((res) => {
        setProduct(res.product);
        if (res.product.variants?.length) {
          setSelectedVariantId(res.product.variants[0].id);
        }
      })
      .catch((err) => setError(err.message));
  }, [slug]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center space-y-4">
        <p className="text-base text-[var(--text-secondary)]">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/store')}
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white"
        >
          {t(locale, 'explore_all')}
        </button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="h-96 rounded-2xl bg-[var(--surface-muted)] animate-pulse" />
      </div>
    );
  }

  const activeVariant =
    product.variants.find((v) => v.id === selectedVariantId) || product.variants[0];
  const available = activeVariant ? Math.max(0, activeVariant.stock_qty - activeVariant.reserved_qty) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <div className="sticky top-24 aspect-[4/3] rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-8 overflow-hidden">
            {product.primary_image_id ? (
              <img
                src={`/api/v1/public/media/${product.primary_image_id}`}
                alt={pickI18n(product.title_i18n, locale)}
                className="h-full w-full rounded-xl object-cover"
              />
            ) : (
              <ProductArtwork theme={product.visual_theme} />
            )}
          </div>
        </div>

        <div className="lg:col-span-6 space-y-6">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <button
              type="button"
              onClick={() => navigate(`/store?vendor=${product.vendor?.store_slug || ''}`)}
              className="font-semibold text-[var(--brand-primary)] hover:underline"
            >
              {pickI18n(product.vendor?.store_name_i18n, locale)}
            </button>
            <span>·</span>
            <span>{pickI18n(product.category?.name_i18n, locale)}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-[var(--text-primary)] font-medium tabular-nums">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              {product.rating_avg.toFixed(1)} ({product.review_count})
            </span>
          </div>

          <h1 className="text-3xl font-bold text-[var(--text-primary)] leading-tight">
            {pickI18n(product.title_i18n, locale)}
          </h1>

          <div className="flex items-baseline gap-3">
            <span className="tabular-nums text-3xl font-bold text-[var(--text-primary)]">
              {formatMoney(activeVariant?.price ?? product.base_price, product.currency, locale)}
            </span>
            {activeVariant?.compare_at_price && (
              <span className="tabular-nums text-base text-[var(--text-secondary)] line-through">
                {formatMoney(activeVariant.compare_at_price, product.currency, locale)}
              </span>
            )}
          </div>

          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {pickI18n(product.description_i18n, locale)}
          </p>

          {/* Variant Selector */}
          {product.variants.length > 0 && (
            <div className="space-y-2.5 border-t border-[var(--border-hairline)] pt-5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--text-primary)]">{t(locale, 'select_variant')}</span>
                <span className="font-mono-tabular text-[var(--text-secondary)]">
                  {t(locale, 'sku_label')}: {activeVariant?.sku}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {product.variants.map((v) => {
                  const selected = v.id === activeVariant?.id;
                  const attrSummary = Object.values(v.attributes).join(' · ');
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`rounded-xl border p-3 text-start transition-colors ${
                        selected
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                          : 'border-[var(--border-hairline)] bg-[var(--surface-card)] hover:bg-[var(--surface-muted)]'
                      }`}
                    >
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{attrSummary}</div>
                      <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-secondary)] tabular-nums">
                        <span>{formatMoney(v.price, product.currency, locale)}</span>
                        <span>{Math.max(0, v.stock_qty - v.reserved_qty)} {t(locale, 'units_available')}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add to Cart Bar */}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="number"
              min={1}
              max={Math.max(1, available)}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(available || 1, Number(e.target.value))))}
              className="w-20 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] px-3 py-3 text-center text-sm font-semibold tabular-nums"
            />
            <button
              type="button"
              disabled={!activeVariant || available <= 0}
              onClick={() => activeVariant && addToCart(activeVariant.id, qty)}
              className="flex-1 rounded-xl bg-[var(--brand-primary)] py-3.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-45 transition-colors"
            >
              {available > 0 ? t(locale, 'add_to_cart') : t(locale, 'out_of_stock')}
            </button>
          </div>

          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-muted)]/50 p-4 space-y-2 text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
              <ShieldCheck className="h-4 w-4 text-[var(--brand-primary)]" />
              <span>{available > 0 ? `${t(locale, 'in_stock')} (${available})` : t(locale, 'out_of_stock')}</span>
            </div>
            <p>{t(locale, 'vat_included_note')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const VendorDirectoryPage: React.FC = () => {
  const { locale, navigate } = useApp();
  const [stores, setStores] = useState<(VendorRecord & { product_count: number })[]>([]);

  useEffect(() => {
    apiRequest<{ stores: (VendorRecord & { product_count: number })[] }>('/public/stores')
      .then((res) => setStores(res.stores || []))
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      <div className="border-b border-[var(--border-hairline)] pb-6">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">{t(locale, 'verified_studios')}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          {locale === 'ar'
            ? 'جميع المتاجر المستقلة تخضع للتحقق التجاري (KYC) وتدير مخزونها وشحناتها باستقلالية تامة.'
            : 'All independent studios undergo commercial KYC verification and fulfill orders directly from their workshops.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {stores.map((st) => (
          <div
            key={st.id}
            className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span>{t(locale, st.kyc_status)}</span>
                  <span>·</span>
                  <span className="font-mono-tabular">{st.commercial_reg_no || 'KYC Pending'}</span>
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mt-1">
                  {pickI18n(st.store_name_i18n, locale)}
                </h2>
              </div>
              <span className="tabular-nums text-xs font-semibold text-[var(--brand-primary)]">
                {st.product_count} {t(locale, 'products_count')}
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{pickI18n(st.tagline_i18n, locale)}</p>
            <button
              type="button"
              onClick={() => navigate(`/store?vendor=${st.store_slug}`)}
              className="rounded-lg border border-[var(--border-hairline)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            >
              {t(locale, 'view_store_products')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const CmsGenericPage: React.FC<{ slug: string }> = ({ slug }) => {
  const { locale, navigate } = useApp();
  const [page, setPage] = useState<CmsPageRecord | null>(null);
  const [sections, setSections] = useState<CmsSectionRecord[]>([]);

  useEffect(() => {
    apiRequest<{ page: CmsPageRecord; sections: CmsSectionRecord[] }>(`/public/pages/${slug}`)
      .then((res) => {
        setPage(res.page);
        setSections(res.sections || []);
      })
      .catch(() => {});
  }, [slug]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
      <div className="border-b border-[var(--border-hairline)] pb-6">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">
          {pickI18n(page?.title_i18n, locale) || slug}
        </h1>
      </div>

      {sections.map((sec) => {
        const content = (sec.content_i18n?.[locale] || {}) as Record<string, unknown>;
        if (sec.section_type === 'pricing_table') {
          const tiers = (content.tiers || []) as {
            code: string;
            audience: string;
            name: string;
            price: string;
            commission: string;
            limits: string[];
          }[];
          return (
            <div key={sec.id} className="space-y-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{String(content.title || '')}</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {tiers.map((tier) => (
                  <div
                    key={tier.code}
                    className={`flex flex-col rounded-xl border p-6 space-y-5 ${
                      tier.code === 'pro'
                        ? 'border-[var(--brand-primary)] bg-[var(--surface-card)] shadow-md'
                        : 'border-[var(--border-hairline)] bg-[var(--surface-card)]'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-medium text-[var(--brand-accent)]">{tier.audience}</p>
                      <h3 className="text-xl font-bold text-[var(--text-primary)] mt-1">{tier.name}</h3>
                      <p className="mt-3 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                        {tier.price}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">{tier.commission}</p>
                    </div>
                    <ul className="flex-1 space-y-2.5 text-sm text-[var(--text-secondary)]">
                      {tier.limits.map((lim, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-4 w-4 shrink-0 text-[var(--brand-primary)] mt-0.5" />
                          <span>{lim}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => navigate('/auth/register')}
                      className="w-full rounded-lg bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
                    >
                      {t(locale, 'create_account')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (sec.section_type === 'features_grid') {
          const items = (content.items || []) as { title: string; body: string }[];
          return (
            <div key={sec.id} className="space-y-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">{String(content.title || '')}</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {items.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-2">
                    <h3 className="text-base font-bold text-[var(--text-primary)]">{item.title}</h3>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        const metrics = (content.metrics || []) as { value: string; label: string }[];
        return (
          <div key={sec.id} className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-8 space-y-6">
            {typeof content.headline === 'string' && content.headline.length > 0 && (
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">{content.headline}</h2>
            )}
            {typeof content.body === 'string' && content.body.length > 0 && (
              <p className="text-base text-[var(--text-secondary)] leading-relaxed">{content.body}</p>
            )}
            {metrics.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-[var(--border-hairline)] pt-6">
                {metrics.map((m, i) => (
                  <div key={i}>
                    <div className="text-2xl font-bold tabular-nums text-[var(--brand-primary)]">{m.value}</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">{m.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const BlogPage: React.FC<{ slug?: string }> = ({ slug }) => {
  const { locale, navigate } = useApp();
  const [posts, setPosts] = useState<(BlogPostRecord & { author_name?: string })[]>([]);
  const [singlePost, setSinglePost] = useState<(BlogPostRecord & { author_name?: string }) | null>(null);

  useEffect(() => {
    if (slug) {
      apiRequest<{ post: BlogPostRecord & { author_name?: string } }>(`/public/blog/${slug}`)
        .then((res) => setSinglePost(res.post))
        .catch(() => {});
    } else {
      apiRequest<{ posts: (BlogPostRecord & { author_name?: string })[] }>('/public/blog')
        .then((res) => setPosts(res.posts || []))
        .catch(() => {});
    }
  }, [slug]);

  if (slug && singlePost) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <article className="lg:col-span-8 space-y-6">
          <button
            type="button"
            onClick={() => navigate('/blog')}
            className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
          >
            ← {t(locale, 'nav_blog')}
          </button>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] leading-tight">
            {pickI18n(singlePost.title_i18n, locale)}
          </h1>
          <div className="text-xs text-[var(--text-secondary)]">
            {singlePost.author_name} · {singlePost.published_at ? formatRelativeDate(singlePost.published_at, locale) : ''}
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-8 text-base text-[var(--text-primary)] leading-loose">
            {pickI18n(singlePost.body_i18n, locale)}
          </div>
        </article>
        <aside className="lg:col-span-4 space-y-6">
          <AdSenseSlot placement="blog_sidebar" />
        </aside>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div className="lg:col-span-8 space-y-6">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] border-b border-[var(--border-hairline)] pb-4">
          {t(locale, 'nav_blog')}
        </h1>
        <div className="space-y-5">
          {posts.map((post) => (
            <article
              key={post.id}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-3"
            >
              <div className="text-xs text-[var(--text-secondary)]">
                {post.author_name} · {post.published_at ? formatRelativeDate(post.published_at, locale) : ''}
              </div>
              <button
                type="button"
                onClick={() => navigate(`/blog/${post.slug}`)}
                className="text-start"
              >
                <h2 className="text-xl font-bold text-[var(--text-primary)] hover:text-[var(--brand-primary)]">
                  {pickI18n(post.title_i18n, locale)}
                </h2>
              </button>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {pickI18n(post.excerpt_i18n, locale)}
              </p>
            </article>
          ))}
        </div>
      </div>
      <aside className="lg:col-span-4 space-y-6">
        <AdSenseSlot placement="blog_sidebar" />
      </aside>
    </div>
  );
};

export const ContactPage: React.FC = () => {
  const { locale, notify } = useApp();
  const [form, setForm] = useState({
    sender_name: '',
    sender_email: '',
    sender_phone: '',
    subject: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [sentDone, setSentDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await apiRequest('/public/contact', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSentDone(true);
      notify(locale === 'ar' ? 'تم استلام رسالتك بنجاح' : 'Inquiry submitted successfully', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
      <div className="border-b border-[var(--border-hairline)] pb-6">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">{t(locale, 'nav_contact')}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2">
          {locale === 'ar'
            ? 'تواصل مع فريق الدعم الفني أو قسم اعتماد التجار.'
            : 'Reach our support team or merchant onboarding desk.'}
        </p>
      </div>

      {sentDone ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          {locale === 'ar'
            ? 'شكراً لتواصلك! تم تسجيل تذكرتك وسيتم الرد عليك عبر البريد الإلكتروني.'
            : 'Thank you! Your inquiry has been logged for our support team.'}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                {t(locale, 'full_name')}
              </label>
              <input
                required
                value={form.sender_name}
                onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                {t(locale, 'email')}
              </label>
              <input
                type="email"
                required
                value={form.sender_email}
                onChange={(e) => setForm({ ...form, sender_email: e.target.value })}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                {t(locale, 'phone')}
              </label>
              <input
                value={form.sender_phone}
                onChange={(e) => setForm({ ...form, sender_phone: e.target.value })}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                {t(locale, 'subject')}
              </label>
              <input
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              {locale === 'ar' ? 'الرسالة' : 'Message'}
            </label>
            <textarea
              required
              rows={5}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {locale === 'ar' ? 'إرسال الرسالة' : 'Submit Inquiry'}
          </button>
        </form>
      )}
    </div>
  );
};
