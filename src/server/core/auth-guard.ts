import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { dbStore } from './db.ts';
import { verifyAccessToken } from './crypto.ts';
import { AppError } from './errors.ts';
import { DEFAULT_TENANT_ID } from './seed.ts';
import type { SafeUserDTO, UserRecord } from '../../shared/types.ts';

export interface AuthRequest extends Request {
  tenantId: string;
  authUser: SafeUserDTO | null;
  sessionId?: string;
}

export function resolveUserPermissions(user: UserRecord): string[] {
  const db = dbStore.snapshot();
  const userRoles = db.user_roles.filter(
    (ur) => ur.user_id === user.id && ur.tenant_id === user.tenant_id
  );
  const roleIds = new Set(userRoles.map((ur) => ur.role_id));
  const permIds = new Set(
    db.role_permissions
      .filter((rp) => roleIds.has(rp.role_id))
      .map((rp) => rp.permission_id)
  );
  return db.permissions.filter((p) => permIds.has(p.id)).map((p) => p.code);
}

export function toSafeUserDTO(user: UserRecord): SafeUserDTO {
  const db = dbStore.snapshot();
  const vendor = db.vendors.find(
    (v) => v.owner_user_id === user.id && v.tenant_id === user.tenant_id
  );
  return {
    id: user.id,
    tenant_id: user.tenant_id,
    email: user.email,
    phone: user.phone,
    full_name: user.full_name,
    user_type: user.user_type,
    email_verified_at: user.email_verified_at,
    phone_verified_at: user.phone_verified_at,
    two_factor_enabled: user.two_factor_enabled,
    preferred_locale: user.preferred_locale,
    preferred_theme: user.preferred_theme,
    status: user.status,
    permissions: resolveUserPermissions(user),
    vendor_id: vendor?.id ?? null,
  };
}

export function attachTenantAndAuth(req: Request, _res: Response, next: NextFunction): void {
  const authReq = req as AuthRequest;
  const db = dbStore.snapshot();
  const requestedTenant = req.headers['x-tenant-id'] as string | undefined;
  const matchedTenant = requestedTenant
    ? db.tenants.find((t) => t.id === requestedTenant || t.slug === requestedTenant)
    : null;
  authReq.tenantId = matchedTenant?.id || DEFAULT_TENANT_ID;
  authReq.authUser = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyAccessToken(token);
    if (payload) {
      const user = db.users.find(
        (u) => u.id === payload.sub && u.tenant_id === payload.tid && u.status === 'active'
      );
      const session = db.user_sessions.find(
        (s) => s.id === payload.sid && !s.revoked_at && new Date(s.expires_at).getTime() > Date.now()
      );
      if (user && session) {
        authReq.tenantId = payload.tid;
        authReq.authUser = toSafeUserDTO(user);
        authReq.sessionId = session.id;
      }
    }
  }

  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authReq = req as AuthRequest;
  if (!authReq.authUser) {
    next(new AppError({ status: 401, code: 'UNAUTHORIZED', message: 'Authentication required' }));
    return;
  }
  next();
}

export function requirePermission(permissionCode: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    if (!authReq.authUser) {
      next(new AppError({ status: 401, code: 'UNAUTHORIZED', message: 'Authentication required' }));
      return;
    }
    if (
      authReq.authUser.user_type === 'super_admin' ||
      authReq.authUser.permissions.includes(permissionCode)
    ) {
      next();
      return;
    }
    next(
      new AppError({
        status: 403,
        code: 'FORBIDDEN',
        message: `Missing required permission: ${permissionCode}`,
      })
    );
  };
}

export async function recordAuditLog(params: {
  tenantId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
}): Promise<void> {
  await dbStore.withTransaction((db) => {
    db.audit_logs.unshift({
      id: crypto.randomUUID(),
      tenant_id: params.tenantId,
      actor_user_id: params.actorUserId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      old_values: params.oldValues ?? null,
      new_values: params.newValues ?? null,
      ip_address: params.ipAddress ?? null,
      created_at: new Date().toISOString(),
    });
    if (db.audit_logs.length > 500) {
      db.audit_logs.length = 500;
    }
  });
}
