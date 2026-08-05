import { Router } from 'express';
import { prisma } from '../prisma.js';
import { upload, fileUrl } from '../upload.js';

export const settingsAdminRouter = Router();

const TEXT_FIELDS = [
  'colorBg', 'colorDark', 'colorAccent', 'colorAccentHover',
  'adminColorBg', 'adminColorSidebar', 'adminColorGold', 'adminColorAccent',
  'siteName', 'siteDescription', 'whatsappNumber',
  'heroEyebrow', 'heroTitle', 'heroSubtitle', 'heroBadgeLabel',
  'promoEyebrow', 'promoTitle', 'promoText', 'promoButtonLabel',
  'newsletterTitle', 'newsletterText',
  'footerShippingText', 'footerFaqText', 'footerContactText', 'copyrightText',
];

const HEX_FIELDS = [
  'colorBg', 'colorDark', 'colorAccent', 'colorAccentHover',
  'adminColorBg', 'adminColorSidebar', 'adminColorGold', 'adminColorAccent',
];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

settingsAdminRouter.get('/', async (req, res) => {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  res.json(settings);
});

settingsAdminRouter.put(
  '/',
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'heroImage', maxCount: 1 },
    { name: 'promoImage', maxCount: 1 },
  ]),
  async (req, res) => {
    const data = {};
    for (const key of TEXT_FIELDS) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }
    for (const key of HEX_FIELDS) {
      if (data[key] !== undefined && !HEX_RE.test(data[key])) {
        return res.status(400).json({ error: `${key} doit être une couleur hexadécimale valide (#RRGGBB)` });
      }
    }

    const files = req.files || {};
    if (files.logo?.[0]) data.logoUrl = await fileUrl(files.logo[0]);
    if (files.heroImage?.[0]) data.heroImageUrl = await fileUrl(files.heroImage[0]);
    if (files.promoImage?.[0]) data.promoImageUrl = await fileUrl(files.promoImage[0]);

    const settings = await prisma.siteSettings.update({ where: { id: 1 }, data });
    res.json(settings);
  }
);
