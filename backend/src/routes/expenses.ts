import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { applyDueRecurring } from '../lib/recurring';

const router = Router();
router.use(authMiddleware);

const VALID_CATEGORIES = ['MAISTAS', 'KURAS', 'RUBAI', 'NEBUTINOS', 'BOLT_WOLT', 'KITOS'];

// GET /api/expenses/stats?months=6 — mėnesių suvestinė grafikams
router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const months = Math.min(24, Math.max(1, parseInt(req.query.months as string) || 6));

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1, 0, 0, 0);

    const expenses = await prisma.expense.findMany({
      where: { userId, date: { gte: start } },
      select: { category: true, amount: true, date: true },
    });

    // Paruošiam visų mėnesių "kibirus" (net ir tuščius), kad grafikas būtų pilnas
    const buckets: { ym: string; year: number; month: number; total: number; byCategory: Record<string, number> }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        total: 0,
        byCategory: {},
      });
    }
    const byYm = new Map(buckets.map(b => [b.ym, b]));

    for (const e of expenses) {
      const d = new Date(e.date);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = byYm.get(ym);
      if (!bucket) continue;
      bucket.total = Math.round((bucket.total + e.amount) * 100) / 100;
      bucket.byCategory[e.category] = Math.round(((bucket.byCategory[e.category] || 0) + e.amount) * 100) / 100;
    }

    res.json({ months: buckets });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// GET /api/expenses/export?from=2026-01-01&to=2026-06-30 — CSV atsisiuntimas
router.get('/export', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { from, to } = req.query;

    const now = new Date();
    const fromDate = from
      ? new Date(`${from}T00:00:00`)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const toDate = to
      ? new Date(`${to}T23:59:59.999`)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate > toDate) {
      res.status(400).json({ error: 'Neteisingas laikotarpis' });
      return;
    }

    const expenses = await prisma.expense.findMany({
      where: { userId, date: { gte: fromDate, lte: toDate } },
      orderBy: { date: 'asc' },
    });

    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [
      'Date,Time,Category,Note,Amount (EUR)',
      ...expenses.map(e => {
        const d = new Date(e.date);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return [date, time, e.category, esc(e.note || ''), e.amount.toFixed(2)].join(',');
      }),
      '',
      `Total,,,,${expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}`,
    ];

    const fname = `expenses_${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    // BOM, kad Excel teisingai atpažintų UTF-8 (lietuviškos raidės)
    res.send('\uFEFF' + rows.join('\r\n'));
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// GET /api/expenses?month=5&year=2025
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query;
    const userId = req.userId!;

    // Sukuriam šio mėnesio pasikartojančias išlaidas, kurių diena jau atėjo
    await applyDueRecurring(userId);

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
