import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { dbStore } from '../core/db.ts';
import { resolveTenantSecret } from '../core/secrets.ts';
import type { DatabaseSchema, NotificationLogRecord } from '../../shared/types.ts';

export interface NotificationDispatchInput {
  tenantId: string;
  userId: string | null;
  channel: 'email' | 'sms' | 'whatsapp';
  recipient: string;
  subject?: string;
  htmlBody?: string;
  textBody: string;
}

async function logNotificationResult(record: Omit<NotificationLogRecord, 'id' | 'created_at'>): Promise<void> {
  await dbStore.withTransaction((db) => {
    db.notification_logs.unshift({
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...record,
    });
    if (db.notification_logs.length > 500) {
      db.notification_logs.length = 500;
    }
  });
}

async function sendRealEmail(
  db: DatabaseSchema,
  input: NotificationDispatchInput
): Promise<Omit<NotificationLogRecord, 'id' | 'created_at'>> {
  const fromEmail = process.env.EMAIL_FROM_ADDRESS || 'no-reply@ufuq.commerce';
  const fromName = process.env.EMAIL_FROM_NAME || 'Ufuq Commerce';
  const nowIso = new Date().toISOString();

  const resendKey = resolveTenantSecret(db, input.tenantId, 'RESEND_API_KEY');
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [input.recipient],
          subject: input.subject || 'Ufuq Commerce Notification',
          html: input.htmlBody || `<p>${input.textBody}</p>`,
          text: input.textBody,
        }),
      });
      const body = (await res.json()) as { id?: string; message?: string };
      return {
        tenant_id: input.tenantId,
        user_id: input.userId,
        channel: 'email',
        provider: 'resend',
        recipient: input.recipient,
        provider_message_id: body.id || null,
        status: res.ok ? 'sent' : 'failed',
        error_message: res.ok ? null : body.message || `Resend HTTP ${res.status}`,
        sent_at: res.ok ? nowIso : null,
      };
    } catch (err) {
      return {
        tenant_id: input.tenantId,
        user_id: input.userId,
        channel: 'email',
        provider: 'resend',
        recipient: input.recipient,
        provider_message_id: null,
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Resend network error',
        sent_at: null,
      };
    }
  }

  const sendgridKey = resolveTenantSecret(db, input.tenantId, 'SENDGRID_API_KEY');
  if (sendgridKey) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: input.recipient }] }],
          from: { email: fromEmail, name: fromName },
          subject: input.subject || 'Ufuq Commerce Notification',
          content: [{ type: 'text/plain', value: input.textBody }],
        }),
      });
      const msgId = res.headers.get('x-message-id');
      return {
        tenant_id: input.tenantId,
        user_id: input.userId,
        channel: 'email',
        provider: 'sendgrid',
        recipient: input.recipient,
        provider_message_id: msgId || null,
        status: res.ok ? 'sent' : 'failed',
        error_message: res.ok ? null : `SendGrid HTTP ${res.status}`,
        sent_at: res.ok ? nowIso : null,
      };
    } catch (err) {
      return {
        tenant_id: input.tenantId,
        user_id: input.userId,
        channel: 'email',
        provider: 'sendgrid',
        recipient: input.recipient,
        provider_message_id: null,
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'SendGrid network error',
        sent_at: null,
      };
    }
  }

  const smtpHost = resolveTenantSecret(db, input.tenantId, 'SMTP_HOST');
  const smtpUser = resolveTenantSecret(db, input.tenantId, 'SMTP_USER');
  const smtpPass = resolveTenantSecret(db, input.tenantId, 'SMTP_PASS');
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT || 587) === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: input.recipient,
        subject: input.subject || 'Ufuq Commerce Notification',
        text: input.textBody,
        html: input.htmlBody,
      });
      return {
        tenant_id: input.tenantId,
        user_id: input.userId,
        channel: 'email',
        provider: 'smtp',
        recipient: input.recipient,
        provider_message_id: info.messageId || null,
        status: 'sent',
        error_message: null,
        sent_at: nowIso,
      };
    } catch (err) {
      return {
        tenant_id: input.tenantId,
        user_id: input.userId,
        channel: 'email',
        provider: 'smtp',
        recipient: input.recipient,
        provider_message_id: null,
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'SMTP error',
        sent_at: null,
      };
    }
  }

  return {
    tenant_id: input.tenantId,
    user_id: input.userId,
    channel: 'email',
    provider: 'unconfigured',
    recipient: input.recipient,
    provider_message_id: null,
    status: 'failed',
    error_message: 'Email provider not configured (set RESEND_API_KEY, SENDGRID_API_KEY, or SMTP_* secrets).',
    sent_at: null,
  };
}

