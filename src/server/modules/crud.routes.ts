import { Router } from 'express';
import crypto from 'crypto';
import { dbStore } from '../core/db.ts';
import { cacheStore } from '../core/cache.ts';
import { AppError } from '../core/errors.ts';
import {
  attachTenantAndAuth,
  requireAuth,
  recordAuditLog,
  type AuthRequest,
} from '../core/auth-guard.ts';
import type { CrudResourceMetadata, DatabaseSchema } from '../../shared/types.ts';

export const crudRouter = Router();
crudRouter.use(attachTenantAndAuth);
crudRouter.use(requireAuth);

const RESOURCE_SCHEMAS: Record<string, CrudResourceMetadata> = {
  products: {
    resource: 'products',
    title_i18n: { ar: 'كتالوج المنتجات', en: 'Products Catalog' },
    primary_key: 'id',
    default_sort: { field: 'created_at', order: 'desc' },
    supported_exports: ['pdf', 'xlsx', 'csv'],
    fields: [
      {
        field: 'title_i18n',
        label_key: 'product_title',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: true, input_type: 'text' },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'products.read', edit_permission: 'products.update' },
        capabilities: { sortable: true, filterable: true, searchable: true, exportable: true, user_toggleable: false },
      },
      {
        field: 'vendor_name',
        label_key: 'vendor',
        look_type: 'relation_lookup',
        display_options: { relation_resource: 'vendors', relation_label_field: 'store_name_i18n' },
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: false, tablet: true, desktop: true },
        permissions: { view_permission: 'products.read', edit_permission: 'products.update' },
        capabilities: { sortable: true, filterable: true, searchable: true, exportable: true, user_toggleable: true },
      },
      {
        field: 'base_price',
        label_key: 'price',
        look_type: 'currency',
        display_options: { currency_field: 'currency' },
        inline_edit: { enabled: true, input_type: 'number' },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'products.read', edit_permission: 'products.update' },
        capabilities: { sortable: true, filterable: true, searchable: false, exportable: true, user_toggleable: true },
      },
      {
        field: 'total_stock',
        label_key: 'stock_qty',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: true, input_type: 'number' },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'products.read', edit_permission: 'products.update' },
        capabilities: { sortable: true, filterable: false, searchable: false, exportable: true, user_toggleable: true },
      },
      {
        field: 'status',
        label_key: 'status',
        look_type: 'badge',
        display_options: {
          badge_map: [
            { value: 'active', label_key: 'active', variant: 'success' },
            { value: 'draft', label_key: 'draft', variant: 'neutral' },
            { value: 'out_of_stock', label_key: 'out_of_stock', variant: 'warning' },
            { value: 'archived', label_key: 'archived', variant: 'danger' },
          ],
        },
        inline_edit: { enabled: true, input_type: 'select', options: ['active', 'draft', 'out_of_stock', 'archived'] },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'products.read', edit_permission: 'products.update' },
        capabilities: { sortable: true, filterable: true, searchable: false, exportable: true, user_toggleable: true },
      },
      {
        field: 'is_featured',
        label_key: 'is_featured',
        look_type: 'boolean_switch',
        display_options: {},
        inline_edit: { enabled: true, input_type: 'switch' },
        responsive_visibility: { mobile: false, tablet: false, desktop: true },
        permissions: { view_permission: 'products.read', edit_permission: 'products.update' },
        capabilities: { sortable: true, filterable: true, searchable: false, exportable: true, user_toggleable: true },
      },
    ],
  },
  vendors: {
    resource: 'vendors',
    title_i18n: { ar: 'التجار والمتاجر', en: 'Vendors & Stores' },
    primary_key: 'id',
    default_sort: { field: 'created_at', order: 'desc' },
    supported_exports: ['pdf', 'xlsx', 'csv'],
    fields: [
      {
        field: 'store_name_i18n',
        label_key: 'store_name',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'vendors.manage', edit_permission: 'vendors.manage' },
        capabilities: { sortable: true, filterable: true, searchable: true, exportable: true, user_toggleable: false },
      },
      {
        field: 'commercial_reg_no',
        label_key: 'commercial_reg',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: true, input_type: 'text' },
        responsive_visibility: { mobile: false, tablet: true, desktop: true },
        permissions: { view_permission: 'vendors.manage', edit_permission: 'vendors.manage' },
        capabilities: { sortable: false, filterable: false, searchable: true, exportable: true, user_toggleable: true },
      },
      {
        field: 'commission_rate',
        label_key: 'commission_rate',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: true, input_type: 'number' },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'vendors.manage', edit_permission: 'vendors.manage' },
        capabilities: { sortable: true, filterable: false, searchable: false, exportable: true, user_toggleable: true },
      },
      {
        field: 'kyc_status',
        label_key: 'kyc_status',
        look_type: 'badge',
        display_options: {
          badge_map: [
            { value: 'verified', label_key: 'verified', variant: 'success' },
            { value: 'pending', label_key: 'pending', variant: 'warning' },
            { value: 'rejected', label_key: 'rejected', variant: 'danger' },
          ],
        },
        inline_edit: { enabled: true, input_type: 'select', options: ['verified', 'pending', 'rejected'] },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'vendors.approve', edit_permission: 'vendors.approve' },
        capabilities: { sortable: true, filterable: true, searchable: false, exportable: true, user_toggleable: true },
      },
      {
        field: 'is_active',
        label_key: 'is_active',
        look_type: 'boolean_switch',
        display_options: {},
        inline_edit: { enabled: true, input_type: 'switch' },
        responsive_visibility: { mobile: false, tablet: true, desktop: true },
        permissions: { view_permission: 'vendors.manage', edit_permission: 'vendors.manage' },
        capabilities: { sortable: true, filterable: true, searchable: false, exportable: true, user_toggleable: true },
      },
    ],
  },
  vendor_suborders: {
    resource: 'vendor_suborders',
    title_i18n: { ar: 'طلبات التجار والشحن', en: 'Vendor Sub-Orders' },
    primary_key: 'id',
    default_sort: { field: 'updated_at', order: 'desc' },
    supported_exports: ['pdf', 'xlsx', 'csv'],
    fields: [
      {
        field: 'suborder_number',
        label_key: 'order_number',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'orders.read', edit_permission: 'orders.update' },
        capabilities: { sortable: true, filterable: true, searchable: true, exportable: true, user_toggleable: false },
      },
      {
        field: 'vendor_name',
        label_key: 'vendor',
        look_type: 'relation_lookup',
        display_options: { relation_resource: 'vendors' },
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: false, tablet: true, desktop: true },
        permissions: { view_permission: 'orders.read', edit_permission: 'orders.update' },
        capabilities: { sortable: true, filterable: true, searchable: true, exportable: true, user_toggleable: true },
      },
      {
        field: 'gross_amount',
        label_key: 'gross_amount',
        look_type: 'currency',
        display_options: { currency_field: 'currency' },
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'orders.read', edit_permission: 'orders.update' },
        capabilities: { sortable: true, filterable: false, searchable: false, exportable: true, user_toggleable: true },
      },
      {
        field: 'vendor_net_amount',
        label_key: 'vendor_net',
        look_type: 'currency',
        display_options: { currency_field: 'currency' },
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: false, tablet: true, desktop: true },
        permissions: { view_permission: 'orders.read', edit_permission: 'orders.update' },
        capabilities: { sortable: true, filterable: false, searchable: false, exportable: true, user_toggleable: true },
      },
      {
        field: 'tracking_number',
        label_key: 'tracking_number',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: true, input_type: 'text' },
        responsive_visibility: { mobile: false, tablet: true, desktop: true },
        permissions: { view_permission: 'orders.read', edit_permission: 'orders.update' },
        capabilities: { sortable: false, filterable: false, searchable: true, exportable: true, user_toggleable: true },
      },
      {
        field: 'fulfillment_status',
        label_key: 'fulfillment_status',
        look_type: 'badge',
        display_options: {
          badge_map: [
            { value: 'delivered', label_key: 'delivered', variant: 'success' },
            { value: 'shipped', label_key: 'shipped', variant: 'info' },
            { value: 'packed', label_key: 'packed', variant: 'warning' },
            { value: 'pending', label_key: 'pending', variant: 'neutral' },
            { value: 'returned', label_key: 'returned', variant: 'danger' },
          ],
        },
        inline_edit: { enabled: true, input_type: 'select', options: ['pending', 'packed', 'shipped', 'delivered', 'returned'] },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'orders.read', edit_permission: 'orders.update' },
        capabilities: { sortable: true, filterable: true, searchable: false, exportable: true, user_toggleable: true },
      },
    ],
  },
  audit_logs: {
    resource: 'audit_logs',
    title_i18n: { ar: 'سجل التدقيق الأمني', en: 'Immutable Audit Logs' },
    primary_key: 'id',
    default_sort: { field: 'created_at', order: 'desc' },
    supported_exports: ['csv', 'xlsx'],
    fields: [
      {
        field: 'action',
        label_key: 'action',
        look_type: 'badge',
        display_options: {
          badge_map: [
            { value: 'auth.login_success', label_key: 'login', variant: 'success' },
            { value: 'auth.login_failed', label_key: 'login_failed', variant: 'danger' },
            { value: 'payment.captured', label_key: 'payment', variant: 'info' },
          ],
        },
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'audit.logs.read', edit_permission: 'audit.logs.read' },
        capabilities: { sortable: true, filterable: true, searchable: true, exportable: true, user_toggleable: false },
      },
      {
        field: 'entity_type',
        label_key: 'entity',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'audit.logs.read', edit_permission: 'audit.logs.read' },
        capabilities: { sortable: true, filterable: true, searchable: true, exportable: true, user_toggleable: true },
      },
      {
        field: 'actor_email',
        label_key: 'actor',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: false, tablet: true, desktop: true },
        permissions: { view_permission: 'audit.logs.read', edit_permission: 'audit.logs.read' },
        capabilities: { sortable: false, filterable: false, searchable: true, exportable: true, user_toggleable: true },
      },
      {
        field: 'ip_address',
        label_key: 'ip_address',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: false, tablet: false, desktop: true },
        permissions: { view_permission: 'audit.logs.read', edit_permission: 'audit.logs.read' },
        capabilities: { sortable: false, filterable: false, searchable: true, exportable: true, user_toggleable: true },
      },
      {
        field: 'created_at',
        label_key: 'created_at',
        look_type: 'date_relative',
        display_options: {},
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'audit.logs.read', edit_permission: 'audit.logs.read' },
        capabilities: { sortable: true, filterable: false, searchable: false, exportable: true, user_toggleable: true },
      },
    ],
  },
  users: {
    resource: 'users',
    title_i18n: { ar: 'المستخدمون والصلاحيات', en: 'Users & Access' },
    primary_key: 'id',
    default_sort: { field: 'created_at', order: 'desc' },
    supported_exports: ['csv', 'xlsx'],
    fields: [
      {
        field: 'full_name',
        label_key: 'full_name',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: true, input_type: 'text' },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'rbac.manage', edit_permission: 'rbac.manage' },
        capabilities: { sortable: true, filterable: false, searchable: true, exportable: true, user_toggleable: false },
      },
      {
        field: 'email',
        label_key: 'email',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'rbac.manage', edit_permission: 'rbac.manage' },
        capabilities: { sortable: true, filterable: false, searchable: true, exportable: true, user_toggleable: true },
      },
      {
        field: 'user_type',
        label_key: 'role',
        look_type: 'badge',
        display_options: {
          badge_map: [
            { value: 'super_admin', label_key: 'super_admin', variant: 'info' },
            { value: 'moderator', label_key: 'moderator', variant: 'warning' },
            { value: 'staff', label_key: 'staff', variant: 'neutral' },
            { value: 'vendor', label_key: 'vendor', variant: 'success' },
            { value: 'customer', label_key: 'customer', variant: 'neutral' },
          ],
        },
        inline_edit: { enabled: true, input_type: 'select', options: ['super_admin', 'moderator', 'staff', 'vendor', 'customer'] },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'rbac.manage', edit_permission: 'rbac.manage' },
        capabilities: { sortable: true, filterable: true, searchable: false, exportable: true, user_toggleable: true },
      },
      {
        field: 'status',
        label_key: 'status',
        look_type: 'badge',
        display_options: {
          badge_map: [
            { value: 'active', label_key: 'active', variant: 'success' },
            { value: 'locked', label_key: 'locked', variant: 'warning' },
            { value: 'banned', label_key: 'banned', variant: 'danger' },
          ],
        },
        inline_edit: { enabled: true, input_type: 'select', options: ['active', 'locked', 'banned'] },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'rbac.manage', edit_permission: 'rbac.manage' },
        capabilities: { sortable: true, filterable: true, searchable: false, exportable: true, user_toggleable: true },
      },
    ],
  },
  blog_posts: {
    resource: 'blog_posts',
    title_i18n: { ar: 'مقالات المدونة', en: 'Blog Articles' },
    primary_key: 'id',
    default_sort: { field: 'created_at', order: 'desc' },
    supported_exports: ['csv'],
    fields: [
      {
        field: 'title_i18n',
        label_key: 'title',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'blog.manage', edit_permission: 'blog.manage' },
        capabilities: { sortable: true, filterable: false, searchable: true, exportable: true, user_toggleable: false },
      },
      {
        field: 'status',
        label_key: 'status',
        look_type: 'badge',
        display_options: {
          badge_map: [
            { value: 'published', label_key: 'published', variant: 'success' },
            { value: 'draft', label_key: 'draft', variant: 'neutral' },
            { value: 'archived', label_key: 'archived', variant: 'danger' },
          ],
        },
        inline_edit: { enabled: true, input_type: 'select', options: ['published', 'draft', 'archived'] },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'blog.manage', edit_permission: 'blog.manage' },
        capabilities: { sortable: true, filterable: true, searchable: false, exportable: true, user_toggleable: true },
      },
      {
        field: 'created_at',
        label_key: 'created_at',
        look_type: 'date_relative',
        display_options: {},
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: false, tablet: true, desktop: true },
        permissions: { view_permission: 'blog.manage', edit_permission: 'blog.manage' },
        capabilities: { sortable: true, filterable: false, searchable: false, exportable: true, user_toggleable: true },
      },
    ],
  },
  contact_inquiries: {
    resource: 'contact_inquiries',
    title_i18n: { ar: 'تذاكر ورسائل العملاء', en: 'Contact Inquiries' },
    primary_key: 'id',
    default_sort: { field: 'created_at', order: 'desc' },
    supported_exports: ['csv'],
    fields: [
      {
        field: 'sender_name',
        label_key: 'sender',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'tickets.reply', edit_permission: 'tickets.reply' },
        capabilities: { sortable: true, filterable: false, searchable: true, exportable: true, user_toggleable: false },
      },
      {
        field: 'subject',
        label_key: 'subject',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'tickets.reply', edit_permission: 'tickets.reply' },
        capabilities: { sortable: false, filterable: false, searchable: true, exportable: true, user_toggleable: true },
      },
      {
        field: 'status',
        label_key: 'status',
        look_type: 'badge',
        display_options: {
          badge_map: [
            { value: 'resolved', label_key: 'resolved', variant: 'success' },
            { value: 'in_progress', label_key: 'in_progress', variant: 'warning' },
            { value: 'new', label_key: 'new', variant: 'info' },
          ],
        },
        inline_edit: { enabled: true, input_type: 'select', options: ['new', 'in_progress', 'resolved'] },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'tickets.reply', edit_permission: 'tickets.reply' },
        capabilities: { sortable: true, filterable: true, searchable: false, exportable: true, user_toggleable: true },
      },
      {
        field: 'created_at',
        label_key: 'created_at',
        look_type: 'date_relative',
        display_options: {},
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: false, tablet: true, desktop: true },
        permissions: { view_permission: 'tickets.reply', edit_permission: 'tickets.reply' },
        capabilities: { sortable: true, filterable: false, searchable: false, exportable: true, user_toggleable: true },
      },
    ],
  },
  notification_logs: {
    resource: 'notification_logs',
    title_i18n: { ar: 'سجل إشعارات البريد وواتساب وSMS', en: 'Notification Dispatch Logs' },
    primary_key: 'id',
    default_sort: { field: 'created_at', order: 'desc' },
    supported_exports: ['csv'],
    fields: [
      {
        field: 'channel',
        label_key: 'channel',
        look_type: 'badge',
        display_options: {
          badge_map: [
            { value: 'email', label_key: 'email', variant: 'info' },
            { value: 'whatsapp', label_key: 'whatsapp', variant: 'success' },
            { value: 'sms', label_key: 'sms', variant: 'warning' },
          ],
        },
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'audit.logs.read', edit_permission: 'audit.logs.read' },
        capabilities: { sortable: true, filterable: true, searchable: true, exportable: true, user_toggleable: false },
      },
      {
        field: 'provider',
        label_key: 'provider',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: false, tablet: true, desktop: true },
        permissions: { view_permission: 'audit.logs.read', edit_permission: 'audit.logs.read' },
        capabilities: { sortable: true, filterable: true, searchable: true, exportable: true, user_toggleable: true },
      },
      {
        field: 'recipient',
        label_key: 'recipient',
        look_type: 'text',
        display_options: {},
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'audit.logs.read', edit_permission: 'audit.logs.read' },
        capabilities: { sortable: false, filterable: false, searchable: true, exportable: true, user_toggleable: true },
      },
      {
        field: 'status',
        label_key: 'status',
        look_type: 'badge',
        display_options: {
          badge_map: [
            { value: 'delivered', label_key: 'delivered', variant: 'success' },
            { value: 'sent', label_key: 'sent', variant: 'info' },
            { value: 'queued', label_key: 'queued', variant: 'warning' },
            { value: 'failed', label_key: 'failed', variant: 'danger' },
          ],
        },
        inline_edit: { enabled: false },
        responsive_visibility: { mobile: true, tablet: true, desktop: true },
        permissions: { view_permission: 'audit.logs.read', edit_permission: 'audit.logs.read' },
        capabilities: { sortable: true, filterable: true, searchable: false, exportable: true, user_toggleable: true },
      },
    ],
  },
};

