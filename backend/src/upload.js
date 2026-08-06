import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { put } from '@vercel/blob';

const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp']);

// On Vercel the filesystem is read-only/ephemeral, so uploaded images must go
// to Vercel Blob instead of local disk. Locally (no store connected), we keep
// writing to backend/uploads/ as before.
// A connected Blob store exposes credentials one of two ways: the classic
// BLOB_READ_WRITE_TOKEN, or (newer projects connected via OIDC) BLOB_STORE_ID
// paired with the platform-provided VERCEL_OIDC_TOKEN — @vercel/blob's put()
// picks either up automatically, so we only need to detect that one exists.
const USE_BLOB = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

const storage = USE_BLOB
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, path.resolve('uploads')),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, crypto.randomUUID() + ext);
      },
    });

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ACCEPTED.has(file.mimetype)) {
      return cb(new Error('Format d\'image non supporté (PNG, JPEG ou WebP uniquement)'));
    }
    cb(null, true);
  },
});

/** Resolves an uploaded multer file (disk or memory storage) to its public URL. */
export async function fileUrl(file) {
  if (!file) return null;
  if (USE_BLOB) {
    const ext = path.extname(file.originalname) || '.jpg';
    const blob = await put(crypto.randomUUID() + ext, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
    });
    return blob.url;
  }
  return `/uploads/${file.filename}`;
}
