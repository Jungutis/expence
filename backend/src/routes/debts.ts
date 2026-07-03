import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authMiddleware);

// GET /api/debts
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const debts = await prisma.debt.findMany({
      where: { userId: req.userId! },
      orderBy: [{ closedAt: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ debts });
  } catch (error) {
    console.error('Get debts error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// POST /api/debts — { name, type, principal, note? }
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, type, principal, note } = req.body;

    if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) {
      res.status(400).json({ error: 'Pavadinimas privalomas (iki 60 simbolių)' });
      return;
    }
    if (type !== 'BORROWED' && type !== 'LENT') {
      res.status(400).json({ error: 'Tipas turi būti BORROWED arba LENT' });
      return;
    }
    const parsed = parseFloat(principal);
    if (isNaN(parsed) || parsed <= 0 || parsed > 10_000_000) {
      res.status(400).json({ error: 'Suma turi būti teigiamas skaičius' });
      return;
    }

    const debt = await prisma.debt.create({
      data: {
        userId: req.userId!,
        name: name.trim(),
        type,
        principal: Math.round(parsed * 100) / 100,
        remaining: Math.round(parsed * 100) / 100,
        note: typeof note === 'string' && note.trim() ? note.trim() : null,
      },
    });
    res.status(201).json(debt);
  } catch (error) {
    console.error('Create debt error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// POST /api/debts/:id/payment — { amount } sumažina likutį; pasiekus 0 uždaro
router.post('/:id/payment', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const debt = await prisma.debt.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!debt) {
      res.status(404).json({ error: 'Skola nerasta' });
      return;
    }
    if (debt.closedAt) {
      res.status(400).json({ error: 'Skola jau uždaryta' });
      return;
    }

    const parsed = parseFloat(req.body.amount);
    if (isNaN(parsed) || parsed <= 0) {
      res.status(400).json({ error: 'Suma turi būti teigiamas skaičius' });
      return;
    }

    const newRemaining = Math.max(0, Math.round((debt.remaining - parsed) * 100) / 100);
    const updated = await prisma.debt.update({
      where: { id: debt.id },
      data: {
        remaining: newRemaining,
        closedAt: newRemaining === 0 ? new Date() : null,
      },
    });
    res.json(updated);
  } catch (error) {
    console.error('Debt payment error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// DELETE /api/debts/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const debt = await prisma.debt.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!debt) {
      res.status(404).json({ error: 'Skola nerasta' });
      return;
    }
    await prisma.debt.delete({ where: { id: debt.id } });
    res.json({ message: 'Skola ištrinta' });
  } catch (error) {
    console.error('Delete debt error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

export default router;
