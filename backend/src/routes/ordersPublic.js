import { Router } from 'express';
import { prisma } from '../prisma.js';

export const ordersPublicRouter = Router();

function serialize(order) {
  return {
    id: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    status: order.status,
    total: Number(order.total),
    createdAt: order.createdAt,
    items: order.items.map((it) => ({
      productId: it.productId,
      name: it.name,
      price: Number(it.price),
      qty: it.qty,
    })),
  };
}

ordersPublicRouter.post('/', async (req, res) => {
  const { customerName, customerPhone, items } = req.body || {};

  if (!customerName || !String(customerName).trim()) {
    return res.status(400).json({ error: 'Le nom est requis' });
  }
  if (!customerPhone || !String(customerPhone).trim()) {
    return res.status(400).json({ error: 'Le téléphone est requis' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Le panier est vide' });
  }

  const productIds = items
    .map((it) => Number(it.productId))
    .filter((id) => Number.isInteger(id));
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, active: true } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const orderItems = [];
  for (const it of items) {
    const product = productMap.get(Number(it.productId));
    const qty = Number(it.qty);
    if (!product || !Number.isInteger(qty) || qty <= 0) continue;
    orderItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty,
    });
  }

  if (orderItems.length === 0) {
    return res.status(400).json({ error: "Aucun article valide dans le panier" });
  }

  const total = orderItems.reduce((sum, it) => sum + Number(it.price) * it.qty, 0);

  const order = await prisma.order.create({
    data: {
      customerName: String(customerName).trim(),
      customerPhone: String(customerPhone).trim(),
      total,
      items: { create: orderItems },
    },
    include: { items: true },
  });

  res.status(201).json(serialize(order));
});
