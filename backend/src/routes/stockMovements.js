import { Router } from 'express';
import { prisma } from '../prisma.js';

export const stockMovementsRouter = Router();

stockMovementsRouter.get('/', async (req, res) => {
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  const limit = Math.min(200, Number(req.query.limit) || 50);

  const movements = await prisma.stockMovement.findMany({
    where: productId ? { productId } : undefined,
    include: { product: { select: { name: true, imageUrl: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  res.json(
    movements.map((m) => ({
      id: m.id,
      productId: m.productId,
      productName: m.product.name,
      productImageUrl: m.product.imageUrl,
      delta: m.delta,
      resultingStock: m.resultingStock,
      reason: m.reason,
      createdAt: m.createdAt,
    }))
  );
});
