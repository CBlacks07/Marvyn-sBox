import { Router } from 'express';
import { prisma } from '../prisma.js';

export const categoriesPublicRouter = Router();

categoriesPublicRouter.get('/', async (req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  res.json(categories);
});
