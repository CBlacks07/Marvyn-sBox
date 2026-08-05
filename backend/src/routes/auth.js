import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) return res.status(401).json({ error: 'Identifiants invalides' });

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

  const token = jwt.sign({ sub: admin.id, email: admin.email }, process.env.JWT_SECRET, {
    expiresIn: '8h',
  });
  res.json({ token, email: admin.email });
});
