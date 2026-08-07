import { Router } from 'express';
import { prisma } from '../prisma.js';

export const categoriesAdminRouter = Router();

categoriesAdminRouter.get('/', async (req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { products: true, children: true } } },
  });
  res.json(categories.map((c) => ({
    ...c,
    productCount: c._count.products,
    childCount: c._count.children,
    _count: undefined,
  })));
});

// Resolves + validates a parentSlug value from a request body.
// Returns { ok: true, parentSlug } or { ok: false, error }.
async function resolveParentSlug(rawParentSlug, selfSlug) {
  if (rawParentSlug === undefined) return { ok: true, parentSlug: undefined };
  if (rawParentSlug === null || rawParentSlug === '') return { ok: true, parentSlug: null };

  const parentSlug = String(rawParentSlug);
  if (parentSlug === selfSlug) return { ok: false, error: 'Une catégorie ne peut pas être sa propre catégorie parente' };

  const parent = await prisma.category.findUnique({ where: { slug: parentSlug } });
  if (!parent) return { ok: false, error: 'Catégorie parente introuvable' };
  if (parent.parentSlug) return { ok: false, error: 'Une sous-catégorie ne peut pas être choisie comme catégorie parente (2 niveaux max)' };

  return { ok: true, parentSlug };
}

categoriesAdminRouter.post('/', async (req, res) => {
  const { slug, label, initial, order, parentSlug } = req.body || {};
  if (!slug || !label || !initial) {
    return res.status(400).json({ error: 'slug, label et initial sont requis' });
  }
  const cleanSlug = String(slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!cleanSlug) return res.status(400).json({ error: 'slug invalide' });

  const existing = await prisma.category.findUnique({ where: { slug: cleanSlug } });
  if (existing) return res.status(409).json({ error: 'Cette catégorie existe déjà' });

  const parentCheck = await resolveParentSlug(parentSlug, cleanSlug);
  if (!parentCheck.ok) return res.status(400).json({ error: parentCheck.error });

  const category = await prisma.category.create({
    data: {
      slug: cleanSlug,
      label,
      initial: initial.slice(0, 2).toUpperCase(),
      order: Number.isInteger(order) ? order : 99,
      parentSlug: parentCheck.parentSlug ?? null,
    },
  });
  res.status(201).json({ ...category, productCount: 0, childCount: 0 });
});

categoriesAdminRouter.put('/:slug', async (req, res) => {
  const { slug } = req.params;
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (!existing) return res.status(404).json({ error: 'Catégorie introuvable' });

  const { label, initial, order, parentSlug } = req.body || {};

  const parentCheck = await resolveParentSlug(parentSlug, slug);
  if (!parentCheck.ok) return res.status(400).json({ error: parentCheck.error });

  // A category that already has children can't become someone else's sub-category (2 levels max).
  if (parentCheck.parentSlug) {
    const childCount = await prisma.category.count({ where: { parentSlug: slug } });
    if (childCount > 0) {
      return res.status(400).json({ error: 'Cette catégorie a déjà des sous-catégories, elle ne peut pas devenir elle-même une sous-catégorie' });
    }
  }

  const category = await prisma.category.update({
    where: { slug },
    data: {
      ...(label !== undefined && { label }),
      ...(initial !== undefined && { initial: String(initial).slice(0, 2).toUpperCase() }),
      ...(Number.isInteger(order) && { order }),
      ...(parentCheck.parentSlug !== undefined && { parentSlug: parentCheck.parentSlug }),
    },
  });
  res.json(category);
});

categoriesAdminRouter.delete('/:slug', async (req, res) => {
  const { slug } = req.params;
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (!existing) return res.status(404).json({ error: 'Catégorie introuvable' });

  const productCount = await prisma.product.count({ where: { category: slug } });
  if (productCount > 0) {
    return res.status(409).json({ error: `${productCount} article(s) utilisent encore cette catégorie` });
  }

  const childCount = await prisma.category.count({ where: { parentSlug: slug } });
  if (childCount > 0) {
    return res.status(409).json({ error: `${childCount} sous-catégorie(s) dépendent encore de celle-ci` });
  }

  await prisma.category.delete({ where: { slug } });
  res.status(204).end();
});
