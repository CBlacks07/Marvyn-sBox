import { Router } from 'express';
import { prisma } from '../prisma.js';

export const newsletterAdminRouter = Router();

newsletterAdminRouter.get('/', async (req, res) => {
  const subscribers = await prisma.newsletterSubscriber.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json(subscribers);
});

newsletterAdminRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id invalide' });

  const existing = await prisma.newsletterSubscriber.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Abonné introuvable' });

  await prisma.newsletterSubscriber.delete({ where: { id } });
  res.status(204).end();
});
