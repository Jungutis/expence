import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { isValidCategory } from '../lib/categories';

const router = Router();
router.use(authMiddleware);

// GET /api/budgets — visi biudžetai su "effective" limitu (vokelių rollover)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const budgets = await prisma.budget.findMany({
      where: { userId },
      select: { category: true, amount: true, rollover: true },
    });

    const result: { category: string; amount: number; rollover: boolean; effective: number }[] =
      budgets.map(b => ({ ...b, effective: b.amount }));

    // Vokelių logika: nepanaudotas praėjusių mėnesių likutis pridedamas prie šio mėnesio
    if (budgets.some(b => b.rollover)) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const start = new Date(now.getFullYear(), now.getMonth() - 12, 1);

      const past = await prisma.expense.findMany({
        where: { userId, date: { gte: start, lt: monthStart } },
        select: { category: true, amount: true, date: true },
      });

      // spent[ym][cat] ir spent[ym].__total
      const spent = new Map<string, Record<string, number>>();
      for (const e of past) {
        const ym = `${e.date.getFullYear()}-${e.date.getMonth()}`;
        const m = spent.get(ym) ?? {};
        m[e.category] = (m[e.category] ?? 0) + e.amount;
        m.__total = (m.__total ?? 0) + e.amount;
        spent.set(ym, m);
      }

      const yms: string[] = [];
      for (let i = 12; i >= 1; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        yms.push(`${d.getFullYear()}-${d.getMonth()}`);
      }

      for (const b of result) {
        if (!b.rollover) continue;
        let carry = 0;
        for (const ym of yms) {
          const m = spent.get(ym);
          if (!m || (m.__total ?? 0) === 0) continue; // nekaupiam už mėnesius be įrašų
          const used = b.category === 'TOTAL' ? (m.__total ?? 0) : (m[b.category] ?? 0);
          carry = Math.max(0, carry + b.amount - used);
        }
        b.effective = Math.round((b.amount + carry) * 100) / 100;
      }
    }

    res.json({ budgets: result });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// PUT /api/budgets — upsert { category, amount, rollover? }; amount <= 0 ištrina limitą
router.put('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category, amount, rollover } = req.body;
    const userId = req.userId!;

    const isValid = category === 'TOTAL' ||
      (typeof category === 'string' && (await isValidCategory(userId, category)));
    if (!isValid) {
      res.status(400).json({ error: 'Neteisinga kategorija' });
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
    const roll = rollover === true;
    const budget = await prisma.budget.upsert({
      where: { userId_category: { userId, category } },
      create: { userId, category, amount: rounded, rollover: roll },
      update: { amount: rounded, rollover: roll },
      select: { category: true, amount: true, rollover: true },
    });

    res.json(budget);
  } catch (error) {
    console.error('Upsert budget error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

export default router;
