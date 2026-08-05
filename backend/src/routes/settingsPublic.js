import { Router } from 'express';
import { prisma } from '../prisma.js';

export const settingsPublicRouter = Router();

settingsPublicRouter.get('/', async (req, res) => {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  res.json(settings);
});