async function sendRealSms(
  db: DatabaseSchema,
  input: NotificationDispatchInput
): Promise<Omit<NotificationLogRecord, 'id' | 'created_at'>> {
  const nowIso = new Date().toISOString();
  const twilioSid = resolveTenantSecret(db, input.tenantId, 'TWILIO_ACCOUNT_SID');
  const twilioToken = resolveTenantSecret(db, input.tenantId, 'TWILIO_AUTH_TOKEN');
  const twilioFrom = resolveTenantSecret(db, input.tenantId, 'TWILIO_FROM_NUMBER');

  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const params = new URLSearchParams({
        To: input.recipient,
        From: twilioFrom,
        Body: input.textBody,
      });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const data = (await res.json()) as { sid?: string; message?: string };
      return {
        tenant_id: input.tenantId,
        user_id: input.userId,
        channel: 'sms',
        provider: 'twilio',
        recipient: input.recipient,
        provider_message_id: data.sid || null,
        status: res.ok ? 'sent' : 'failed',
        error_message: res.ok ? null : data.message || `Twilio HTTP ${res.status}`,
        sent_at: res.ok ? nowIso : null,
      };
    } catch (err) {
      return {
        tenant_id: input.tenantId,
        user_id: input.userId,
        channel: 'sms',
        provider: 'twilio',
        recipient: input.recipient,
        provider_message_id: null,
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Twilio network error',
        sent_at: null,
      };
    }
  }

  return {
    tenant_id: input.tenantId,
    user_id: input.userId,
    channel: 'sms',
    provider: 'unconfigured',
    recipient: input.recipient,
    provider_message_id: null,
    status: 'failed',
    error_message: 'SMS provider not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER).',
    sent_at: null,
  };
}

