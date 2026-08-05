import { Router } from 'express';
import { prisma } from '../prisma.js';

export const productsPublicRouter = Router();

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
  };
}

productsPublicRouter.get('/', async (req, res) => {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { id: 'asc' },
  });
  res.json(products.map(serialize));
});

productsPublicRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id invalide' });

  const product = await prisma.product.findFirst({ where: { id, active: true } });
  if (!product) return res.status(404).json({ error: 'Produit introuvable' });

  res.json(serialize(product));
});
