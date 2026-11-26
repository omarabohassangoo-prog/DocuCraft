import { decryptSecret } from './crypto.ts';
import type { DatabaseSchema } from '../../shared/types.ts';

/**
 * Resolves a sensitive integration secret on the server only.
 * Precedence:
 * 1. process.env[envKey] (runtime secret / Cloud Run / Vercel Env)
 * 2. Tenant's AES-256-GCM encrypted vault record in database (decrypted in memory only)
 */
export function resolveTenantSecret(
  db: DatabaseSchema,
  tenantId: string,
  envKey: string
): string | null {
  const envVal = process.env[envKey];
  if (envVal && envVal.trim().length > 0) {
    return envVal.trim();
  }

  const record = db.encrypted_secrets.find(
    (s) => s.tenant_id === tenantId && s.env_key === envKey
  );
  if (!record) return null;

  try {
    const plain = decryptSecret(
      {
        ciphertext: record.ciphertext,
        iv: record.iv,
        auth_tag: record.auth_tag,
      },
      tenantId
    );
    return plain && plain.trim().length > 0 ? plain.trim() : null;
  } catch {
    return null;
  }
}

export function resolveSettingValue(
  db: DatabaseSchema,
  tenantId: string,
  group: string,
  key: string
): string | null {
  const setting = db.system_settings.find(
    (s) => s.tenant_id === tenantId && s.setting_group === group && s.setting_key === key
  );
  if (!setting || setting.setting_value === null || setting.setting_value === undefined) {
    return null;
  }
  return String(setting.setting_value).trim() || null;
}
