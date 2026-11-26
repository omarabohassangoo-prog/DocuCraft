import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { dbStore } from '../core/db.ts';
import { AppError } from '../core/errors.ts';
import {
  attachTenantAndAuth,
  requireAuth,
  recordAuditLog,
  type AuthRequest,
} from '../core/auth-guard.ts';
import { readStoredMediaBuffer, storeUploadedImage } from '../services/storage.service.ts';

export const mediaRouter = Router();
mediaRouter.use(attachTenantAndAuth);

const uploadSchema = z.object({
  filename: z.string().min(1).max(200),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  data_base64: z.string().min(16),
  alt_ar: z.string().max(200).optional(),
  alt_en: z.string().max(200).optional(),
});

mediaRouter.post('/upload', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid image payload. Expected filename, mime_type, and data_base64.',
        details: parsed.error.flatten(),
      });
    }

    const rawB64 = parsed.data.data_base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(rawB64, 'base64');

    const stored = await storeUploadedImage({
      db: dbStore.snapshot(),
      tenantId: authReq.tenantId,
      originalName: parsed.data.filename,
      mimeType: parsed.data.mime_type,
      buffer,
    });

    const nowIso = new Date().toISOString();
    const mediaId = crypto.randomUUID();
    const record = await dbStore.withTransaction((db) => {
      const item = {
        id: mediaId,
        tenant_id: authReq.tenantId,
        uploaded_by: authReq.authUser!.id,
        storage_driver: stored.driver,
        bucket_name: stored.bucketName,
        object_key: stored.objectKey,
        original_name: parsed.data.filename,
        mime_type: parsed.data.mime_type,
        size_bytes: buffer.length,
        width: null,
        height: null,
        variants_json: { original: `/api/v1/public/media/${mediaId}` },
        is_public: true,
        alt_text_i18n: parsed.data.alt_ar || parsed.data.alt_en
          ? { ar: parsed.data.alt_ar || parsed.data.filename, en: parsed.data.alt_en || parsed.data.filename }
          : null,
        created_at: nowIso,
      };
      db.media_files.unshift(item);
      return item;
    });

    await recordAuditLog({
      tenantId: authReq.tenantId,
      actorUserId: authReq.authUser!.id,
      action: 'media.uploaded',
      entityType: 'media_files',
      entityId: record.id,
      newValues: { storage_driver: record.storage_driver, size_bytes: record.size_bytes },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: {
        file: record,
        url: `/api/v1/public/media/${record.id}`,
      },
    });
  } catch (err) {
    next(err);
  }
});

export const publicMediaRouter = Router();
publicMediaRouter.use(attachTenantAndAuth);

publicMediaRouter.get('/:id', async (req, res, next) => {
  try {
    const db = dbStore.snapshot();
    const file = db.media_files.find((f) => f.id === req.params.id);
    if (!file || !file.is_public) {
      throw new AppError({ status: 404, code: 'MEDIA_NOT_FOUND', message: 'Media file not found' });
    }
    const buf = await readStoredMediaBuffer({
      db,
      tenantId: file.tenant_id,
      driver: file.storage_driver,
      bucketName: file.bucket_name,
      objectKey: file.object_key,
    });
    if (!buf) {
      throw new AppError({ status: 404, code: 'MEDIA_MISSING', message: 'Stored media object not found' });
    }
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buf);
  } catch (err) {
    next(err);
  }
});
