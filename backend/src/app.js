import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';

import { authRouter } from './routes/auth.js';
import { productsPublicRouter } from './routes/productsPublic.js';
import { productsAdminRouter } from './routes/productsAdmin.js';
import { categoriesPublicRouter } from './routes/categoriesPublic.js';
import { categoriesAdminRouter } from './routes/categoriesAdmin.js';
import { stockMovementsRouter } from './routes/stockMovements.js';
import { statsAdminRouter } from './routes/statsAdmin.js';
import { settingsPublicRouter } from './routes/settingsPublic.js';
import { settingsAdminRouter } from './routes/settingsAdmin.js';
import { ordersPublicRouter } from './routes/ordersPublic.js';
import { ordersAdminRouter } from './routes/ordersAdmin.js';
import { newsletterPublicRouter } from './routes/newsletterPublic.js';
import { newsletterAdminRouter } from './routes/newsletterAdmin.js';
import { requireAdmin } from './middleware/auth.js';

// On Vercel, static files (public site, /admin, uploaded local files) are served
// directly by the platform's static layer — Express only needs to handle /api/*.
// Locally, this same app also serves the whole site (see server.js).
const IS_VERCEL = !!process.env.VERCEL;

export const app = express();
const PROJECT_ROOT = path.resolve('..');

// Vercel (and most hosts) sit behind a reverse proxy that sets X-Forwarded-For;
// without this, express-rate-limit can't reliably identify client IPs.
if (IS_VERCEL) app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

if (!IS_VERCEL) {
  app.use('/uploads', express.static(path.resolve('uploads')));
}

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/admin/login', loginLimiter);

const orderLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use('/api/orders', orderLimiter);

const newsletterLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/newsletter', newsletterLimiter);

app.use('/api/admin', authRouter);
app.use('/api/products', productsPublicRouter);
app.use('/api/categories', categoriesPublicRouter);
app.use('/api/settings', settingsPublicRouter);
app.use('/api/orders', ordersPublicRouter);
app.use('/api/newsletter', newsletterPublicRouter);

app.use('/api/admin/products', requireAdmin, productsAdminRouter);
app.use('/api/admin/categories', requireAdmin, categoriesAdminRouter);
app.use('/api/admin/stock-movements', requireAdmin, stockMovementsRouter);
app.use('/api/admin/stats', requireAdmin, statsAdminRouter);
app.use('/api/admin/settings', requireAdmin, settingsAdminRouter);
app.use('/api/admin/orders', requireAdmin, ordersAdminRouter);
app.use('/api/admin/newsletter', requireAdmin, newsletterAdminRouter);

if (!IS_VERCEL) {
  app.use('/admin', express.static(path.join(PROJECT_ROOT, 'admin')));
  app.use(express.static(PROJECT_ROOT));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Erreur serveur' });
});
