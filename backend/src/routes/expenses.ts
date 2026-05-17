import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authMiddleware);

const VALID_CATEGORIES = ['MAISTAS', 'KURAS', 'RUBAI', 'NEBUTINOS', 'BOLT_WOLT', 'KITOS'];

// GET /api/expenses?month=5&year=2025
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query;
    const userId = req.userId!;

    let whereClause: {
      userId: string;
      date?: { gte: Date; lte: Date };
    } = { userId };

    if (month && year) {
      const m = parseInt(month as string);
      const y = parseInt(year as string);

      if (isNaN(m) || isNaN(y) || m < 1 || m > 12) {
        res.status(400).json({ error: 'Neteisingas mėnuo arba metai' });
        return;
      }

      const startDate = new Date(y, m - 1, 1, 0, 0, 0);
      const endDate = new Date(y, m, 0, 23, 59, 59, 999);
      whereClause.date = { gte: startDate, lte: endDate };
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
    });

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    const byCategory: Record<string, number> = {};
    VALID_CATEGORIES.forEach((cat) => {
      byCategory[cat] = 0;
    });
    expenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });

    res.json({ expenses, total, byCategory });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// POST /api/expenses
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category, amount, note } = req.body;
    const userId = req.userId!;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      res.status(400).json({
        error: `Neteisinga kategorija. Galimos: ${VALID_CATEGORIES.join(', ')}`,
      });
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: 'Suma turi būti teigiamas skaičius' });
      return;
    }

    if (parsedAmount > 1_000_000) {
      res.status(400).json({ error: 'Suma per didelė' });
      return;
    }

    const expense = await prisma.expense.create({
      data: {
        userId,
        category,
        amount: Math.round(parsedAmount * 100) / 100,
        note: note?.trim() || null,
        date: new Date(), // Backend sets the date!
      },
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const expense = await prisma.expense.findFirst({
      where: { id, userId },
    });

    if (!expense) {
      res.status(404).json({ error: 'Išlaida nerasta' });
      return;
    }

    await prisma.expense.delete({ where: { id } });
    res.json({ message: 'Išlaida sėkmingai ištrinta' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

export default router;
