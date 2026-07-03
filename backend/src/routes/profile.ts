import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authMiddleware);

// GET /api/profile
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: {
        id: true,
        email: true,
        salary: true,
        savings: true,
        foodDailyLimit: true,
        foodMonthlyLimit: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Vartotojas nerastas' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

// PUT /api/profile
router.put('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { salary, savings, foodDailyLimit, foodMonthlyLimit } = req.body;

    const today = new Date().getDate();
    const isFirstWeek = today <= 7;

    const updateData: {
      salary?: number | null;
      savings?: number | null;
      foodDailyLimit?: number;
      foodMonthlyLimit?: number;
    } = {};

    // Atsargų fondą galima keisti visada
    if (savings !== undefined) {
      if (savings === null || savings === '' ) {
        updateData.savings = null;
      } else {
        const parsed = parseFloat(savings);
        if (isNaN(parsed) || parsed < 0) {
          res.status(400).json({ error: 'Neteisingas santaupų formatas' });
          return;
        }
        updateData.savings = parsed;
      }
    }

    // Atlyginimą galima keisti visada
    if (salary !== undefined) {
      if (salary === null || salary === '' || salary === 0) {
        updateData.salary = null;
      } else {
        const parsed = parseFloat(salary);
        if (isNaN(parsed) || parsed < 0) {
          res.status(400).json({ error: 'Neteisingas atlyginimo formatas' });
          return;
        }
        updateData.salary = parsed;
      }
    }

    // Limitus galima keisti TIK pirmą savaitę
    const wantsToChangeLimits =
      foodDailyLimit !== undefined || foodMonthlyLimit !== undefined;

    if (wantsToChangeLimits) {
      if (!isFirstWeek) {
        res.status(403).json({
          error: `Maisto limitai gali būti keičiami tik pirmą mėnesio savaitę (1–7 d.). Šiandien ${today} d.`,
        });
        return;
      }

      if (foodDailyLimit !== undefined) {
        const parsed = parseFloat(foodDailyLimit);
        if (isNaN(parsed) || parsed <= 0 || parsed > 500) {
          res.status(400).json({ error: 'Dienos limitas turi būti tarp 1 ir 500 €' });
          return;
        }
        updateData.foodDailyLimit = parsed;
      }

      if (foodMonthlyLimit !== undefined) {
        const parsed = parseFloat(foodMonthlyLimit);
        if (isNaN(parsed) || parsed <= 0 || parsed > 10000) {
          res.status(400).json({ error: 'Mėnesio limitas turi būti tarp 1 ir 10 000 €' });
          return;
        }
        updateData.foodMonthlyLimit = parsed;
      }
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'Nėra ką atnaujinti' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: updateData,
      select: {
        id: true,
        email: true,
        salary: true,
        savings: true,
        foodDailyLimit: true,
        foodMonthlyLimit: true,
        createdAt: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Serverio klaida' });
  }
});

export default router;
