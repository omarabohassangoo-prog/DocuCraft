import type { PoolClient } from 'pg';
import type { DatabaseSchema } from '../../shared/types.ts';

/**
 * Normalized 30-Table PostgreSQL DDL & Parameterized ACID Persistence
 * Matches prisma/schema.prisma 1:1.
 */
export const TABLE_ORDER: (keyof DatabaseSchema)[] = [
  'tenants',
  'users',
  'user_sessions',
  'otp_verifications',
  'roles',
  'permissions',
  'role_permissions',
  'user_roles',
  'sidebar_menus',
  'media_files',
  'cms_pages',
  'cms_sections',
  'blog_posts',
  'contact_inquiries',
  'system_settings',
  'encrypted_secrets',
  'ad_units',
  'vendors',
  'categories',
  'products',
  'product_variants',
  'carts',
  'cart_items',
  'orders',
  'vendor_suborders',
  'order_items',
  'payment_transactions',
  'notification_templates',
  'notification_logs',
  'audit_logs',
];

const DDL_STATEMENTS = `
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  custom_domain TEXT UNIQUE,
  plan_tier TEXT NOT NULL DEFAULT 'enterprise',
  default_locale TEXT NOT NULL DEFAULT 'ar',
  default_currency TEXT NOT NULL DEFAULT 'SAR',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_file_id TEXT,
  user_type TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  phone_verified_at TIMESTAMPTZ,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret_enc TEXT,
  preferred_locale TEXT NOT NULL DEFAULT 'ar',
  preferred_theme TEXT NOT NULL DEFAULT 'light',
  status TEXT NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_users_tenant_type ON users(tenant_id, user_type);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant_user ON user_sessions(tenant_id, user_id);

CREATE TABLE IF NOT EXISTS otp_verifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT,
  channel TEXT NOT NULL,
  purpose TEXT NOT NULL,
  target TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_i18n JSONB NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  abac_condition JSONB,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, role_id)
);

CREATE TABLE IF NOT EXISTS sidebar_menus (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_id TEXT,
  group_i18n JSONB NOT NULL,
  label_i18n JSONB NOT NULL,
  route_path TEXT NOT NULL,
  icon_name TEXT NOT NULL,
  required_permission TEXT NOT NULL,
  dashboard_scope TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS media_files (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL,
  storage_driver TEXT NOT NULL,
  bucket_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  variants_json JSONB,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  alt_text_i18n JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_pages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  slug TEXT NOT NULL,
  title_i18n JSONB NOT NULL,
  meta_title_i18n JSONB,
  meta_description_i18n JSONB,
  og_image_id TEXT,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS cms_sections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  content_i18n JSONB NOT NULL,
  media_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title_i18n JSONB NOT NULL,
  excerpt_i18n JSONB,
  body_i18n JSONB NOT NULL,
  cover_image_id TEXT,
  seo_tags JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS contact_inquiries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  sender_phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  setting_group TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value JSONB,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, setting_group, setting_key)
);

CREATE TABLE IF NOT EXISTS encrypted_secrets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  env_key TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  masked_preview TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ,
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, env_key)
);

CREATE TABLE IF NOT EXISTS ad_units (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  adsense_client_id TEXT NOT NULL,
  adsense_slot_id TEXT NOT NULL,
  placement TEXT NOT NULL,
  ad_format TEXT NOT NULL DEFAULT 'auto',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_slug TEXT NOT NULL,
  store_name_i18n JSONB NOT NULL,
  tagline_i18n JSONB,
  logo_file_id TEXT,
  commercial_reg_no TEXT,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10,
  kyc_status TEXT NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, store_slug)
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_id TEXT,
  slug TEXT NOT NULL,
  name_i18n JSONB NOT NULL,
  image_file_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id),
  slug TEXT NOT NULL,
  title_i18n JSONB NOT NULL,
  description_i18n JSONB NOT NULL,
  primary_image_id TEXT,
  gallery_media_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  visual_theme TEXT NOT NULL DEFAULT 'speaker',
  base_price NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 15,
  seo_meta JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 5.0,
  review_count INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  attributes JSONB NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  compare_at_price NUMERIC(12,2),
  stock_qty INTEGER NOT NULL DEFAULT 0,
  reserved_qty INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  weight_grams INTEGER NOT NULL DEFAULT 500,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, sku)
);

CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT,
  guest_token TEXT,
  currency TEXT NOT NULL DEFAULT 'SAR',
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_price_snapshot NUMERIC(12,2) NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES users(id),
  order_number TEXT UNIQUE NOT NULL,
  subtotal_amount NUMERIC(12,2) NOT NULL,
  tax_amount NUMERIC(12,2) NOT NULL,
  shipping_amount NUMERIC(12,2) NOT NULL,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  shipping_address JSONB NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  order_status TEXT NOT NULL DEFAULT 'created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_suborders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL REFERENCES vendors(id),
  suborder_number TEXT UNIQUE NOT NULL,
  gross_amount NUMERIC(12,2) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  vendor_net_amount NUMERIC(12,2) NOT NULL,
  fulfillment_status TEXT NOT NULL DEFAULT 'pending',
  tracking_number TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  suborder_id TEXT NOT NULL REFERENCES vendor_suborders(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,
  sku_snapshot TEXT NOT NULL,
  title_snapshot JSONB NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  tax_amount NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL,
  gateway_tx_id TEXT,
  idempotency_key TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  status TEXT NOT NULL DEFAULT 'initiated',
  webhook_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS notification_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_code TEXT NOT NULL,
  channel TEXT NOT NULL,
  external_template_id TEXT,
  subject_i18n JSONB,
  body_i18n JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT,
  channel TEXT NOT NULL,
  provider TEXT NOT NULL,
  recipient TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const NUMERIC_COLS = new Set([
  'commission_rate',
  'base_price',
  'tax_rate',
  'rating_avg',
  'price',
  'compare_at_price',
  'unit_price_snapshot',
  'subtotal_amount',
  'tax_amount',
  'shipping_amount',
  'discount_amount',
  'grand_total',
  'gross_amount',
  'commission_amount',
  'vendor_net_amount',
  'unit_price',
  'line_total',
  'amount',
]);

const JSONB_COLS = new Set([
  'abac_condition',
  'name_i18n',
  'group_i18n',
  'label_i18n',
  'variants_json',
  'alt_text_i18n',
  'title_i18n',
  'meta_title_i18n',
  'meta_description_i18n',
  'content_i18n',
  'excerpt_i18n',
  'body_i18n',
  'seo_tags',
  'setting_value',
  'store_name_i18n',
  'tagline_i18n',
  'description_i18n',
  'gallery_media_ids',
  'seo_meta',
  'attributes',
  'shipping_address',
  'title_snapshot',
  'webhook_payload',
  'subject_i18n',
  'old_values',
  'new_values',
]);

function normalizeRowFromPg(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) {
      out[k] = v.toISOString();
    } else if (v !== null && v !== undefined && NUMERIC_COLS.has(k)) {
      out[k] = Number(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function ensureNormalizedPgSchema(client: PoolClient): Promise<void> {
  await client.query(DDL_STATEMENTS);
}

export async function loadAllNormalizedTables(client: PoolClient): Promise<DatabaseSchema | null> {
  const check = await client.query<{ cnt: string }>('SELECT COUNT(*)::text AS cnt FROM tenants');
  if (Number(check.rows[0]?.cnt || 0) === 0) {
    return null;
  }

  const loaded = {} as Record<keyof DatabaseSchema, unknown[]>;
  for (const table of TABLE_ORDER) {
    const res = await client.query(`SELECT * FROM ${table}`);
    loaded[table] = res.rows.map((r) => normalizeRowFromPg(r as Record<string, unknown>));
  }
  return loaded as unknown as DatabaseSchema;
}

async function syncSingleTable(
  client: PoolClient,
  table: keyof DatabaseSchema,
  rows: Record<string, unknown>[]
): Promise<void> {
  if (rows.length === 0) {
    await client.query(`DELETE FROM ${table}`);
    return;
  }

  const ids = rows.map((r) => String(r.id));
  await client.query(`DELETE FROM ${table} WHERE NOT (id = ANY($1::text[]))`, [ids]);

  const cols = Object.keys(rows[0]);
  const colList = cols.join(', ');
  const updateList = cols
    .filter((c) => c !== 'id')
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(', ');

  for (const row of rows) {
    const placeholders: string[] = [];
    const values: unknown[] = [];
    cols.forEach((c, idx) => {
      const val = row[c];
      if (JSONB_COLS.has(c)) {
        placeholders.push(`$${idx + 1}::jsonb`);
        values.push(val === undefined ? null : JSON.stringify(val));
      } else {
        placeholders.push(`$${idx + 1}`);
        values.push(val === undefined ? null : val);
      }
    });

    const sql = updateList
      ? `INSERT INTO ${table} (${colList}) VALUES (${placeholders.join(', ')}) ON CONFLICT (id) DO UPDATE SET ${updateList}`
      : `INSERT INTO ${table} (${colList}) VALUES (${placeholders.join(', ')}) ON CONFLICT (id) DO NOTHING`;

    await client.query(sql, values);
  }
}

export async function persistAllNormalizedTables(
  client: PoolClient,
  db: DatabaseSchema,
  previousSnapshot?: DatabaseSchema
): Promise<void> {
  for (const table of TABLE_ORDER) {
    const nextRows = db[table] as unknown as Record<string, unknown>[];
    if (previousSnapshot) {
      const prevRows = previousSnapshot[table] as unknown as Record<string, unknown>[];
      if (JSON.stringify(prevRows) === JSON.stringify(nextRows)) {
        continue;
      }
    }
    await syncSingleTable(client, table, nextRows);
  }
}