async function sendRealWhatsApp(
  db: DatabaseSchema,
  input: NotificationDispatchInput
): Promise<Omit<NotificationLogRecord, 'id' | 'created_at'>> {
  const nowIso = new Date().toISOString();
  const waToken = resolveTenantSecret(db, input.tenantId, 'WHATSAPP_ACCESS_TOKEN');
  const waPhoneId = resolveTenantSecret(db, input.tenantId, 'WHATSAPP_PHONE_NUMBER_ID');
  const apiVer = process.env.WHATSAPP_API_VERSION || 'v19.0';

  if (waToken && waPhoneId) {
    try {
      const toDigits = input.recipient.replace(/\D/g, '');
      const res = await fetch(`https://graph.facebook.com/${apiVer}/${waPhoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${waToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toDigits,
          type: 'text',
          text: { body: input.textBody },
        }),
      });
      const data = (await res.json()) as {
        messages?: { id?: string }[];
        error?: { message?: string };
      };
      return {
        tenant_id: input.tenantId,
        user_id: input.userId,
        channel: 'whatsapp',
        provider: 'whatsapp_cloud',
        recipient: input.recipient,
        provider_message_id: data.messages?.[0]?.id || null,
        status: res.ok ? 'sent' : 'failed',
        error_message: res.ok ? null : data.error?.message || `WhatsApp HTTP ${res.status}`,
        sent_at: res.ok ? nowIso : null,
      };
    } catch (err) {
      return {
        tenant_id: input.tenantId,
        user_id: input.userId,
        channel: 'whatsapp',
        provider: 'whatsapp_cloud',
        recipient: input.recipient,
        provider_message_id: null,
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'WhatsApp network error',
        sent_at: null,
      };
    }
  }

  return {
    tenant_id: input.tenantId,
    user_id: input.userId,
    channel: 'whatsapp',
    provider: 'unconfigured',
    recipient: input.recipient,
    provider_message_id: null,
    status: 'failed',
    error_message: 'WhatsApp Cloud API not configured (set WHATSAPP_ACCESS_TOKEN & WHATSAPP_PHONE_NUMBER_ID).',
    sent_at: null,
  };
}

export async function dispatchRealNotification(input: NotificationDispatchInput): Promise<void> {
  const db = dbStore.snapshot();
  let result: Omit<NotificationLogRecord, 'id' | 'created_at'>;
  if (input.channel === 'email') {
    result = await sendRealEmail(db, input);
  } else if (input.channel === 'sms') {
    result = await sendRealSms(db, input);
  } else {
    result = await sendRealWhatsApp(db, input);
  }
  await logNotificationResult(result);
}

export async function pingNotificationProvider(
  db: DatabaseSchema,
  tenantId: string,
  channel: 'email' | 'sms' | 'whatsapp'
): Promise<{ configured: boolean; status: 'verified' | 'auth_failed' | 'not_configured'; message: string; latency_ms: number }> {
  const started = Date.now();
  if (channel === 'email') {
    const resendKey = resolveTenantSecret(db, tenantId, 'RESEND_API_KEY');
    if (resendKey) {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${resendKey}` },
      });
      return {
        configured: true,
        status: res.ok ? 'verified' : 'auth_failed',
        message: res.ok ? 'Resend API key verified' : `Resend HTTP ${res.status}`,
        latency_ms: Date.now() - started,
      };
    }
    const sgKey = resolveTenantSecret(db, tenantId, 'SENDGRID_API_KEY');
    if (sgKey) {
      const res = await fetch('https://api.sendgrid.com/v3/user/profile', {
        headers: { Authorization: `Bearer ${sgKey}` },
      });
      return {
        configured: true,
        status: res.ok ? 'verified' : 'auth_failed',
        message: res.ok ? 'SendGrid API key verified' : `SendGrid HTTP ${res.status}`,
        latency_ms: Date.now() - started,
      };
    }
    return { configured: false, status: 'not_configured', message: 'RESEND_API_KEY / SENDGRID_API_KEY / SMTP missing', latency_ms: 0 };
  }

  if (channel === 'sms') {
    const sid = resolveTenantSecret(db, tenantId, 'TWILIO_ACCOUNT_SID');
    const tok = resolveTenantSecret(db, tenantId, 'TWILIO_AUTH_TOKEN');
    if (!sid || !tok) {
      return { configured: false, status: 'not_configured', message: 'TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing', latency_ms: 0 };
    }
    const auth = Buffer.from(`${sid}:${tok}`).toString('base64');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    return {
      configured: true,
      status: res.ok ? 'verified' : 'auth_failed',
      message: res.ok ? 'Twilio account verified' : `Twilio HTTP ${res.status}`,
      latency_ms: Date.now() - started,
    };
  }

  const waToken = resolveTenantSecret(db, tenantId, 'WHATSAPP_ACCESS_TOKEN');
  const waPhoneId = resolveTenantSecret(db, tenantId, 'WHATSAPP_PHONE_NUMBER_ID');
  if (!waToken || !waPhoneId) {
    return { configured: false, status: 'not_configured', message: 'WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing', latency_ms: 0 };
  }
  const apiVer = process.env.WHATSAPP_API_VERSION || 'v19.0';
  const res = await fetch(`https://graph.facebook.com/${apiVer}/${waPhoneId}`, {
    headers: { Authorization: `Bearer ${waToken}` },
  });
  return {
    configured: true,
    status: res.ok ? 'verified' : 'auth_failed',
    message: res.ok ? 'WhatsApp Cloud phone number verified' : `Meta Graph HTTP ${res.status}`,
    latency_ms: Date.now() - started,
  };
}
