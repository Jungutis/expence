import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authMiddleware);

const VALID_CATEGORIES = ['MAISTAS', 'KURAS', 'RUBAI', 'NEBUTINOS', 'BOLT_WOLT', 'KITOS'];
const VALID_BUDGET_KEYS = ['TOTAL', ...VALID_CATEGORIES];

// GET /api/budgets — visi vartotojo biudžetai
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const budgets = await prisma.budget.findMany({
      where: { userId: req.userId! },
      select: { category: true, amount: true },
    });
    res.json({ budgets });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// PUT /api/budgets — upsert { category, amount }; amount <= 0 ištrina limitą
router.put('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category, amount } = req.body;
    const userId = req.userId!;

    if (!category || !VALID_BUDGET_KEYS.includes(category)) {
      res.status(400).json({
        error: `Neteisinga kategorija. Galimos: ${VALID_BUDGET_KEYS.join(', ')}`,
      });
      return;
    }

    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      // Tuščia / nulinė reikšmė = limito pašalinimas
      await prisma.budget.deleteMany({ where: { userId, category } });
      res.json({ category, amount: null });
      return;
    }

    if (parsed > 1_000_000) {
      res.status(400).json({ error: 'Suma per didelė' });
      return;
    }

    const rounded = Math.round(parsed * 100) / 100;
    const budget = await prisma.budget.upsert({
      where: { userId_category: { userId, category } },
      create: { userId, category, amount: rounded },
      update: { amount: rounded },
      select: { category: true, amount: true },
    });

    res.json(budget);
  } catch (error) {
    console.error('Upsert budget error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

export default router;
