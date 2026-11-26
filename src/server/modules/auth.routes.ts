import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { dbStore } from '../core/db.ts';
import { cacheStore } from '../core/cache.ts';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  sha256,
  encryptSecret,
  decryptSecret,
  generateTotpSecret,
  verifyTotpCode,
  computeTotpCode,
} from '../core/crypto.ts';
import { AppError } from '../core/errors.ts';
import {
  attachTenantAndAuth,
  requireAuth,
  toSafeUserDTO,
  recordAuditLog,
  type AuthRequest,
} from '../core/auth-guard.ts';
import { dispatchRealNotification } from '../services/notifications.service.ts';

export const authRouter = Router();
authRouter.use(attachTenantAndAuth);

const registerSchema = z.object({
  full_name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(24).optional(),
  password: z.string().min(8).max(128),
  account_type: z.enum(['customer', 'vendor']).default('customer'),
  store_name: z.string().min(2).max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const bootstrapSchema = z.object({
  password: z.string().min(8).max(128),
  full_name: z.string().min(2).max(120).optional(),
});

authRouter.get('/status', (req, res) => {
  const authReq = req as AuthRequest;
  const db = dbStore.snapshot();
  const adminUser = db.users.find(
    (u) => u.tenant_id === authReq.tenantId && u.user_type === 'super_admin'
  );
  const envPasscodeSet = Boolean(process.env.ADMIN_BOOTSTRAP_PASSCODE);
  const needsAdminBootstrap = Boolean(adminUser && !adminUser.password_hash && !envPasscodeSet);

  res.json({
    success: true,
    data: {
      needsAdminBootstrap,
      adminEmail: adminUser?.email || 'admin@ufuq.commerce',
      registrationEnabled: true,
      tenants: db.tenants.map((t) => ({ id: t.id, slug: t.slug, name: t.name })),
    },
  });
});

// One-time secure first-run admin bootstrap when env passcode is unset
authRouter.post('/bootstrap-admin', async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const parsed = bootstrapSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError({ status: 400, code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters', details: parsed.error.flatten() });
    }
    if (process.env.ADMIN_BOOTSTRAP_PASSCODE) {
      throw new AppError({ status: 403, code: 'BOOTSTRAP_LOCKED', message: 'Admin bootstrap is controlled by server environment configuration.' });
    }

    const result = await dbStore.withTransaction((db) => {
      const admin = db.users.find(
        (u) => u.tenant_id === authReq.tenantId && u.user_type === 'super_admin'
      );
      if (!admin) {
        throw new AppError({ status: 404, code: 'ADMIN_NOT_FOUND', message: 'Super admin account not found' });
      }
      if (admin.password_hash) {
        throw new AppError({ status: 409, code: 'ALREADY_CLAIMED', message: 'Admin workspace is already initialized. Please sign in.' });
      }

      const hashed = hashPassword(parsed.data.password);
      admin.password_hash = hashed;
      if (parsed.data.full_name) admin.full_name = parsed.data.full_name;
      admin.last_login_at = new Date().toISOString();
      admin.updated_at = new Date().toISOString();

      const sessionId = crypto.randomUUID();
      const refreshToken = crypto.randomBytes(32).toString('hex');
      db.user_sessions.push({
        id: sessionId,
        tenant_id: admin.tenant_id,
        user_id: admin.id,
        refresh_token_hash: sha256(refreshToken),
        ip_address: req.ip || '127.0.0.1',
        user_agent: req.headers['user-agent'] || 'browser',
        expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
        revoked_at: null,
        created_at: new Date().toISOString(),
      });

      const accessToken = signAccessToken({
        sub: admin.id,
        tid: admin.tenant_id,
        role: admin.user_type,
        sid: sessionId,
      });

      return { admin, accessToken };
    });

    await recordAuditLog({
      tenantId: authReq.tenantId,
      actorUserId: result.admin.id,
      action: 'auth.admin_bootstrapped',
      entityType: 'users',
      entityId: result.admin.id,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: toSafeUserDTO(result.admin),
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const rl = cacheStore.checkRateLimit(`rl:register:${req.ip}`, 10, 60);
    if (!rl.allowed) {
      throw new AppError({ status: 429, code: 'RATE_LIMITED', message: 'Too many registration attempts. Please try again shortly.' });
    }

    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError({ status: 400, code: 'VALIDATION_ERROR', message: 'Invalid registration fields', details: parsed.error.flatten() });
    }

    const { full_name, email, phone, password, account_type, store_name } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const created = await dbStore.withTransaction((db) => {
      const exists = db.users.some(
        (u) => u.tenant_id === authReq.tenantId && u.email.toLowerCase() === normalizedEmail
      );
      if (exists) {
        throw new AppError({ status: 409, code: 'EMAIL_EXISTS', message: 'Email is already registered in this tenant' });
      }

      const nowIso = new Date().toISOString();
      const userId = crypto.randomUUID();
      const user = {
        id: userId,
        tenant_id: authReq.tenantId,
        email: normalizedEmail,
        phone: phone || null,
        password_hash: hashPassword(password),
        full_name,
        avatar_file_id: null,
        user_type: account_type,
        email_verified_at: nowIso,
        phone_verified_at: null,
        two_factor_enabled: false,
        two_factor_secret_enc: null,
        preferred_locale: 'ar' as const,
        preferred_theme: 'light' as const,
        status: 'active' as const,
        last_login_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };
      db.users.push(user);

      const role = db.roles.find(
        (r) => r.tenant_id === authReq.tenantId && r.code === account_type
      );
      if (role) {
        db.user_roles.push({
          id: crypto.randomUUID(),
          tenant_id: authReq.tenantId,
          user_id: userId,
          role_id: role.id,
          assigned_by: null,
          created_at: nowIso,
        });
      }

      if (account_type === 'vendor') {
        const slugBase = (store_name || full_name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || `studio-${userId.slice(0, 6)}`;
        db.vendors.push({
          id: crypto.randomUUID(),
          tenant_id: authReq.tenantId,
          owner_user_id: userId,
          store_slug: `${slugBase}-${userId.slice(0, 4)}`,
          store_name_i18n: { ar: store_name || full_name, en: store_name || full_name },
          tagline_i18n: { ar: 'متجر مستقل جديد', en: 'New independent studio' },
          logo_file_id: null,
          commercial_reg_no: null,
          commission_rate: 10,
          kyc_status: 'pending',
          is_active: true,
          created_at: nowIso,
        });
      }

      const sessionId = crypto.randomUUID();
      const refreshToken = crypto.randomBytes(32).toString('hex');
      db.user_sessions.push({
        id: sessionId,
        tenant_id: authReq.tenantId,
        user_id: userId,
        refresh_token_hash: sha256(refreshToken),
        ip_address: req.ip || '127.0.0.1',
        user_agent: req.headers['user-agent'] || 'browser',
        expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
        revoked_at: null,
        created_at: nowIso,
      });

      const accessToken = signAccessToken({
        sub: userId,
        tid: authReq.tenantId,
        role: user.user_type,
        sid: sessionId,
      });

      return { user, accessToken };
    });

    await dispatchRealNotification({
      tenantId: authReq.tenantId,
      userId: created.user.id,
      channel: 'email',
      recipient: created.user.email,
      subject: 'Welcome to Ufuq Commerce',
      textBody: `Welcome ${created.user.full_name}! Your account has been created successfully.`,
    });

    await recordAuditLog({
      tenantId: authReq.tenantId,
      actorUserId: created.user.id,
      action: 'auth.registered',
      entityType: 'users',
      entityId: created.user.id,
      newValues: { email: created.user.email, user_type: created.user.user_type },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: {
        accessToken: created.accessToken,
        user: toSafeUserDTO(created.user),
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const rl = cacheStore.checkRateLimit(`rl:login:${req.ip}`, 10, 60);
    if (!rl.allowed) {
      throw new AppError({ status: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Please wait 1 minute.' });
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError({ status: 400, code: 'VALIDATION_ERROR', message: 'Email and password are required' });
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const db = dbStore.snapshot();
    const user = db.users.find(
      (u) => u.tenant_id === authReq.tenantId && u.email.toLowerCase() === normalizedEmail
    );

    if (!user || user.status !== 'active') {
      throw new AppError({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const envAdminPasscode = process.env.ADMIN_BOOTSTRAP_PASSCODE;
    let passwordMatches = false;
    if (user.user_type === 'super_admin' && envAdminPasscode) {
      const a = Buffer.from(parsed.data.password);
      const b = Buffer.from(envAdminPasscode);
      passwordMatches = a.length === b.length && crypto.timingSafeEqual(a, b);
    } else if (user.password_hash) {
      passwordMatches = verifyPassword(parsed.data.password, user.password_hash);
    }

    if (!passwordMatches) {
      await recordAuditLog({
        tenantId: authReq.tenantId,
        actorUserId: user.id,
        action: 'auth.login_failed',
        entityType: 'users',
        entityId: user.id,
        ipAddress: req.ip,
      });
      throw new AppError({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    if (user.two_factor_enabled && user.two_factor_secret_enc) {
      const challengeToken = crypto.randomBytes(24).toString('hex');
      cacheStore.set(`mfa:${challengeToken}`, { userId: user.id, tenantId: user.tenant_id }, 300);
      res.json({
        success: true,
        data: {
          requires_2fa: true,
          challenge_token: challengeToken,
        },
      });
      return;
    }

    const sessionResult = await dbStore.withTransaction((txDb) => {
      const targetUser = txDb.users.find((u) => u.id === user.id)!;
      targetUser.last_login_at = new Date().toISOString();
      const sessionId = crypto.randomUUID();
      const refreshToken = crypto.randomBytes(32).toString('hex');
      txDb.user_sessions.push({
        id: sessionId,
        tenant_id: targetUser.tenant_id,
        user_id: targetUser.id,
        refresh_token_hash: sha256(refreshToken),
        ip_address: req.ip || '127.0.0.1',
        user_agent: req.headers['user-agent'] || 'browser',
        expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
        revoked_at: null,
        created_at: new Date().toISOString(),
      });
      const accessToken = signAccessToken({
        sub: targetUser.id,
        tid: targetUser.tenant_id,
        role: targetUser.user_type,
        sid: sessionId,
      });
      return { targetUser, accessToken };
    });

    await recordAuditLog({
      tenantId: authReq.tenantId,
      actorUserId: user.id,
      action: 'auth.login_success',
      entityType: 'users',
      entityId: user.id,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: {
        requires_2fa: false,
        accessToken: sessionResult.accessToken,
        user: toSafeUserDTO(sessionResult.targetUser),
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/2fa/verify', async (req, res, next) => {
  try {
    const { challenge_token, code } = z
      .object({ challenge_token: z.string().min(10), code: z.string().length(6) })
      .parse(req.body);

    const challenge = cacheStore.get<{ userId: string; tenantId: string }>(`mfa:${challenge_token}`);
    if (!challenge) {
      throw new AppError({ status: 401, code: 'CHALLENGE_EXPIRED', message: '2FA challenge expired' });
    }

    const db = dbStore.snapshot();
    const user = db.users.find((u) => u.id === challenge.userId && u.tenant_id === challenge.tenantId);
    if (!user || !user.two_factor_secret_enc) {
      throw new AppError({ status: 400, code: '2FA_NOT_CONFIGURED', message: '2FA not enabled' });
    }

    const secretPayload = JSON.parse(user.two_factor_secret_enc) as {
      ciphertext: string;
      iv: string;
      auth_tag: string;
    };
    const totpSecret = decryptSecret(secretPayload, user.tenant_id);
    if (!verifyTotpCode(totpSecret, code)) {
      throw new AppError({ status: 401, code: 'INVALID_2FA_CODE', message: 'Invalid verification code' });
    }

    cacheStore.invalidatePrefix(`mfa:${challenge_token}`);
    const sessionResult = await dbStore.withTransaction((txDb) => {
      const targetUser = txDb.users.find((u) => u.id === user.id)!;
      targetUser.last_login_at = new Date().toISOString();
      const sessionId = crypto.randomUUID();
      txDb.user_sessions.push({
        id: sessionId,
        tenant_id: targetUser.tenant_id,
        user_id: targetUser.id,
        refresh_token_hash: sha256(crypto.randomBytes(32).toString('hex')),
        ip_address: req.ip || '127.0.0.1',
        user_agent: req.headers['user-agent'] || 'browser',
        expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
        revoked_at: null,
        created_at: new Date().toISOString(),
      });
      const accessToken = signAccessToken({
        sub: targetUser.id,
        tid: targetUser.tenant_id,
        role: targetUser.user_type,
        sid: sessionId,
      });
      return { targetUser, accessToken };
    });

    res.json({
      success: true,
      data: {
        accessToken: sessionResult.accessToken,
        user: toSafeUserDTO(sessionResult.targetUser),
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/2fa/setup', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const secret = generateTotpSecret();
    const encrypted = encryptSecret(secret, authReq.tenantId);

    await dbStore.withTransaction((db) => {
      const user = db.users.find((u) => u.id === authReq.authUser!.id);
      if (!user) return;
      user.two_factor_secret_enc = JSON.stringify(encrypted);
      user.two_factor_enabled = true;
      user.updated_at = new Date().toISOString();
    });

    await recordAuditLog({
      tenantId: authReq.tenantId,
      actorUserId: authReq.authUser!.id,
      action: 'auth.2fa_enabled',
      entityType: 'users',
      entityId: authReq.authUser!.id,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: {
        secret,
        otpauth_uri: `otpauth://totp/UfuqCommerce:${encodeURIComponent(authReq.authUser!.email)}?secret=${secret}&issuer=UfuqCommerce`,
        current_sample_code: computeTotpCode(secret),
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/2fa/disable', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    await dbStore.withTransaction((db) => {
      const user = db.users.find((u) => u.id === authReq.authUser!.id);
      if (!user) return;
      user.two_factor_enabled = false;
      user.two_factor_secret_enc = null;
      user.updated_at = new Date().toISOString();
    });
    res.json({ success: true, data: { two_factor_enabled: false } });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/password/forgot', async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const rl = cacheStore.checkRateLimit(`rl:forgot:${req.ip}`, 5, 300);
    if (!rl.allowed) {
      throw new AppError({ status: 429, code: 'RATE_LIMITED', message: 'Please wait before requesting another reset.' });
    }
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const nowIso = new Date().toISOString();

    const resetTarget = await dbStore.withTransaction((db) => {
      const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.tenant_id === authReq.tenantId);
      if (!user) return null;
      const otpCode = String(crypto.randomInt(100000, 999999));
      db.otp_verifications.push({
        id: crypto.randomUUID(),
        tenant_id: authReq.tenantId,
        user_id: user.id,
        channel: 'email',
        purpose: 'reset_password',
        target: user.email,
        code_hash: sha256(otpCode),
        attempts: 0,
        expires_at: new Date(Date.now() + 900 * 1000).toISOString(),
        verified_at: null,
        created_at: nowIso,
      });
      return { userId: user.id, email: user.email, otpCode };
    });

    if (resetTarget) {
      await dispatchRealNotification({
        tenantId: authReq.tenantId,
        userId: resetTarget.userId,
        channel: 'email',
        recipient: resetTarget.email,
        subject: 'Ufuq Commerce Password Recovery Code',
        textBody: `Your password reset verification code is: ${resetTarget.otpCode}. It expires in 15 minutes.`,
      });
    }

    res.json({
      success: true,
      data: { message: 'If the email exists, a 6-digit recovery code has been dispatched.' },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/password/reset', async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const { email, code, new_password } = z
      .object({
        email: z.string().email(),
        code: z.string().length(6),
        new_password: z.string().min(8).max(128),
      })
      .parse(req.body);

    const normalizedEmail = email.trim().toLowerCase();
    const now = Date.now();

    const updatedUserId = await dbStore.withTransaction((db) => {
      const user = db.users.find(
        (u) => u.tenant_id === authReq.tenantId && u.email.toLowerCase() === normalizedEmail
      );
      if (!user) {
        throw new AppError({ status: 400, code: 'INVALID_RESET_CODE', message: 'Invalid or expired recovery code.' });
      }

      const otp = [...db.otp_verifications]
        .reverse()
        .find(
          (o) =>
            o.tenant_id === authReq.tenantId &&
            o.user_id === user.id &&
            o.purpose === 'reset_password' &&
            !o.verified_at
        );

      if (!otp || new Date(otp.expires_at).getTime() < now) {
        throw new AppError({ status: 400, code: 'INVALID_RESET_CODE', message: 'Recovery code is invalid or expired.' });
      }
      if (otp.attempts >= 5) {
        throw new AppError({ status: 429, code: 'OTP_LOCKED', message: 'Too many invalid attempts. Request a new code.' });
      }

      otp.attempts += 1;
      if (otp.code_hash !== sha256(code)) {
        throw new AppError({ status: 400, code: 'INVALID_RESET_CODE', message: 'Invalid 6-digit recovery code.' });
      }

      otp.verified_at = new Date().toISOString();
      user.password_hash = hashPassword(new_password);
      user.updated_at = new Date().toISOString();

      // Revoke active sessions on password reset
      db.user_sessions.forEach((s) => {
        if (s.user_id === user.id && !s.revoked_at) {
          s.revoked_at = new Date().toISOString();
        }
      });

      return user.id;
    });

    await recordAuditLog({
      tenantId: authReq.tenantId,
      actorUserId: updatedUserId,
      action: 'auth.password_reset',
      entityType: 'users',
      entityId: updatedUserId,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { reset: true } });
  } catch (err) {
    next(err);
  }
});

// Allows an already-authenticated Super Admin to switch into a preview session for any seeded role
authRouter.post('/role-preview', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const { target_role } = z
      .object({ target_role: z.enum(['super_admin', 'moderator', 'staff', 'vendor', 'customer']) })
      .parse(req.body);

    const db = dbStore.snapshot();
    if (authReq.authUser!.user_type !== 'super_admin') {
      throw new AppError({ status: 403, code: 'FORBIDDEN', message: 'Only Super Admin sessions may inspect role views' });
    }

    const targetUser = db.users.find(
      (u) => u.tenant_id === authReq.tenantId && u.user_type === target_role
    );
    if (!targetUser) {
      throw new AppError({ status: 404, code: 'ROLE_USER_NOT_FOUND', message: 'Sample user for this role not found' });
    }

    const sessionResult = await dbStore.withTransaction((txDb) => {
      const sessionId = crypto.randomUUID();
      txDb.user_sessions.push({
        id: sessionId,
        tenant_id: targetUser.tenant_id,
        user_id: targetUser.id,
        refresh_token_hash: sha256(crypto.randomBytes(32).toString('hex')),
        ip_address: req.ip || '127.0.0.1',
        user_agent: `${req.headers['user-agent'] || 'browser'} [admin-preview]`,
        expires_at: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
        revoked_at: null,
        created_at: new Date().toISOString(),
      });
      const accessToken = signAccessToken({
        sub: targetUser.id,
        tid: targetUser.tenant_id,
        role: targetUser.user_type,
        sid: sessionId,
      });
      return { accessToken };
    });

    res.json({
      success: true,
      data: {
        accessToken: sessionResult.accessToken,
        user: toSafeUserDTO(targetUser),
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  res.json({ success: true, data: { user: authReq.authUser } });
});

authRouter.patch('/preferences', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const parsed = z
      .object({
        preferred_locale: z.enum(['ar', 'en']).optional(),
        preferred_theme: z.enum(['light', 'dark', 'brand', 'system']).optional(),
      })
      .parse(req.body);

    const updated = await dbStore.withTransaction((db) => {
      const user = db.users.find((u) => u.id === authReq.authUser!.id);
      if (!user) throw new AppError({ status: 404, code: 'NOT_FOUND', message: 'User not found' });
      if (parsed.preferred_locale) user.preferred_locale = parsed.preferred_locale;
      if (parsed.preferred_theme) user.preferred_theme = parsed.preferred_theme;
      user.updated_at = new Date().toISOString();
      return toSafeUserDTO(user);
    });

    res.json({ success: true, data: { user: updated } });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/sidebar', requireAuth, (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.authUser!;
    const db = dbStore.snapshot();

    const scopeMap: Record<string, string> = {
      super_admin: 'admin',
      moderator: 'moderator',
      staff: 'staff',
      vendor: 'vendor',
      customer: 'customer',
    };
    const nativeScope = scopeMap[user.user_type] || 'customer';
    const requestedScope = (req.query.scope as string) || nativeScope;

    if (user.user_type !== 'super_admin' && requestedScope !== nativeScope) {
      throw new AppError({
        status: 403,
        code: 'FORBIDDEN',
        message: `Role ${user.user_type} cannot access ${requestedScope} navigation scope`,
      });
    }

    const menuTenantId = user.user_type === 'super_admin'
      ? db.users.find((candidate) => candidate.id === user.id)?.tenant_id || authReq.tenantId
      : authReq.tenantId;
    const items = db.sidebar_menus
      .filter(
        (m) =>
          m.tenant_id === menuTenantId &&
          m.dashboard_scope === requestedScope &&
          m.is_active &&
          (user.user_type === 'super_admin' || user.permissions.includes(m.required_permission))
      )
      .sort((a, b) => a.sort_order - b.sort_order);

    res.json({ success: true, data: { scope: requestedScope, items } });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/sessions', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const db = dbStore.snapshot();
  const sessions = db.user_sessions
    .filter((s) => s.user_id === authReq.authUser!.id && !s.revoked_at)
    .map((s) => ({
      id: s.id,
      ip_address: s.ip_address,
      user_agent: s.user_agent,
      created_at: s.created_at,
      expires_at: s.expires_at,
      is_current: s.id === authReq.sessionId,
    }));
  res.json({ success: true, data: { sessions } });
});

authRouter.delete('/sessions/:id', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    await dbStore.withTransaction((db) => {
      const session = db.user_sessions.find(
        (s) => s.id === req.params.id && s.user_id === authReq.authUser!.id
      );
      if (session) session.revoked_at = new Date().toISOString();
    });
    res.json({ success: true, data: { revoked: true } });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    await dbStore.withTransaction((db) => {
      const session = db.user_sessions.find((s) => s.id === authReq.sessionId);
      if (session) session.revoked_at = new Date().toISOString();
    });
    res.json({ success: true, data: { logged_out: true } });
  } catch (err) {
    next(err);
  }
});

// GDPR Right to Access (Export) & Erasure
authRouter.get('/gdpr/export', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const db = dbStore.snapshot();
    const userId = authReq.authUser!.id;
    const exportBundle = {
      exported_at: new Date().toISOString(),
      profile: authReq.authUser,
      orders: db.orders.filter((o) => o.customer_id === userId),
      sessions: db.user_sessions
        .filter((s) => s.user_id === userId)
        .map((s) => ({ id: s.id, ip_address: s.ip_address, created_at: s.created_at })),
    };

    await recordAuditLog({
      tenantId: authReq.tenantId,
      actorUserId: userId,
      action: 'gdpr.export',
      entityType: 'users',
      entityId: userId,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: exportBundle });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/gdpr/erase', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.authUser!.id;
    if (authReq.authUser!.user_type === 'super_admin') {
      throw new AppError({ status: 400, code: 'CANNOT_ERASE_ADMIN', message: 'Super admin cannot be erased via self-service.' });
    }
    await dbStore.withTransaction((db) => {
      const user = db.users.find((u) => u.id === userId);
      if (!user) return;
      user.full_name = 'Anonymized User';
      user.email = `erased-${user.id.slice(0, 8)}@anonymized.local`;
      user.phone = null;
      user.status = 'banned';
      user.password_hash = '';
      db.user_sessions.forEach((s) => {
        if (s.user_id === userId) s.revoked_at = new Date().toISOString();
      });
    });

    await recordAuditLog({
      tenantId: authReq.tenantId,
      actorUserId: userId,
      action: 'gdpr.erasure',
      entityType: 'users',
      entityId: userId,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { anonymized: true } });
  } catch (err) {
    next(err);
  }
});

export interface SavedAddressItem {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  city: string;
  street: string;
  postal_code: string;
  is_default: boolean;
}

const addressInputSchema = z.object({
  label: z.string().min(1).max(60).default('المنزل / Home'),
  full_name: z.string().min(2).max(120),
  phone: z.string().min(7).max(30),
  city: z.string().min(2).max(100),
  street: z.string().min(3).max(200),
  postal_code: z.string().min(3).max(20),
  is_default: z.boolean().optional().default(false),
});

function readCustomerAddresses(db: ReturnType<typeof dbStore.snapshot>, tenantId: string, userId: string): SavedAddressItem[] {
  const key = `customer_addresses:${userId}`;
  const setting = db.system_settings.find(
    (s) => s.tenant_id === tenantId && s.setting_group === 'general' && s.setting_key === key
  );
  if (setting && Array.isArray(setting.setting_value)) {
    return setting.setting_value as SavedAddressItem[];
  }
  const latestOrder = db.orders.find((o) => o.tenant_id === tenantId && o.customer_id === userId);
  if (latestOrder?.shipping_address) {
    return [
      {
        id: `addr-${latestOrder.id}`,
        label: 'العنوان الافتراضي | Primary',
        full_name: latestOrder.shipping_address.full_name,
        phone: latestOrder.shipping_address.phone,
        city: latestOrder.shipping_address.city,
        street: latestOrder.shipping_address.street,
        postal_code: latestOrder.shipping_address.postal_code,
        is_default: true,
      },
    ];
  }
  return [];
}

function writeCustomerAddresses(
  db: ReturnType<typeof dbStore.snapshot>,
  tenantId: string,
  userId: string,
  addresses: SavedAddressItem[]
): void {
  const key = `customer_addresses:${userId}`;
  const nowIso = new Date().toISOString();
  const existing = db.system_settings.find(
    (s) => s.tenant_id === tenantId && s.setting_group === 'general' && s.setting_key === key
  );
  if (existing) {
    existing.setting_value = addresses;
    existing.updated_by = userId;
    existing.updated_at = nowIso;
  } else {
    db.system_settings.push({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      setting_group: 'general',
      setting_key: key,
      setting_value: addresses,
      is_public: false,
      updated_by: userId,
      updated_at: nowIso,
    });
  }
}

authRouter.get('/addresses', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const db = dbStore.snapshot();
  const addresses = readCustomerAddresses(db, authReq.tenantId, authReq.authUser!.id);
  res.json({ success: true, data: { addresses } });
});

authRouter.post('/addresses', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const parsed = addressInputSchema.parse(req.body);
    const addresses = await dbStore.withTransaction((db) => {
      const current = readCustomerAddresses(db, authReq.tenantId, authReq.authUser!.id);
      const makeDefault = parsed.is_default || current.length === 0;
      const nextList = current.map((a) => (makeDefault ? { ...a, is_default: false } : a));
      nextList.push({
        id: crypto.randomUUID(),
        label: parsed.label,
        full_name: parsed.full_name,
        phone: parsed.phone,
        city: parsed.city,
        street: parsed.street,
        postal_code: parsed.postal_code,
        is_default: makeDefault,
      });
      writeCustomerAddresses(db, authReq.tenantId, authReq.authUser!.id, nextList);
      return nextList;
    });
    res.status(201).json({ success: true, data: { addresses } });
  } catch (err) {
    next(err);
  }
});

authRouter.patch('/addresses/:id', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const parsed = addressInputSchema.partial().parse(req.body);
    const addresses = await dbStore.withTransaction((db) => {
      const current = readCustomerAddresses(db, authReq.tenantId, authReq.authUser!.id);
      const idx = current.findIndex((a) => a.id === req.params.id);
      if (idx === -1) {
        throw new AppError({ status: 404, code: 'ADDRESS_NOT_FOUND', message: 'Shipping address not found' });
      }
      const nextList = current.map((a, i) => {
        if (i === idx) {
          return { ...a, ...parsed };
        }
        return parsed.is_default ? { ...a, is_default: false } : a;
      });
      writeCustomerAddresses(db, authReq.tenantId, authReq.authUser!.id, nextList);
      return nextList;
    });
    res.json({ success: true, data: { addresses } });
  } catch (err) {
    next(err);
  }
});

authRouter.delete('/addresses/:id', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const addresses = await dbStore.withTransaction((db) => {
      const current = readCustomerAddresses(db, authReq.tenantId, authReq.authUser!.id);
      const filtered = current.filter((a) => a.id !== req.params.id);
      if (filtered.length > 0 && !filtered.some((a) => a.is_default)) {
        filtered[0] = { ...filtered[0], is_default: true };
      }
      writeCustomerAddresses(db, authReq.tenantId, authReq.authUser!.id, filtered);
      return filtered;
    });
    res.json({ success: true, data: { addresses } });
  } catch (err) {
    next(err);
  }
});
