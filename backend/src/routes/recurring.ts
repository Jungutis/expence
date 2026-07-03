import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { isValidCategory } from '../lib/categories';

const router = Router();
router.use(authMiddleware);

async function validateBody(userId: string, body: {
  category?: unknown;
  amount?: unknown;
  note?: unknown;
  dayOfMonth?: unknown;
}): Promise<{ error?: string; category?: string; amount?: number; note?: string | null; dayOfMonth?: number }> {
  const { category, amount, note, dayOfMonth } = body;

  if (!category || typeof category !== 'string' || !(await isValidCategory(userId, category))) {
    return { error: 'Neteisinga kategorija' };
  }

  const parsedAmount = parseFloat(String(amount));
  if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1_000_000) {
    return { error: 'Suma turi būti teigiamas skaičius' };
  }

  const parsedDay = parseInt(String(dayOfMonth), 10);
  if (isNaN(parsedDay) || parsedDay < 1 || parsedDay > 28) {
    return { error: 'Mėnesio diena turi būti 1–28 (kad tiktų visiems mėnesiams)' };
  }

  return {
    category: category as string,
    amount: Math.round(parsedAmount * 100) / 100,
    note: typeof note === 'string' && note.trim() ? note.trim() : null,
    dayOfMonth: parsedDay,
  };
}

// GET /api/recurring
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const items = await prisma.recurringExpense.findMany({
      where: { userId: req.userId! },
      orderBy: { dayOfMonth: 'asc' },
    });
    res.json({ recurring: items });
  } catch (error) {
    console.error('Get recurring error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// POST /api/recurring
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const v = await validateBody(req.userId!, req.body);
    if (v.error) {
      res.status(400).json({ error: v.error });
      return;
    }

    const item = await prisma.recurringExpense.create({
      data: {
        userId: req.userId!,
        category: v.category!,
        amount: v.amount!,
        note: v.note ?? null,
        dayOfMonth: v.dayOfMonth!,
      },
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Create recurring error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// PUT /api/recurring/:id — atnaujina laukus arba aktyvumą
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const existing = await prisma.recurringExpense.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Pasikartojanti išlaida nerasta' });
      return;
    }

    // Jei keičiamas tik aktyvumas — leidžiam be pilnos validacijos
    if (typeof req.body.active === 'boolean' && Object.keys(req.body).length === 1) {
      const item = await prisma.recurringExpense.update({
        where: { id },
        data: { active: req.body.active },
      });
      res.json(item);
      return;
    }

    const v = await validateBody(req.userId!, req.body);
    if (v.error) {
      res.status(400).json({ error: v.error });
      return;
    }

    const item = await prisma.recurringExpense.update({
      where: { id },
      data: {
        category: v.category!,
        amount: v.amount!,
        note: v.note ?? null,
        dayOfMonth: v.dayOfMonth!,
        ...(typeof req.body.active === 'boolean' ? { active: req.body.active } : {}),
      },
    });

    res.json(item);
  } catch (error) {
    console.error('Update recurring error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// DELETE /api/recurring/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const existing = await prisma.recurringExpense.findFirst({ where: { id, userId } });
    if (!existing) {
      res.status(404).json({ error: 'Pasikartojanti išlaida nerasta' });
      return;
    }

    await prisma.recurringExpense.delete({ where: { id } });
    res.json({ message: 'Pasikartojanti išlaida ištrinta' });
  } catch (error) {
    console.error('Delete recurring error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

export default router;
