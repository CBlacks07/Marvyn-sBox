import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { put } from '@vercel/blob';

const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp']);

// On Vercel the filesystem is read-only/ephemeral, so uploaded images must go
// to Vercel Blob instead of local disk. Locally (no token configured), we keep
// writing to backend/uploads/ as before.
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

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