function getRowsForResource(db: DatabaseSchema, resource: string, req: AuthRequest): Record<string, unknown>[] {
  const user = req.authUser!;
  const tid = req.tenantId;

  switch (resource) {
    case 'products': {
      return db.products
        .filter((p) => {
          if (p.tenant_id !== tid || p.deleted_at) return false;
          if (user.user_type === 'vendor' && user.vendor_id) return p.vendor_id === user.vendor_id;
          return true;
        })
        .map((p) => {
          const vendor = db.vendors.find((v) => v.id === p.vendor_id);
          const variants = db.product_variants.filter((v) => v.product_id === p.id);
          const totalStock = variants.reduce((s, v) => s + v.stock_qty, 0);
          return {
            ...p,
            vendor_name: vendor?.store_name_i18n || { ar: '—', en: '—' },
            total_stock: totalStock,
          };
        });
    }
    case 'vendors': {
      return db.vendors.filter((v) => v.tenant_id === tid) as unknown as Record<string, unknown>[];
    }
    case 'vendor_suborders': {
      return db.vendor_suborders
        .filter((s) => {
          if (s.tenant_id !== tid) return false;
          if (user.user_type === 'vendor' && user.vendor_id) return s.vendor_id === user.vendor_id;
          return true;
        })
        .map((s) => {
          const vendor = db.vendors.find((v) => v.id === s.vendor_id);
          return {
            ...s,
            currency: 'SAR',
            vendor_name: vendor?.store_name_i18n || { ar: '—', en: '—' },
          };
        });
    }
    case 'audit_logs': {
      if (!['super_admin', 'moderator'].includes(user.user_type)) {
        throw new AppError({ status: 403, code: 'FORBIDDEN', message: 'Access denied to audit logs' });
      }
      return db.audit_logs
        .filter((a) => a.tenant_id === tid)
        .map((a) => {
          const actor = db.users.find((u) => u.id === a.actor_user_id);
          return { ...a, actor_email: actor?.email || 'system' };
        });
    }
    case 'users': {
      if (user.user_type !== 'super_admin') {
        throw new AppError({ status: 403, code: 'FORBIDDEN', message: 'Only Super Admin can manage users' });
      }
      return db.users
        .filter((u) => u.tenant_id === tid)
        .map(({ password_hash: _ph, two_factor_secret_enc: _tfa, ...safe }) => safe);
    }
    case 'blog_posts': {
      return db.blog_posts.filter((b) => b.tenant_id === tid) as unknown as Record<string, unknown>[];
    }
    case 'contact_inquiries': {
      return db.contact_inquiries.filter((c) => c.tenant_id === tid) as unknown as Record<string, unknown>[];
    }
    case 'notification_logs': {
      return db.notification_logs.filter((n) => n.tenant_id === tid) as unknown as Record<string, unknown>[];
    }
    default:
      throw new AppError({ status: 404, code: 'RESOURCE_NOT_FOUND', message: `Unknown CRUD resource: ${resource}` });
  }
}

