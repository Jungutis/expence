import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { ensureCategories, generateCode } from '../lib/categories';

const router = Router();
router.use(authMiddleware);

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function validateFields(body: { label?: unknown; emoji?: unknown; color?: unknown; soft?: unknown }) {
  const { label, emoji, color, soft } = body;
  if (typeof label !== 'string' || !label.trim() || label.trim().length > 24) {
    return { error: 'Pavadinimas privalomas (iki 24 simbolių)' };
  }
  if (typeof emoji !== 'string' || !emoji.trim() || emoji.trim().length > 8) {
    return { error: 'Emoji privalomas' };
  }
  if (typeof color !== 'string' || !HEX_RE.test(color) || typeof soft !== 'string' || !HEX_RE.test(soft)) {
    return { error: 'Neteisingas spalvos formatas (#rrggbb)' };
  }
  return { label: label.trim(), emoji: emoji.trim(), color, soft };
}

// GET /api/categories — visos vartotojo kategorijos (pasėja default, jei nėra)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await ensureCategories(req.userId!);
    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// POST /api/categories — nauja custom kategorija
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const v = validateFields(req.body);
    if ('error' in v) {
      res.status(400).json({ error: v.error });
      return;
    }

    await ensureCategories(userId);
    const count = await prisma.category.count({ where: { userId } });
    if (count >= 20) {
      res.status(400).json({ error: 'Maksimalus kategorijų skaičius — 20' });
      return;
    }

    const code = await generateCode(userId, v.label!);
    const maxSort = await prisma.category.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });

    const category = await prisma.category.create({
      data: {
        userId,
        code,
        label: v.label!,
        emoji: v.emoji!,
        color: v.color!,
        soft: v.soft!,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// PUT /api/categories/:id — redaguoti (label/emoji/spalvos; kodas nekinta)
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const existing = await prisma.category.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Kategorija nerasta' });
      return;
    }

    const v = validateFields(req.body);
    if ('error' in v) {
      res.status(400).json({ error: v.error });
      return;
    }

    const category = await prisma.category.update({
      where: { id: existing.id },
      data: { label: v.label!, emoji: v.emoji!, color: v.color!, soft: v.soft! },
    });

    res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// DELETE /api/categories/:id — ištrina, jei nenaudojama; kitaip archyvuoja
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const existing = await prisma.category.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Kategorija nerasta' });
      return;
    }

    if (existing.code === 'MAISTAS') {
      res.status(400).json({ error: 'Maisto kategorijos ištrinti negalima — ją naudoja maisto biudžeto logika' });
      return;
    }

    const used = await prisma.expense.count({ where: { userId, category: existing.code } });
    if (used > 0) {
      const category = await prisma.category.update({
        where: { id: existing.id },
        data: { archived: true },
      });
      res.json({ archived: true, category });
      return;
    }

    // Nenaudojama — galima trinti kartu su susijusiais biudžetais/recurring
    await prisma.budget.deleteMany({ where: { userId, category: existing.code } });
    await prisma.recurringExpense.deleteMany({ where: { userId, category: existing.code } });
    await prisma.category.delete({ where: { id: existing.id } });
    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

export default router;
