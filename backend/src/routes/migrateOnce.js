import { Router } from 'express';
import { prisma } from '../prisma.js';

// TEMPORARY — one-off route to apply the 20260807105811_add_category_parent
// migration to production (no direct DB access available: DATABASE_URL /
// DIRECT_URL are Vercel "Sensitive" vars, write-only, unreadable via CLI).
// Idempotent by design. Remove this file + its mount in app.js right after use.
export const migrateOnceRouter = Router();

migrateOnceRouter.post('/', async (req, res) => {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "parentSlug" TEXT;`);
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "Category" ADD CONSTRAINT "Category_parentSlug_fkey"
          FOREIGN KEY ("parentSlug") REFERENCES "Category"("slug") ON DELETE SET NULL ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
