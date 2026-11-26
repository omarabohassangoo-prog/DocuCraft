import type { I18nText, Locale } from '../../shared/types.ts';

export const DICTIONARY: Record<string, { ar: string; en: string }> = {
  // Brand & Top Navigation
  brand_name: { ar: 'أفق للتجارة', en: 'Ufuq Commerce' },
  nav_home: { ar: 'الرئيسية', en: 'Home' },
  nav_store: { ar: 'المتجر', en: 'Store' },
  nav_stores: { ar: 'المتاجر', en: 'Vendors' },
  nav_pricing: { ar: 'الباقات', en: 'Pricing' },
  nav_blog: { ar: 'المدونة', en: 'Blog' },
  nav_about: { ar: 'من نحن', en: 'About' },
  nav_services: { ar: 'الخدمات', en: 'Services' },
  nav_contact: { ar: 'تواصل معنا', en: 'Contact' },
  nav_dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' },
  nav_signin: { ar: 'تسجيل الدخول', en: 'Sign In' },
  nav_cart: { ar: 'السلة', en: 'Cart' },

  // Storefront & PDP
  search_placeholder: { ar: 'ابحث عن منتج، علامة تجارية، أو مواصفات...', en: 'Search products, studios, or specs...' },
  all_categories: { ar: 'كل التصنيفات', en: 'All Categories' },
  all_vendors: { ar: 'كل المتاجر', en: 'All Vendors' },
  sort_newest: { ar: 'الأحدث', en: 'Newest' },
  sort_price_asc: { ar: 'السعر: من الأقل للأعلى', en: 'Price: Low to High' },
  sort_price_desc: { ar: 'السعر: من الأعلى للأقل', en: 'Price: High to Low' },
  sort_rating: { ar: 'الأعلى تقييماً', en: 'Highest Rated' },
  featured_products: { ar: 'المجموعة المختارة', en: 'Curated Featured Releases' },
  explore_all: { ar: 'تصفح كل المنتجات', en: 'View Full Catalog' },
  verified_studios: { ar: 'متاجر مستقلة معتمدة', en: 'Verified Independent Studios' },
  add_to_cart: { ar: 'أضف إلى السلة', en: 'Add to Cart' },
  added_to_cart: { ar: 'تمت الإضافة إلى السلة', en: 'Added to cart' },
  out_of_stock: { ar: 'نفد المخزون', en: 'Out of Stock' },
  in_stock: { ar: 'متوفر في المخزون', en: 'In Stock' },
  units_available: { ar: 'قطعة متاحة', en: 'units available' },
  select_variant: { ar: 'اختر المواصفات', en: 'Select Edition / Variant' },
  sku_label: { ar: 'رمز SKU', en: 'SKU' },
  vat_included_note: { ar: 'تُطبق ضريبة القيمة المضافة 15% عند إتمام الطلب', en: '15% VAT calculated at checkout with instant tax invoice' },
  products_count: { ar: 'منتج نشط', en: 'active products' },
  view_store_products: { ar: 'عرض منتجات المتجر', en: 'Browse Store Catalog' },
  no_products_found: { ar: 'لم يتم العثور على منتجات مطابقة.', en: 'No matching products found.' },

  // Cart & Checkout
  shopping_cart: { ar: 'سلة التسوق', en: 'Shopping Cart' },
  cart_empty: { ar: 'سلتك فارغة حالياً.', en: 'Your shopping cart is currently empty.' },
  subtotal: { ar: 'المجموع الفرعي', en: 'Subtotal' },
  vat_15: { ar: 'ضريبة القيمة المضافة (15%)', en: 'VAT (15%)' },
  shipping_flat: { ar: 'الشحن الموحد', en: 'Unified Shipping' },
  grand_total: { ar: 'الإجمالي النهائي', en: 'Grand Total' },
  proceed_checkout: { ar: 'إتمام الطلب والدفع', en: 'Proceed to Checkout' },
  checkout_title: { ar: 'إتمام الطلب متعدد التجار', en: 'Unified Multi-Vendor Checkout' },
  shipping_details: { ar: 'عنوان التوصيل', en: 'Shipping Destination' },
  full_name: { ar: 'الاسم الكامل', en: 'Full Name' },
  phone: { ar: 'رقم الجوال', en: 'Phone Number' },
  city: { ar: 'المدينة', en: 'City' },
  street: { ar: 'الحي والشارع', en: 'District & Street' },
  postal_code: { ar: 'الرمز البريدي', en: 'Postal Code' },
  payment_gateway: { ar: 'بوابة الدفع المشفرة (PCI-DSS)', en: 'Tokenized Payment Gateway (PCI-DSS)' },
  gateway_mada: { ar: 'مدى / البطاقات الائتمانية (Tap)', en: 'Mada / Cards via Tap Payments' },
  gateway_stripe: { ar: 'البطاقات الدولية (Stripe)', en: 'International Cards via Stripe' },
  gateway_paypal: { ar: 'محفظة PayPal السريعة', en: 'PayPal Express Wallet' },
  place_order_pay: { ar: 'تأكيد الطلب وإتمام الدفع', en: 'Authorize & Complete Payment' },
  order_confirmed: { ar: 'تم تأكيد الطلب وإصدار الفاتورة الضريبية', en: 'Order Confirmed & Tax Invoice Issued' },
  print_invoice: { ar: 'طباعة الفاتورة الضريبية', en: 'Print VAT Tax Invoice' },
  vendor_split_summary: { ar: 'ملخص تقسيم الشحنات حسب التاجر', en: 'Vendor Sub-Order Split Summary' },

  // Auth & Security
  welcome_back: { ar: 'تسجيل الدخول إلى أفق', en: 'Sign in to Ufuq Commerce' },
  bootstrap_admin_title: { ar: 'تهيئة حساب المدير العام لأول مرة', en: 'First-Run Super Admin Setup' },
  bootstrap_admin_desc: {
    ar: 'قم بتعيين كلمة مرور قوية لتفعيل مساحة عمل المدير العام والوصول إلى كافة الأدوار ولوحات التحكم.',
    en: 'Set a strong passphrase to claim the Super Admin workspace and unlock platform management.',
  },
  claim_admin_btn: { ar: 'تفعيل لوحة المدير العام', en: 'Initialize Super Admin Workspace' },
  create_account: { ar: 'إنشاء حساب جديد', en: 'Create New Account' },
  forgot_password: { ar: 'نسيت كلمة المرور؟', en: 'Forgot Password?' },
  email: { ar: 'البريد الإلكتروني', en: 'Email Address' },
  password: { ar: 'كلمة المرور', en: 'Password' },
  account_type: { ar: 'نوع الحساب', en: 'Account Type' },
  account_customer: { ar: 'حساب متسوق (عميل)', en: 'Buyer Account (Customer)' },
  account_vendor: { ar: 'حساب متجر (تاجر)', en: 'Merchant Account (Vendor)' },
  store_name: { ar: 'اسم المتجر', en: 'Store Name' },
  verify_2fa_title: { ar: 'التحقق الثنائي (TOTP 2FA)', en: 'Two-Factor Verification (TOTP)' },
  verify_code: { ar: 'تأكيد الرمز', en: 'Verify Code' },
  send_reset_link: { ar: 'إرسال رمز الاستعادة', en: 'Send Recovery Code' },

  // CRUD & Table Keys
  product_title: { ar: 'المنتج', en: 'Product' },
  vendor: { ar: 'التاجر', en: 'Vendor' },
  price: { ar: 'السعر', en: 'Price' },
  stock_qty: { ar: 'المخزون', en: 'Stock' },
  status: { ar: 'الحالة', en: 'Status' },
  is_featured: { ar: 'مميز', en: 'Featured' },
  commercial_reg: { ar: 'السجل التجاري', en: 'Commercial Reg' },
  commission_rate: { ar: 'العمولة %', en: 'Commission %' },
  kyc_status: { ar: 'حالة التوثيق (KYC)', en: 'KYC Status' },
  is_active: { ar: 'نشط', en: 'Active' },
  order_number: { ar: 'رقم الطلب', en: 'Order #' },
  gross_amount: { ar: 'الإجمالي', en: 'Gross' },
  vendor_net: { ar: 'صافي التاجر', en: 'Vendor Net' },
  tracking_number: { ar: 'رقم التتبع', en: 'Tracking #' },
  fulfillment_status: { ar: 'حالة الشحن', en: 'Fulfillment' },
  action: { ar: 'الإجراء', en: 'Action' },
  entity: { ar: 'الكيان', en: 'Entity' },
  actor: { ar: 'المنفّذ', en: 'Actor' },
  ip_address: { ar: 'عنوان IP', en: 'IP Address' },
  created_at: { ar: 'التاريخ', en: 'Created' },
  role: { ar: 'الدور', en: 'Role' },
  title: { ar: 'العنوان', en: 'Title' },
  sender: { ar: 'المرسل', en: 'Sender' },
  subject: { ar: 'الموضوع', en: 'Subject' },
  channel: { ar: 'القناة', en: 'Channel' },
  provider: { ar: 'المزوّد', en: 'Provider' },
  recipient: { ar: 'المستلم', en: 'Recipient' },

  // Badges
  active: { ar: 'نشط', en: 'Active' },
  draft: { ar: 'مسودة', en: 'Draft' },
  archived: { ar: 'مؤرشف', en: 'Archived' },
  verified: { ar: 'موثّق', en: 'Verified' },
  pending: { ar: 'قيد المراجعة', en: 'Pending' },
  rejected: { ar: 'مرفوض', en: 'Rejected' },
  delivered: { ar: 'تم التوصيل', en: 'Delivered' },
  shipped: { ar: 'تم الشحن', en: 'Shipped' },
  packed: { ar: 'تم التجهيز', en: 'Packed' },
  returned: { ar: 'مرتجع', en: 'Returned' },
  locked: { ar: 'مقفل', en: 'Locked' },
  banned: { ar: 'محظور', en: 'Banned' },
  published: { ar: 'منشور', en: 'Published' },
  resolved: { ar: 'تم الحل', en: 'Resolved' },
  in_progress: { ar: 'قيد المعالجة', en: 'In Progress' },
  new: { ar: 'جديد', en: 'New' },
  sent: { ar: 'مرسل', en: 'Sent' },
  queued: { ar: 'في الطابور', en: 'Queued' },
  failed: { ar: 'فشل', en: 'Failed' },
  login: { ar: 'دخول ناجح', en: 'Login' },
  login_failed: { ar: 'فشل دخول', en: 'Failed Login' },
  payment: { ar: 'دفعة مالية', en: 'Payment' },
  super_admin: { ar: 'مدير عام', en: 'Super Admin' },
  moderator: { ar: 'مشرف', en: 'Moderator' },
  staff: { ar: 'موظف', en: 'Staff' },
  customer: { ar: 'عميل', en: 'Customer' },

  // Table Controls
  rows_per_page: { ar: 'صفوف', en: 'Rows' },
  columns: { ar: 'الأعمدة', en: 'Columns' },
  export_csv: { ar: 'تصدير CSV', en: 'Export CSV' },
  print_view: { ar: 'طباعة / PDF', en: 'Print / PDF' },
  prev_page: { ar: 'السابق', en: 'Previous' },
  next_page: { ar: 'التالي', en: 'Next' },
  no_records: { ar: 'لا توجد سجلات مطابقة.', en: 'No matching records.' },

  // Privacy & Footer
  gdpr_banner_text: {
    ar: 'نستخدم ملفات تعريف ارتباط أساسية لتشغيل السلة وحماية الدفع، وبموافقتك نفعّل تحليلات GA4 وإعلانات AdSense.',
    en: 'We use essential session storage for cart & PCI-DSS security. Consent also enables GA4 telemetry and AdSense.',
  },
  gdpr_accept_all: { ar: 'قبول الكل', en: 'Accept All' },
  gdpr_essential_only: { ar: 'الأساسية فقط', en: 'Essential Only' },
  privacy_policy: { ar: 'سياسة الخصوصية', en: 'Privacy Policy' },
  terms_of_use: { ar: 'شروط الاستخدام', en: 'Terms of Use' },
  refund_policy: { ar: 'سياسة الاسترجاع', en: 'Refund Policy' },
  sign_out: { ar: 'تسجيل الخروج', en: 'Sign Out' },
  sponsored_label: { ar: 'إعلان مموّل · AdSense', en: 'Sponsored · AdSense' },
};

export function t(locale: Locale, key: string): string {
  const entry = DICTIONARY[key];
  if (!entry) return key;
  return entry[locale] || entry.en;
}

export function pickI18n(val: I18nText | string | null | undefined, locale: Locale): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val[locale] || val.ar || val.en || '';
}

export function formatMoney(amount: number, currency = 'SAR', locale: Locale = 'ar'): string {
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return locale === 'ar' ? `${formatted} ر.س` : `${currency} ${formatted}`;
}

export function formatRelativeDate(iso: string, locale: Locale = 'ar'): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return locale === 'ar' ? 'الآن' : 'Just now';
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return locale === 'ar' ? `منذ ${mins} د` : `${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hrs = Math.floor(diffSec / 3600);
    return locale === 'ar' ? `منذ ${hrs} س` : `${hrs}h ago`;
  }
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
