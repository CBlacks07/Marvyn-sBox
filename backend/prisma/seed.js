import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  { slug: 'figurines', label: 'Figurines', initial: 'F', order: 1 },
  { slug: 'manga', label: 'Manga & Light Novels', initial: 'M', order: 2 },
  { slug: 'snacks', label: 'Snacks japonais', initial: 'S', order: 3 },
  { slug: 'street', label: 'Streetwear', initial: 'W', order: 4 },
  { slug: 'goodies', label: 'Accessoires & Goodies', initial: 'G', order: 5 },
];

const PRODUCTS = [
  { name: 'Nendoroid Ninja Shadow', category: 'figurines', price: 26000, badge: 'Nouveau', stock: 18, description: "Figurine articulée 10cm avec accessoires interchangeables et socle d'exposition." },
  { name: 'Chibi Samouraï Deluxe', category: 'figurines', price: 23000, badge: null, stock: 22, description: "Statuette peinte à la main, édition numérotée avec certificat d'authenticité." },
  { name: 'Coffret Manga Tomes 1-3', category: 'manga', price: 16500, badge: 'Best-seller', stock: 30, description: "Intégrale des trois premiers tomes en édition collector avec jaquette illustrée." },
  { name: 'Light Novel Isekai Chronicles', category: 'manga', price: 10000, badge: null, stock: 25, description: "Roman illustré, traduction française, format poche avec illustrations couleur." },
  { name: 'Ramen Instantané Tonkotsu', category: 'snacks', price: 3000, badge: null, stock: 60, description: "Nouilles japonaises authentiques, bouillon riche au porc, prêt en 3 minutes." },
  { name: 'Assortiment Mochi Fraise & Matcha', category: 'snacks', price: 6500, badge: 'Nouveau', stock: 40, description: "Boîte de 8 mochis fondants, parfums fraise et matcha, importés du Japon." },
  { name: 'Kit Snacks Konbini', category: 'snacks', price: 13000, badge: null, stock: 15, description: "Sélection de 10 snacks salés et sucrés typiques des supérettes japonaises." },
  { name: 'Hoodie Kanji Oversize', category: 'street', price: 29500, badge: null, stock: 12, description: "Sweat à capuche coupe oversize, broderie kanji, coton épais 320g." },
  { name: 'T-shirt Wave Otaku', category: 'street', price: 16500, badge: 'Best-seller', stock: 28, description: "T-shirt unisexe 100% coton bio, impression vague inspirée de l'ukiyo-e." },
  { name: 'Casquette Sakura', category: 'goodies', price: 13000, badge: null, stock: 20, description: "Casquette brodée fleur de cerisier, visière incurvée, taille ajustable." },
  { name: 'Porte-clés Acrylique Chibi', category: 'goodies', price: 5000, badge: null, stock: 50, description: "Porte-clés double face en acrylique, illustration chibi exclusive." },
  { name: 'Tote Bag Otaku Club', category: 'goodies', price: 8500, badge: null, stock: 33, description: "Tote bag en toile épaisse, impression logo, format 38x42cm." },
];

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD manquants dans .env');

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });
  console.log(`Compte admin prêt : ${email}`);

  for (const cat of CATEGORIES) {
    await prisma.category.upsert({ where: { slug: cat.slug }, update: cat, create: cat });
  }
  console.log(`${CATEGORIES.length} catégories prêtes.`);

  const count = await prisma.product.count();
  if (count === 0) {
    await prisma.product.createMany({ data: PRODUCTS });
    console.log(`${PRODUCTS.length} articles insérés.`);
  } else {
    console.log(`${count} articles déjà présents, seed produits ignoré.`);
  }

  await prisma.siteSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  console.log('Paramètres du site prêts.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
