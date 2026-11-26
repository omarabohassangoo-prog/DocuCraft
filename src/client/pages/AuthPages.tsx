import React, { useState } from 'react';
import { Shield, KeyRound, UserPlus } from 'lucide-react';
import type { SafeUserDTO, UserRoleType } from '../../shared/types.ts';
import { apiRequest } from '../lib/api.ts';
import { useApp } from '../context/AppContext.tsx';
import { t } from '../i18n/dictionary.ts';

export const AuthPages: React.FC<{ mode: 'login' | 'register' | 'forgot' }> = ({ mode }) => {
  const { locale, navigate, setAuthSession, authStatus, notify } = useApp();

  // First-Run Super Admin Bootstrap form
  const [adminPassword, setAdminPassword] = useState('');
  const [adminFullName, setAdminFullName] = useState('طلال المنصور | Talal Al-Mansour');

  // Login & 2FA challenge state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');

  // Register state
  const [regForm, setRegForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    account_type: 'customer' as 'customer' | 'vendor',
    store_name: '',
  });

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const redirectToRoleDashboard = (role: UserRoleType) => {
    const map: Record<UserRoleType, string> = {
      super_admin: '/dashboard/admin',
      moderator: '/dashboard/moderator',
      staff: '/dashboard/staff',
      vendor: '/dashboard/vendor',
      customer: '/dashboard/customer',
    };
    navigate(map[role] || '/dashboard/customer');
  };

  const handleBootstrapAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest<{ accessToken: string; user: SafeUserDTO }>('/auth/bootstrap-admin', {
        method: 'POST',
        body: JSON.stringify({ password: adminPassword, full_name: adminFullName }),
      });
      setAuthSession(res.accessToken, res.user);
      notify(locale === 'ar' ? 'تم تفعيل حساب المدير العام بنجاح' : 'Super Admin workspace claimed', 'success');
      redirectToRoleDashboard(res.user.user_type);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Bootstrap failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest<{
        requires_2fa: boolean;
        challenge_token?: string;
        accessToken?: string;
        user?: SafeUserDTO;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.requires_2fa && res.challenge_token) {
        setChallengeToken(res.challenge_token);
        return;
      }
      if (res.accessToken && res.user) {
        setAuthSession(res.accessToken, res.user);
        redirectToRoleDashboard(res.user.user_type);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Invalid credentials', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{ accessToken: string; user: SafeUserDTO }>('/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ challenge_token: challengeToken, code: totpCode }),
      });
      setAuthSession(res.accessToken, res.user);
      redirectToRoleDashboard(res.user.user_type);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Invalid 2FA code', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest<{ accessToken: string; user: SafeUserDTO }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(regForm),
      });
      setAuthSession(res.accessToken, res.user);
      notify(locale === 'ar' ? 'تم إنشاء الحساب بنجاح' : 'Account created successfully', 'success');
      redirectToRoleDashboard(res.user.user_type);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Registration failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotSent(true);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Request failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'forgot') {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <form
          onSubmit={handleForgot}
          className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-7 space-y-5"
        >
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{t(locale, 'forgot_password')}</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              {locale === 'ar'
                ? 'أدخل بريدك الإلكتروني لإرسال رمز التحقق المؤقت.'
                : 'Enter your email address to queue a one-time recovery code.'}
            </p>
          </div>
          {forgotSent ? (
            <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              {locale === 'ar'
                ? 'إذا كان البريد مسجلاً لدينا، فقد تم إرسال تعليمات الاستعادة.'
                : 'If the email is registered, recovery instructions have been dispatched.'}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, 'email')}</label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2.5 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white"
              >
                {t(locale, 'send_reset_link')}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => navigate('/auth/login')}
            className="w-full text-center text-xs font-medium text-[var(--brand-primary)] hover:underline"
          >
            {t(locale, 'nav_signin')}
          </button>
        </form>
      </div>
    );
  }

  if (mode === 'register') {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <form
          onSubmit={handleRegister}
          className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-7 space-y-5"
        >
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[var(--brand-primary)]" />
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{t(locale, 'create_account')}</h1>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(['customer', 'vendor'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setRegForm({ ...regForm, account_type: type })}
                className={`rounded-xl border p-3 text-xs font-semibold transition-colors ${
                  regForm.account_type === type
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                    : 'border-[var(--border-hairline)] text-[var(--text-secondary)]'
                }`}
              >
                {type === 'customer' ? t(locale, 'account_customer') : t(locale, 'account_vendor')}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, 'full_name')}</label>
              <input
                required
                value={regForm.full_name}
                onChange={(e) => setRegForm({ ...regForm, full_name: e.target.value })}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
              />
            </div>
            {regForm.account_type === 'vendor' && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, 'store_name')}</label>
                <input
                  required
                  value={regForm.store_name}
                  onChange={(e) => setRegForm({ ...regForm, store_name: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
                />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, 'email')}</label>
                <input
                  type="email"
                  required
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, 'phone')}</label>
                <input
                  value={regForm.phone}
                  onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, 'password')}</label>
              <input
                type="password"
                required
                minLength={8}
                value={regForm.password}
                onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            {t(locale, 'create_account')}
          </button>

          <button
            type="button"
            onClick={() => navigate('/auth/login')}
            className="w-full text-center text-xs font-medium text-[var(--brand-primary)] hover:underline"
          >
            {t(locale, 'nav_signin')}
          </button>
        </form>
      </div>
    );
  }

  // Login or 2FA Challenge
  if (challengeToken) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <form
          onSubmit={handleVerify2FA}
          className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-7 space-y-5"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[var(--brand-primary)]" />
            <h1 className="text-xl font-bold text-[var(--text-primary)]">{t(locale, 'verify_2fa_title')}</h1>
          </div>
          <input
            type="text"
            required
            maxLength={6}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-4 py-3 text-center text-2xl font-mono-tabular tracking-[0.4em]"
          />
          <button
            type="submit"
            disabled={submitting || totpCode.length !== 6}
            className="w-full rounded-xl bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white disabled:opacity-45"
          >
            {t(locale, 'verify_code')}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
      {/* First-Run Admin Claim Card when unclaimed */}
      {authStatus?.needsAdminBootstrap && (
        <form
          onSubmit={handleBootstrapAdmin}
          className="rounded-2xl border border-[var(--brand-primary)]/40 bg-[var(--surface-card)] p-7 space-y-4 shadow-sm"
        >
          <div className="flex items-center gap-2 text-[var(--brand-primary)]">
            <Shield className="h-5 w-5" />
            <h2 className="text-lg font-bold">{t(locale, 'bootstrap_admin_title')}</h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {t(locale, 'bootstrap_admin_desc')}
          </p>
          <div className="rounded-lg bg-[var(--surface-muted)]/60 px-3 py-2 text-xs font-mono-tabular text-[var(--text-primary)]">
            {authStatus.adminEmail}
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, 'full_name')}</label>
            <input
              required
              value={adminFullName}
              onChange={(e) => setAdminFullName(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, 'password')}</label>
            <input
              type="password"
              required
              minLength={8}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder={locale === 'ar' ? '8 أحرف على الأقل' : 'Minimum 8 characters'}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            {t(locale, 'claim_admin_btn')}
          </button>
        </form>
      )}

      {/* Standard Email + Password Sign In */}
      <form
        onSubmit={handleLogin}
        className={`rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-7 space-y-5 ${
          authStatus?.needsAdminBootstrap ? '' : 'md:col-span-2 md:max-w-md md:mx-auto w-full'
        }`}
      >
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{t(locale, 'welcome_back')}</h1>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, 'email')}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t(locale, 'password')}</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
        >
          {t(locale, 'nav_signin')}
        </button>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => navigate('/auth/register')}
            className="font-semibold text-[var(--brand-primary)] hover:underline"
          >
            {t(locale, 'create_account')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/auth/forgot-password')}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            {t(locale, 'forgot_password')}
          </button>
        </div>
      </form>
    </div>
  );
};
