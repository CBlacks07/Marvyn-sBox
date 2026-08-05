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
import { requireAdmin } from './middleware/auth.js';

const app = express();
const PROJECT_ROOT = path.resolve('..');

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.resolve('uploads')));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/admin/login', loginLimiter);

const orderLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use('/api/orders', orderLimiter);

app.use('/api/admin', authRouter);
app.use('/api/products', productsPublicRouter);
app.use('/api/categories', categoriesPublicRouter);
app.use('/api/settings', settingsPublicRouter);
app.use('/api/orders', ordersPublicRouter);

app.use('/api/admin/products', requireAdmin, productsAdminRouter);
app.use('/api/admin/categories', requireAdmin, categoriesAdminRouter);
app.use('/api/admin/stock-movements', requireAdmin, stockMovementsRouter);
app.use('/api/admin/stats', requireAdmin, statsAdminRouter);
app.use('/api/admin/settings', requireAdmin, settingsAdminRouter);
app.use('/api/admin/orders', requireAdmin, ordersAdminRouter);

app.use('/admin', express.static(path.join(PROJECT_ROOT, 'admin')));
app.use(express.static(PROJECT_ROOT));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Erreur serveur' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Mervyn's Box API sur http://localhost:${PORT}`);
});
