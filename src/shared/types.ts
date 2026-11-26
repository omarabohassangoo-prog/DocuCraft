export type Locale = 'ar' | 'en';
export type ThemeMode = 'light' | 'dark' | 'brand' | 'system';
export type UserRoleType = 'super_admin' | 'moderator' | 'staff' | 'vendor' | 'customer';

export interface I18nText {
  ar: string;
  en: string;
}

export interface TenantRecord {
  id: string;
  slug: string;
  name: string;
  custom_domain: string | null;
  plan_tier: 'standard' | 'pro' | 'enterprise';
  default_locale: Locale;
  default_currency: string;
  status: 'active' | 'suspended' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface UserRecord {
  id: string;
  tenant_id: string;
  email: string;
  phone: string | null;
  password_hash: string;
  full_name: string;
  avatar_file_id: string | null;
  user_type: UserRoleType;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  two_factor_enabled: boolean;
  two_factor_secret_enc: string | null;
  preferred_locale: Locale;
  preferred_theme: ThemeMode;
  status: 'active' | 'locked' | 'banned';
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafeUserDTO {
  id: string;
  tenant_id: string;
  email: string;
  phone: string | null;
  full_name: string;
  user_type: UserRoleType;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  two_factor_enabled: boolean;
  preferred_locale: Locale;
  preferred_theme: ThemeMode;
  status: 'active' | 'locked' | 'banned';
  permissions: string[];
  vendor_id?: string | null;
}

export interface UserSessionRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  refresh_token_hash: string;
  ip_address: string;
  user_agent: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface OtpVerificationRecord {
  id: string;
  tenant_id: string;
  user_id: string | null;
  channel: 'email' | 'sms' | 'whatsapp' | 'totp';
  purpose: 'register' | 'login_2fa' | 'reset_password' | 'verify_phone';
  target: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  verified_at: string | null;
  created_at: string;
}

export interface RoleRecord {
  id: string;
  tenant_id: string;
  code: string;
  name_i18n: I18nText;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

export interface PermissionRecord {
  id: string;
  resource: string;
  action: string;
  code: string;
  abac_condition: Record<string, unknown> | null;
  description: string | null;
}

export interface RolePermissionRecord {
  id: string;
  role_id: string;
  permission_id: string;
  granted_at: string;
}

export interface UserRoleRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  created_at: string;
}

export interface SidebarMenuRecord {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  group_i18n: I18nText;
  label_i18n: I18nText;
  route_path: string;
  icon_name: string;
  required_permission: string;
  dashboard_scope: 'admin' | 'moderator' | 'staff' | 'vendor' | 'customer';
  sort_order: number;
  is_active: boolean;
}

export interface MediaFileRecord {
  id: string;
  tenant_id: string;
  uploaded_by: string;
  storage_driver: 's3' | 'r2' | 'local';
  bucket_name: string;
  object_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  variants_json: Record<string, string> | null;
  is_public: boolean;
  alt_text_i18n: I18nText | null;
  created_at: string;
}

export interface CmsPageRecord {
  id: string;
  tenant_id: string;
  page_key: string;
  slug: string;
  title_i18n: I18nText;
  meta_title_i18n: I18nText | null;
  meta_description_i18n: I18nText | null;
  og_image_id: string | null;
  is_published: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface CmsSectionRecord {
  id: string;
  tenant_id: string;
  page_id: string;
  section_type: 'hero_banner' | 'features_grid' | 'pricing_table' | 'faq' | 'cta' | 'rich_text' | 'stats';
  content_i18n: { ar: Record<string, unknown>; en: Record<string, unknown> };
  media_id: string | null;
  sort_order: number;
  is_visible: boolean;
  updated_at: string;
}

export interface BlogPostRecord {
  id: string;
  tenant_id: string;
  author_id: string;
  slug: string;
  title_i18n: I18nText;
  excerpt_i18n: I18nText | null;
  body_i18n: I18nText;
  cover_image_id: string | null;
  seo_tags: string[] | null;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
}

export interface ContactInquiryRecord {
  id: string;
  tenant_id: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  subject: string;
  message: string;
  status: 'new' | 'in_progress' | 'resolved';
  created_at: string;
}

export interface SystemSettingRecord {
  id: string;
  tenant_id: string;
  setting_group: 'general' | 'theme' | 'seo' | 'analytics' | 'feature_flags' | 'ecommerce';
  setting_key: string;
  setting_value: unknown;
  is_public: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface EncryptedSecretRecord {
  id: string;
  tenant_id: string;
  service_name: string;
  env_key: string;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: number;
  masked_preview: string;
  last_synced_at: string | null;
  updated_by: string;
  updated_at: string;
}

export interface AdUnitRecord {
  id: string;
  tenant_id: string;
  name: string;
  adsense_client_id: string;
  adsense_slot_id: string;
  placement: 'blog_sidebar' | 'catalog_top' | 'home_mid' | 'article_middle';
  ad_format: 'auto' | 'rectangle' | 'horizontal';
  is_active: boolean;
  updated_at: string;
}

export interface VendorRecord {
  id: string;
  tenant_id: string;
  owner_user_id: string;
  store_slug: string;
  store_name_i18n: I18nText;
  tagline_i18n?: I18nText;
  logo_file_id: string | null;
  commercial_reg_no: string | null;
  commission_rate: number;
  kyc_status: 'pending' | 'verified' | 'rejected';
  is_active: boolean;
  created_at: string;
}

export interface CategoryRecord {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  slug: string;
  name_i18n: I18nText;
  image_file_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ProductRecord {
  id: string;
  tenant_id: string;
  vendor_id: string;
  category_id: string;
  slug: string;
  title_i18n: I18nText;
  description_i18n: I18nText;
  primary_image_id: string | null;
  gallery_media_ids: string[];
  visual_theme: string;
  base_price: number;
  currency: string;
  tax_rate: number;
  seo_meta: { title?: I18nText; description?: I18nText } | null;
  status: 'draft' | 'active' | 'out_of_stock' | 'archived';
  is_featured: boolean;
  rating_avg: number;
  review_count: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVariantRecord {
  id: string;
  tenant_id: string;
  product_id: string;
  sku: string;
  attributes: Record<string, string>;
  price: number;
  compare_at_price: number | null;
  stock_qty: number;
  reserved_qty: number;
  low_stock_threshold: number;
  weight_grams: number;
  is_active: boolean;
  updated_at: string;
}

export interface CartRecord {
  id: string;
  tenant_id: string;
  user_id: string | null;
  guest_token: string | null;
  currency: string;
  expires_at: string;
  updated_at: string;
}

export interface CartItemRecord {
  id: string;
  cart_id: string;
  variant_id: string;
  quantity: number;
  unit_price_snapshot: number;
  added_at: string;
}

export interface OrderRecord {
  id: string;
  tenant_id: string;
  customer_id: string;
  order_number: string;
  subtotal_amount: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  grand_total: number;
  currency: string;
  shipping_address: {
    full_name: string;
    phone: string;
    city: string;
    street: string;
    postal_code: string;
  };
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  order_status: 'created' | 'processing' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface VendorSuborderRecord {
  id: string;
  tenant_id: string;
  order_id: string;
  vendor_id: string;
  suborder_number: string;
  gross_amount: number;
  commission_amount: number;
  vendor_net_amount: number;
  fulfillment_status: 'pending' | 'packed' | 'shipped' | 'delivered' | 'returned';
  tracking_number: string | null;
  updated_at: string;
}

export interface OrderItemRecord {
  id: string;
  tenant_id: string;
  suborder_id: string;
  variant_id: string;
  sku_snapshot: string;
  title_snapshot: I18nText;
  quantity: number;
  unit_price: number;
  tax_amount: number;
  line_total: number;
}

export interface PaymentTransactionRecord {
  id: string;
  tenant_id: string;
  order_id: string;
  gateway: 'paypal' | 'stripe' | 'mada_tap';
  gateway_tx_id: string | null;
  idempotency_key: string;
  amount: number;
  currency: string;
  status: 'initiated' | 'authorized' | 'captured' | 'failed' | 'refunded';
  webhook_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplateRecord {
  id: string;
  tenant_id: string;
  event_code: string;
  channel: 'email' | 'sms' | 'whatsapp';
  external_template_id: string | null;
  subject_i18n: I18nText | null;
  body_i18n: I18nText;
  is_active: boolean;
}

export interface NotificationLogRecord {
  id: string;
  tenant_id: string;
  user_id: string | null;
  channel: 'email' | 'sms' | 'whatsapp';
  provider: string;
  recipient: string;
  provider_message_id: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface DatabaseSchema {
  tenants: TenantRecord[];
  users: UserRecord[];
  user_sessions: UserSessionRecord[];
  otp_verifications: OtpVerificationRecord[];
  roles: RoleRecord[];
  permissions: PermissionRecord[];
  role_permissions: RolePermissionRecord[];
  user_roles: UserRoleRecord[];
  sidebar_menus: SidebarMenuRecord[];
  media_files: MediaFileRecord[];
  cms_pages: CmsPageRecord[];
  cms_sections: CmsSectionRecord[];
  blog_posts: BlogPostRecord[];
  contact_inquiries: ContactInquiryRecord[];
  system_settings: SystemSettingRecord[];
  encrypted_secrets: EncryptedSecretRecord[];
  ad_units: AdUnitRecord[];
  vendors: VendorRecord[];
  categories: CategoryRecord[];
  products: ProductRecord[];
  product_variants: ProductVariantRecord[];
  carts: CartRecord[];
  cart_items: CartItemRecord[];
  orders: OrderRecord[];
  vendor_suborders: VendorSuborderRecord[];
  order_items: OrderItemRecord[];
  payment_transactions: PaymentTransactionRecord[];
  notification_templates: NotificationTemplateRecord[];
  notification_logs: NotificationLogRecord[];
  audit_logs: AuditLogRecord[];
}

export type FieldLookType =
  | 'text'
  | 'rich_text'
  | 'badge'
  | 'image'
  | 'currency'
  | 'relation_lookup'
  | 'boolean_switch'
  | 'date_relative'
  | 'json_preview'
  | 'secret_masked';

export interface BadgeColorRule {
  value: string;
  label_key: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export interface CrudFieldLookMetadata {
  field: string;
  label_key: string;
  look_type: FieldLookType;
  display_options: {
    badge_map?: BadgeColorRule[];
    currency_field?: string;
    image_shape?: 'square' | 'circle' | 'rounded';
    relation_resource?: string;
    relation_label_field?: string;
  };
  inline_edit: {
    enabled: boolean;
    input_type?: 'text' | 'number' | 'select' | 'switch';
    options?: string[];
  };
  responsive_visibility: {
    mobile: boolean;
    tablet: boolean;
    desktop: boolean;
  };
  permissions: {
    view_permission: string;
    edit_permission: string;
  };
  capabilities: {
    sortable: boolean;
    filterable: boolean;
    searchable: boolean;
    exportable: boolean;
    user_toggleable: boolean;
  };
}

export interface CrudResourceMetadata {
  resource: string;
  title_i18n: I18nText;
  primary_key: string;
  default_sort: { field: string; order: 'asc' | 'desc' };
  supported_exports: ('pdf' | 'xlsx' | 'csv')[];
  fields: CrudFieldLookMetadata[];
}