crudRouter.get('/:resource/schema', (req, res, next) => {
  try {
    const schema = RESOURCE_SCHEMAS[req.params.resource];
    if (!schema) {
      throw new AppError({ status: 404, code: 'SCHEMA_NOT_FOUND', message: 'Resource schema not found' });
    }
    res.json({ success: true, data: schema });
  } catch (err) {
    next(err);
  }
});

crudRouter.get('/:resource', (req, res, next) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const resource = req.params.resource;
    const schema = RESOURCE_SCHEMAS[resource];
    if (!schema) {
      throw new AppError({ status: 404, code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
    }

    const started = Date.now();
    const db = dbStore.snapshot();
    let rows = getRowsForResource(db, resource, authReq);

    const search = String(req.query.search || '').trim().toLowerCase();
    if (search) {
      rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(search));
    }

    const statusFilter = String(req.query.status || '').trim();
    if (statusFilter && statusFilter !== 'all') {
      rows = rows.filter(
        (r) =>
          r.status === statusFilter ||
          r.kyc_status === statusFilter ||
          r.fulfillment_status === statusFilter ||
          r.user_type === statusFilter ||
          r.channel === statusFilter
      );
    }

    const sortBy = String(req.query.sort_by || schema.default_sort.field);
    const sortOrder = String(req.query.sort_order || schema.default_sort.order) === 'asc' ? 1 : -1;

    rows.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortOrder;
      return String(av ?? '').localeCompare(String(bv ?? '')) * sortOrder;
    });

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const page = Math.max(1, Number(req.query.page) || 1);
    const totalItems = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;
    const sliced = rows.slice(offset, offset + limit);

    res.json({
      success: true,
      meta: {
        resource,
        tenant_id: authReq.tenantId,
        execution_ms: Date.now() - started,
      },
      pagination: {
        mode: 'page',
        limit,
        current_page: safePage,
        total_items: totalItems,
        total_pages: totalPages,
        has_next: safePage < totalPages,
        has_prev: safePage > 1,
      },
      data: sliced,
    });
  } catch (err) {
    next(err);
  }
});

