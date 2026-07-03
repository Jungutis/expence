import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { applyDueRecurring } from '../lib/recurring';
import { isValidCategory, ensureCategories } from '../lib/categories';

const router = Router();
router.use(authMiddleware);

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

    // Laiko heatmap: 7 savaitės dienos (Pr..Sk) × 4 paros dalys (rytas/diena/vakaras/naktis)
    const timeHeatmap: number[][] = Array.from({ length: 7 }, () => [0, 0, 0, 0]);

    for (const e of expenses) {
      const d = new Date(e.date);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = byYm.get(ym);
      if (bucket) {
        bucket.total = Math.round((bucket.total + e.amount) * 100) / 100;
        bucket.byCategory[e.category] = Math.round(((bucket.byCategory[e.category] || 0) + e.amount) * 100) / 100;
      }

      const dow = (d.getDay() + 6) % 7; // 0 = pirmadienis
      const h = d.getHours();
      const part = h >= 6 && h < 11 ? 0 : h >= 11 && h < 17 ? 1 : h >= 17 && h < 22 ? 2 : 3;
      timeHeatmap[dow][part] = Math.round((timeHeatmap[dow][part] + e.amount) * 100) / 100;
    }

    res.json({ months: buckets, timeHeatmap });
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

// GET /api/expenses/suggest?note=lidl — kategorijos spėjimas pagal istoriją
router.get('/suggest', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const note = String(req.query.note || '').trim().toLowerCase();
    if (note.length < 2) {
      res.json({ category: null });
      return;
    }

    const recent = await prisma.expense.findMany({
      where: { userId, note: { not: null } },
      orderBy: { date: 'desc' },
      take: 500,
      select: { note: true, category: true },
    });

    const counts: Record<string, number> = {};
    for (const r of recent) {
      const n = (r.note || '').toLowerCase();
      if (!n) continue;
      if (n.includes(note) || note.includes(n)) {
        counts[r.category] = (counts[r.category] || 0) + 1;
      }
    }

    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    res.json({ category: best && best[1] >= 2 ? best[0] : null });
  } catch (error) {
    console.error('Suggest error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// POST /api/expenses/bulk — masinis importas iš banko CSV
router.post('/bulk', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const items = req.body.items;

    if (!Array.isArray(items) || items.length === 0 || items.length > 500) {
      res.status(400).json({ error: 'Pateik 1–500 įrašų' });
      return;
    }

    const categories = await ensureCategories(userId);
    const validCodes = new Set(categories.filter(c => !c.archived).map(c => c.code));

    const now = new Date();
    const minDate = new Date(now.getFullYear() - 5, 0, 1);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const rows: { userId: string; category: string; amount: number; note: string | null; date: Date }[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it || typeof it.category !== 'string' || !validCodes.has(it.category)) {
        res.status(400).json({ error: `Eilutė ${i + 1}: neteisinga kategorija` });
        return;
      }
      const amount = parseFloat(it.amount);
      if (isNaN(amount) || amount <= 0 || amount > 1_000_000) {
        res.status(400).json({ error: `Eilutė ${i + 1}: neteisinga suma` });
        return;
      }
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(it.date || ''));
      if (!m) {
        res.status(400).json({ error: `Eilutė ${i + 1}: neteisinga data (YYYY-MM-DD)` });
        return;
      }
      const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), 12, 0, 0);
      if (isNaN(d.getTime()) || d < minDate || d > endOfToday) {
        res.status(400).json({ error: `Eilutė ${i + 1}: data už leistino rėžio` });
        return;
      }
      rows.push({
        userId,
        category: it.category,
        amount: Math.round(amount * 100) / 100,
        note: typeof it.note === 'string' && it.note.trim() ? it.note.trim().slice(0, 200) : null,
        date: d,
      });
    }

    const result = await prisma.expense.createMany({ data: rows });
    res.status(201).json({ created: result.count });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// GET /api/expenses/subscriptions — aptinka pasikartojančius mokėjimus istorijoje
router.get('/subscriptions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const expenses = await prisma.expense.findMany({
      where: { userId, date: { gte: start }, note: { not: null } },
      select: { note: true, amount: true, date: true, category: true },
    });

    // Grupuojam pagal normalizuotą pastabą
    const groups = new Map<string, { note: string; category: string; amounts: number[]; months: Set<string> }>();
    for (const e of expenses) {
      const key = (e.note || '').toLowerCase().replace(/\s+/g, ' ').replace(/ ↻$/, '').trim();
      if (key.length < 3) continue;
      const ym = `${e.date.getFullYear()}-${e.date.getMonth() + 1}`;
      const g = groups.get(key);
      if (g) {
        g.amounts.push(e.amount);
        g.months.add(ym);
      } else {
        groups.set(key, { note: e.note!, category: e.category, amounts: [e.amount], months: new Set([ym]) });
      }
    }

    // Prenumerata: >= 3 skirtingi mėnesiai ir stabili suma (±15% nuo medianos)
    const subs: { note: string; category: string; monthlyCost: number; months: number; yearlyCost: number }[] = [];
    for (const g of groups.values()) {
      if (g.months.size < 3) continue;
      const sorted = [...g.amounts].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const stable = g.amounts.filter(a => Math.abs(a - median) <= median * 0.15).length / g.amounts.length;
      if (stable < 0.7) continue;
      subs.push({
        note: g.note.replace(/ ↻$/, ''),
        category: g.category,
        monthlyCost: Math.round(median * 100) / 100,
        months: g.months.size,
        yearlyCost: Math.round(median * 12 * 100) / 100,
      });
    }

    subs.sort((a, b) => b.monthlyCost - a.monthlyCost);
    res.json({ subscriptions: subs.slice(0, 20) });
  } catch (error) {
    console.error('Subscriptions error:', error);
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

    const categories = await ensureCategories(userId);
    const byCategory: Record<string, number> = {};
    categories.forEach((cat) => {
      byCategory[cat.code] = 0;
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
    const { category, amount, note, date } = req.body;
    const userId = req.userId!;

    if (!category || typeof category !== 'string' || !(await isValidCategory(userId, category))) {
      res.status(400).json({ error: 'Neteisinga kategorija' });
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

    // Data: pagal nutylėjimą šiandien; galima nurodyti praeities datą (YYYY-MM-DD)
    let expenseDate = new Date();
    if (date !== undefined && date !== null && date !== '') {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date));
      if (!m) {
        res.status(400).json({ error: 'Neteisingas datos formatas (YYYY-MM-DD)' });
        return;
      }
      const now = new Date();
      const picked = new Date(
        parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]),
        now.getHours(), now.getMinutes(), now.getSeconds(),
      );
      const minDate = new Date(now.getFullYear() - 5, 0, 1);
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      if (isNaN(picked.getTime()) || picked < minDate || picked > endOfToday) {
        res.status(400).json({ error: 'Data turi būti ne ateityje ir ne senesnė nei 5 metai' });
        return;
      }
      expenseDate = picked;
    }

    const expense = await prisma.expense.create({
      data: {
        userId,
        category,
        amount: Math.round(parsedAmount * 100) / 100,
        note: note?.trim() || null,
        date: expenseDate,
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
