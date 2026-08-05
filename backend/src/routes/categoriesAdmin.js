import { Router } from 'express';
import { prisma } from '../prisma.js';

export const categoriesAdminRouter = Router();

categoriesAdminRouter.get('/', async (req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  res.json(categories.map((c) => ({ ...c, productCount: c._count.products, _count: undefined })));
});

categoriesAdminRouter.post('/', async (req, res) => {
  const { slug, label, initial, order } = req.body || {};
  if (!slug || !label || !initial) {
    return res.status(400).json({ error: 'slug, label et initial sont requis' });
  }
  const cleanSlug = String(slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!cleanSlug) return res.status(400).json({ error: 'slug invalide' });

  const existing = await prisma.category.findUnique({ where: { slug: cleanSlug } });
  if (existing) return res.status(409).json({ error: 'Cette catégorie existe déjà' });

  const category = await prisma.category.create({
    data: { slug: cleanSlug, label, initial: initial.slice(0, 2).toUpperCase(), order: Number.isInteger(order) ? order : 99 },
  });
  res.status(201).json({ ...category, productCount: 0 });
});

categoriesAdminRouter.put('/:slug', async (req, res) => {
  const { slug } = req.params;
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (!existing) return res.status(404).json({ error: 'Catégorie introuvable' });

  const { label, initial, order } = req.body || {};
  const category = await prisma.category.update({
    where: { slug },
    data: {
      ...(label !== undefined && { label }),
      ...(initial !== undefined && { initial: String(initial).slice(0, 2).toUpperCase() }),
      ...(Number.isInteger(order) && { order }),
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

  await prisma.category.delete({ where: { slug } });
  res.status(204).end();
});