crudRouter.patch('/:resource/:id/inline', async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthRequest;
    const { resource, id } = req.params;
    const { field, value } = req.body as { field: string; value: unknown };

    const schema = RESOURCE_SCHEMAS[resource];
    if (!schema) {
      throw new AppError({ status: 404, code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
    }
    const fieldMeta = schema.fields.find((f) => f.field === field);
    if (!fieldMeta || !fieldMeta.inline_edit.enabled) {
      throw new AppError({ status: 400, code: 'INLINE_EDIT_DISABLED', message: `Field ${field} is not inline-editable.` });
    }

    const updated = await dbStore.withTransaction((db) => {
      const nowIso = new Date().toISOString();
      if (resource === 'products') {
        const prod = db.products.find((p) => p.id === id && p.tenant_id === authReq.tenantId);
        if (!prod) throw new AppError({ status: 404, code: 'NOT_FOUND', message: 'Product not found' });
        if (authReq.authUser!.user_type === 'vendor' && prod.vendor_id !== authReq.authUser!.vendor_id) {
          throw new AppError({ status: 403, code: 'FORBIDDEN', message: 'Cannot edit another vendor product' });
        }
        if (field === 'base_price') {
          const num = Number(value);
          if (!Number.isFinite(num) || num <= 0) throw new AppError({ status: 400, code: 'INVALID_PRICE', message: 'Price must be positive' });
          prod.base_price = num;
        } else if (field === 'total_stock') {
          const qty = Math.max(0, Math.floor(Number(value)));
          const primaryVar = db.product_variants.find((v) => v.product_id === prod.id);
          if (primaryVar) {
            primaryVar.stock_qty = qty;
            primaryVar.updated_at = nowIso;
          }
        } else if (field === 'status' && typeof value === 'string') {
          prod.status = value as typeof prod.status;
        } else if (field === 'is_featured') {
          prod.is_featured = Boolean(value);
        } else if (field === 'title_i18n' && typeof value === 'string') {
          prod.title_i18n = { ...prod.title_i18n, ar: value, en: value };
        }
        prod.updated_at = nowIso;
        return prod;
      }

      if (resource === 'vendors') {
        if (!['super_admin', 'moderator'].includes(authReq.authUser!.user_type)) {
          throw new AppError({ status: 403, code: 'FORBIDDEN', message: 'Insufficient privileges' });
        }
        const vendor = db.vendors.find((v) => v.id === id && v.tenant_id === authReq.tenantId);
        if (!vendor) throw new AppError({ status: 404, code: 'NOT_FOUND', message: 'Vendor not found' });
        if (field === 'kyc_status' && typeof value === 'string') vendor.kyc_status = value as typeof vendor.kyc_status;
        if (field === 'commission_rate') vendor.commission_rate = Number(value);
        if (field === 'is_active') vendor.is_active = Boolean(value);
        if (field === 'commercial_reg_no') vendor.commercial_reg_no = String(value);
        return vendor;
      }

      if (resource === 'vendor_suborders') {
        const sub = db.vendor_suborders.find((s) => s.id === id && s.tenant_id === authReq.tenantId);
        if (!sub) throw new AppError({ status: 404, code: 'NOT_FOUND', message: 'Sub-order not found' });
        if (authReq.authUser!.user_type === 'vendor' && sub.vendor_id !== authReq.authUser!.vendor_id) {
          throw new AppError({ status: 403, code: 'FORBIDDEN', message: 'Cannot modify another vendor order' });
        }
        if (field === 'fulfillment_status' && typeof value === 'string') sub.fulfillment_status = value as typeof sub.fulfillment_status;
        if (field === 'tracking_number') sub.tracking_number = String(value);
        sub.updated_at = nowIso;
        return sub;
      }

      if (resource === 'users') {
        if (authReq.authUser!.user_type !== 'super_admin') {
          throw new AppError({ status: 403, code: 'FORBIDDEN', message: 'Super Admin only' });
        }
        const target = db.users.find((u) => u.id === id && u.tenant_id === authReq.tenantId);
        if (!target) throw new AppError({ status: 404, code: 'NOT_FOUND', message: 'User not found' });
        if (field === 'status' && typeof value === 'string') target.status = value as typeof target.status;
        if (field === 'full_name') target.full_name = String(value);
        if (field === 'user_type' && typeof value === 'string') {
          target.user_type = value as typeof target.user_type;
          const role = db.roles.find((r) => r.code === value && r.tenant_id === authReq.tenantId);
          if (role) {
            db.user_roles = db.user_roles.filter((ur) => ur.user_id !== target.id);
            db.user_roles.push({
              id: crypto.randomUUID(),
              tenant_id: authReq.tenantId,
              user_id: target.id,
              role_id: role.id,
              assigned_by: authReq.authUser!.id,
              created_at: nowIso,
            });
          }
        }
        target.updated_at = nowIso;
        return { id: target.id, status: target.status, user_type: target.user_type };
      }

      if (resource === 'blog_posts') {
        const post = db.blog_posts.find((b) => b.id === id && b.tenant_id === authReq.tenantId);
        if (!post) throw new AppError({ status: 404, code: 'NOT_FOUND', message: 'Article not found' });
        if (field === 'status' && typeof value === 'string') {
          post.status = value as typeof post.status;
          if (value === 'published' && !post.published_at) post.published_at = nowIso;
        }
        return post;
      }

      if (resource === 'contact_inquiries') {
        const inq = db.contact_inquiries.find((c) => c.id === id && c.tenant_id === authReq.tenantId);
        if (!inq) throw new AppError({ status: 404, code: 'NOT_FOUND', message: 'Inquiry not found' });
        if (field === 'status' && typeof value === 'string') inq.status = value as typeof inq.status;
        return inq;
      }

      throw new AppError({ status: 400, code: 'UNSUPPORTED_RESOURCE', message: 'Inline edit not supported' });
    });

    cacheStore.invalidatePrefix(cacheStore.key(authReq.tenantId, ''));
    await recordAuditLog({
      tenantId: authReq.tenantId,
      actorUserId: authReq.authUser!.id,
      action: `crud.inline_edit`,
      entityType: resource,
      entityId: id,
      newValues: { field, value },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// Create product (for Vendor / Admin)
crudRouter.post('/products', async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.authUser!;
    if (!['super_admin', 'vendor'].includes(user.user_type)) {
      throw new AppError({ status: 403, code: 'FORBIDDEN', message: 'Only vendors or admins can create products' });
    }
    const { title_ar, title_en, description_ar, description_en, base_price, stock_qty, category_id, sku, visual_theme } = req.body as Record<string, unknown>;
    if (!title_ar || !title_en || !base_price) {
      throw new AppError({ status: 400, code: 'VALIDATION_ERROR', message: 'Title and base price are required' });
    }

    const created = await dbStore.withTransaction((db) => {
      const nowIso = new Date().toISOString();
      const vendorId = user.vendor_id || db.vendors.find((v) => v.tenant_id === authReq.tenantId)?.id!;
      const catId = String(category_id || db.categories[0].id);
      const prodId = crypto.randomUUID();
      const slug = `${String(title_en).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${prodId.slice(0, 5)}`;

      const product = {
        id: prodId,
        tenant_id: authReq.tenantId,
        vendor_id: vendorId,
        category_id: catId,
        slug,
        title_i18n: { ar: String(title_ar), en: String(title_en) },
        description_i18n: { ar: String(description_ar || title_ar), en: String(description_en || title_en) },
        primary_image_id: null,
        gallery_media_ids: [],
        visual_theme: String(visual_theme || 'speaker'),
        base_price: Number(base_price),
        currency: 'SAR',
        tax_rate: 15,
        seo_meta: null,
        status: 'active' as const,
        is_featured: false,
        rating_avg: 5.0,
        review_count: 0,
        deleted_at: null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      db.products.unshift(product);

      const variant = {
        id: crypto.randomUUID(),
        tenant_id: authReq.tenantId,
        product_id: prodId,
        sku: String(sku || `SKU-${prodId.slice(0, 6).toUpperCase()}`),
        attributes: { edition: 'Standard' },
        price: Number(base_price),
        compare_at_price: null,
        stock_qty: Math.max(0, Number(stock_qty ?? 10)),
        reserved_qty: 0,
        low_stock_threshold: 5,
        weight_grams: 500,
        is_active: true,
        updated_at: nowIso,
      };
      db.product_variants.push(variant);
      return { product, variant };
    });

    await recordAuditLog({
      tenantId: authReq.tenantId,
      actorUserId: user.id,
      action: 'crud.create',
      entityType: 'products',
      entityId: created.product.id,
      newValues: { title: created.product.title_i18n.en, price: created.product.base_price },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});
