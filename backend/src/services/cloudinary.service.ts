import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

type UploadInput = {
  userId: string;
  documentType: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
  folder?: string;
};

export type StoredFile = {
  publicId: string;
  secureUrl: string;
  resourceType: string;
  bytes: number;
  format: string;
  fileName: string;
};

export function cloudinaryConfigured() {
  return Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
}

function client() {
  if (!cloudinaryConfigured()) {
    throw new AppError(503, 'Cloudinary document storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env.');
  }

  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
  return cloudinary;
}

function safeName(value: string, fallback: string) {
  const normalized = value.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '').slice(0, 120);
  return normalized || fallback;
}

function resourceTypeFor(mimeType: string) {
  return mimeType.startsWith('image/') ? 'image' : 'raw';
}

function extensionFor(mimeType: string) {
  return ({
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  } as Record<string, string>)[mimeType] || '';
}

function cloudinaryError(error: unknown, action: string): never {
  const shaped = error as {
    http_code?: number;
    message?: string;
    error?: { http_code?: number; message?: string };
    headers?: Record<string, unknown>;
    request_id?: string;
  };
  const nested = shaped?.error;
  const status = Number(shaped?.http_code || nested?.http_code || 0);
  const message = String(shaped?.message || nested?.message || 'Unknown Cloudinary error');
  const headers = shaped?.headers || {};
  const xCldError = headers['x-cld-error'] || headers['X-Cld-Error'];
  const requestId = shaped?.request_id;
  console.error(`Cloudinary ${action} failed: HTTP: ${status || 'unknown'} Error: ${message}`);
  if (xCldError) console.error(`Cloudinary X-Cld-Error: ${String(xCldError)}`);
  if (requestId) console.error(`Cloudinary request id: ${requestId}`);
  if (status === 404) throw new AppError(404, `Cloudinary ${action} failed: ${message}`);
  throw new AppError(502, `Cloudinary ${action} failed: ${message}`);
}

export async function uploadFile(input: UploadInput): Promise<StoredFile> {
  const resourceType = resourceTypeFor(input.mimeType);
  const folder = input.folder || ('CPCL-Procure/bidders/user_' + safeName(input.userId, 'unknown') + '/' + safeName(input.documentType, 'Other'));
  const baseName = safeName(input.documentType, 'Document') + '_' + safeName(input.userId, 'user') + '_' + Date.now();
  const publicId = resourceType === 'raw' ? baseName + extensionFor(input.mimeType) : baseName;

  try {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      client().uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: resourceType,
          type: 'upload',
          overwrite: false,
          use_filename: false,
          unique_filename: false,
        },
        (error, response) => {
          if (error || !response) reject(error || new Error('Cloudinary returned no upload response'));
          else resolve(response);
        },
      ).end(input.buffer);
    });

    if (!result.public_id || !result.secure_url) throw new AppError(502, 'Cloudinary did not return document metadata.');
    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      resourceType: result.resource_type || resourceType,
      bytes: Number(result.bytes || input.fileSize),
      format: result.format || '',
      fileName: result.original_filename || input.originalFileName,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return cloudinaryError(error, 'upload');
  }
}

export async function deleteFile(publicId: string, resourceType = 'raw') {
  try {
    await client().uploader.destroy(publicId, { resource_type: resourceType, type: 'upload', invalidate: true });
  } catch (error) {
    const status = Number((error as { http_code?: number })?.http_code || (error as { error?: { http_code?: number } })?.error?.http_code || 0);
    if (status === 404) return;
    return cloudinaryError(error, 'deletion');
  }
}

export function getDeliveryUrl(publicId: string, resourceType = 'raw', download = false) {
  // This Cloudinary environment denies direct delivery URLs with an ACL failure.
  // Generate a short-lived, signed download URL server-side so API secrets never
  // reach the browser while authorized users can still view/download the asset.
  return client().utils.private_download_url(publicId, '', {
    resource_type: resourceType,
    type: 'upload',
    // Cloudinary's ACL policy permits the attachment form for both view and download.
    // The frontend opens the returned bytes as a Blob for View, so the browser can
    // still render PDFs inline without exposing a restricted delivery URL.
    attachment: true,
  });
}

/** Fetches a short-lived authorized copy into memory for downstream processing. */
export async function downloadFile(publicId: string, resourceType = 'raw') {
  const url = getDeliveryUrl(publicId, resourceType, false);
  const response = await fetch(url);
  if (!response.ok) throw new AppError(502, `Cloudinary document delivery failed with HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
