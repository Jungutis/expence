import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authMiddleware);

// GET /api/balance — paskutiniai sutikrinimai
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const checks = await prisma.balanceCheck.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    res.json({ checks });
  } catch (error) {
    console.error('Get balance checks error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// POST /api/balance — { balance, income? } naujas sutikrinimas
// unaccounted = (senas likutis + pajamos − užfiksuotos išlaidos) − naujas likutis
// teigiamas skaičius = pinigai dingo be įrašų programėlėje
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const balance = parseFloat(req.body.balance);
    const income = req.body.income !== undefined && req.body.income !== '' ? parseFloat(req.body.income) : 0;

    if (isNaN(balance) || balance < -1_000_000 || balance > 100_000_000) {
      res.status(400).json({ error: 'Neteisingas likutis' });
      return;
    }
    if (isNaN(income) || income < 0) {
      res.status(400).json({ error: 'Neteisingos pajamos' });
      return;
    }

    const last = await prisma.balanceCheck.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    let unaccounted: number | null = null;
    if (last) {
      const tracked = await prisma.expense.aggregate({
        where: { userId, date: { gt: last.createdAt } },
        _sum: { amount: true },
      });
      const trackedSpent = tracked._sum.amount ?? 0;
      const expected = last.balance + income - trackedSpent;
      unaccounted = Math.round((expected - balance) * 100) / 100;
    }

    const check = await prisma.balanceCheck.create({
      data: {
        userId,
        balance: Math.round(balance * 100) / 100,
        income: Math.round(income * 100) / 100,
        unaccounted,
      },
    });

    res.status(201).json(check);
  } catch (error) {
    console.error('Balance check error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

export default router;
