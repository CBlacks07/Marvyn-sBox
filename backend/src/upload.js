import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp']);

const storage = multer.diskStorage({
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
