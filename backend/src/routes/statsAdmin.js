import { Router } from 'express';
import { prisma } from '../prisma.js';

export const statsAdminRouter = Router();

statsAdminRouter.get('/', async (req, res) => {
  const products = await prisma.product.findMany();
  const pendingOrders = await prisma.order.count({ where: { status: 'pending' } });

  const totalArticles = products.length;
  const activeArticles = products.filter((p) => p.active).length;
  const outOfStock = products.filter((p) => p.stock <= 0).length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const stockValue = products.reduce((sum, p) => sum + Number(p.price) * p.stock, 0);
  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);

  res.json({ totalArticles, activeArticles, outOfStock, lowStock, stockValue, totalUnits, pendingOrders });
});
