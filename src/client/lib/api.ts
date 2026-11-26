// In-memory auth & guest tokens (zero browser localStorage/sessionStorage token persistence)
let accessTokenMemory: string | null = null;
let guestTokenMemory: string = `guest_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
let currentTenantId = '11111111-1111-4111-8111-111111111111';

export function setApiAccessToken(token: string | null) {
  accessTokenMemory = token;
}

export function getApiAccessToken(): string | null {
  return accessTokenMemory;
}

export function setApiTenantId(tenantId: string) {
  currentTenantId = tenantId;
}

export function getApiTenantId(): string {
  return currentTenantId;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Tenant-ID', currentTenantId);
  headers.set('X-Guest-Token', guestTokenMemory);
  if (accessTokenMemory) {
    headers.set('Authorization', `Bearer ${accessTokenMemory}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.detail ||
      payload?.title ||
      payload?.message ||
      `HTTP ${response.status}`;
    const code = payload?.code || 'API_ERROR';
    throw new ApiError(response.status, code, message, payload?.details);
  }

  if (payload && typeof payload === 'object' && 'data' in payload && payload.success !== undefined) {
    return payload.data as T;
  }
  return payload as T;
}

export async function apiRawRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('X-Tenant-ID', currentTenantId);
  headers.set('X-Guest-Token', guestTokenMemory);
  if (accessTokenMemory) {
    headers.set('Authorization', `Bearer ${accessTokenMemory}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`/api/v1${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.code || 'API_ERROR',
      payload?.detail || payload?.title || `HTTP ${response.status}`,
      payload?.details
    );
  }
  return payload as T;
}

export function exportRowsToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
) {
  const escapeCell = (cell: unknown) => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csv = [
    '\uFEFF' + headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
