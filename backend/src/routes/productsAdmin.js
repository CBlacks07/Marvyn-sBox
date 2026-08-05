import { Router } from 'express';
import { prisma } from '../prisma.js';
import { upload } from '../upload.js';

export const productsAdminRouter = Router();

function serialize(p) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    price: Number(p.price),
    description: p.description,
    imageUrl: p.imageUrl,
    badge: p.badge,
    stock: p.stock,
    active: p.active,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function parseBody(body) {
  return {
    name: body.name,
    category: body.category,
    price: body.price !== undefined ? Number(body.price) : undefined,
    description: body.description,
    badge: body.badge || null,
    stock: body.stock !== undefined ? Number(body.stock) : undefined,
    active: body.active !== undefined ? body.active === 'true' || body.active === true : undefined,
  };
}

async function categoryExists(slug) {
  if (!slug) return false;
  const c = await prisma.category.findUnique({ where: { slug } });
  return !!c;
}

productsAdminRouter.get('/', async (req, res) => {
  const products = await prisma.product.findMany({ orderBy: { id: 'asc' } });
  res.json(products.map(serialize));
});

productsAdminRouter.post('/', upload.single('image'), async (req, res) => {
  const data = parseBody(req.body);
  if (!data.name || !data.category || Number.isNaN(data.price)) {
    return res.status(400).json({ error: 'name, category et price sont requis' });
  }
  if (!(await categoryExists(data.category))) {
    return res.status(400).json({ error: 'Catégorie inconnue' });
  }

  const initialStock = Number.isInteger(data.stock) && data.stock > 0 ? data.stock : 0;

  const product = await prisma.product.create({
    data: {
      name: data.name,
      category: data.category,
      price: data.price,
      description: data.description || '',
      badge: data.badge,
      stock: initialStock,
      active: data.active ?? true,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
    },
  });

  if (initialStock > 0) {
    await prisma.stockMovement.create({
      data: { productId: product.id, delta: initialStock, resultingStock: initialStock, reason: 'Stock initial' },
    });
  }

  res.status(201).json(serialize(product));
});

productsAdminRouter.put('/:id', upload.single('image'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id invalide' });

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Produit introuvable' });

  const data = parseBody(req.body);
  if (data.category !== undefined && !(await categoryExists(data.category))) {
    return res.status(400).json({ error: 'Catégorie inconnue' });
  }

  // Le stock ne se modifie qu'via PATCH /:id/stock, pour garder un historique fiable des mouvements.
  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.category !== undefined && { category: data.category }),
      ...(!Number.isNaN(data.price) && data.price !== undefined && { price: data.price }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.badge !== undefined && { badge: data.badge }),
      ...(data.active !== undefined && { active: data.active }),
      ...(req.file && { imageUrl: `/uploads/${req.file.filename}` }),
    },
  });
  res.json(serialize(product));
});

productsAdminRouter.patch('/:id/stock', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id invalide' });

  const { stock, delta, reason } = req.body || {};
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Produit introuvable' });

  let nextStock;
  if (Number.isInteger(stock)) nextStock = Math.max(0, stock);
  else if (Number.isInteger(delta)) nextStock = Math.max(0, existing.stock + delta);
  else return res.status(400).json({ error: 'stock ou delta (entier) requis' });

  const actualDelta = nextStock - existing.stock;

  const [product] = await prisma.$transaction([
    prisma.product.update({ where: { id }, data: { stock: nextStock } }),
    ...(actualDelta !== 0
      ? [
          prisma.stockMovement.create({
            data: {
              productId: id,
              delta: actualDelta,
              resultingStock: nextStock,
              reason: reason || (actualDelta > 0 ? 'Réassort' : 'Ajustement manuel'),
            },
          }),
        ]
      : []),
  ]);

  res.json(serialize(product));
});

productsAdminRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id invalide' });

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Produit introuvable' });

  await prisma.product.delete({ where: { id } });
  res.status(204).end();
});
