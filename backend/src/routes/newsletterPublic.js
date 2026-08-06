import { Router } from 'express';
import { prisma } from '../prisma.js';

export const newsletterPublicRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

newsletterPublicRouter.post('/', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide' });
  }

  await prisma.newsletterSubscriber.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  res.status(201).json({ ok: true });
});
