import { Router } from 'express';
import { prisma } from '../prisma.js';

export const ordersAdminRouter = Router();

const VALID_STATUSES = ['pending', 'confirmed', 'cancelled'];

function serialize(order) {
  return {
    id: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    status: order.status,
    total: Number(order.total),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.map((it) => ({
      productId: it.productId,
      name: it.name,
      price: Number(it.price),
      qty: it.qty,
    })),
  };
}

ordersAdminRouter.get('/', async (req, res) => {
  const orders = await prisma.order.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders.map(serialize));
});

ordersAdminRouter.patch('/:id/status', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Id invalide' });

  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  if (order.status === status) return res.json(serialize(order));

  const stockOps = [];

  // pending -> confirmed : on déduit le stock des articles commandés
  if (status === 'confirmed' && order.status !== 'confirmed') {
    for (const it of order.items) {
      if (!it.productId) continue;
      stockOps.push({ productId: it.productId, delta: -it.qty, reason: `Commande #${order.id} confirmée` });
    }
  }
  // confirmed -> cancelled : on restitue le stock déjà déduit
  if (status === 'cancelled' && order.status === 'confirmed') {
    for (const it of order.items) {
      if (!it.productId) continue;
      stockOps.push({ productId: it.productId, delta: it.qty, reason: `Commande #${order.id} annulée` });
    }
  }

  const ops = [prisma.order.update({ where: { id }, data: { status } })];

  for (const op of stockOps) {
    const product = await prisma.product.findUnique({ where: { id: op.productId } });
    if (!product) continue;
    const nextStock = Math.max(0, product.stock + op.delta);
    const actualDelta = nextStock - product.stock;
    ops.push(prisma.product.update({ where: { id: op.productId }, data: { stock: nextStock } }));
    if (actualDelta !== 0) {
      ops.push(
        prisma.stockMovement.create({
          data: { productId: op.productId, delta: actualDelta, resultingStock: nextStock, reason: op.reason },
        })
      );
    }
  }

  await prisma.$transaction(ops);

  const updated = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  res.json(serialize(updated));
});
