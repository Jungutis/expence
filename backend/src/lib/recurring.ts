import { prisma } from './prisma';

/**
 * Sukuria visas šio mėnesio pasikartojančias išlaidas, kurių diena jau atėjo
 * ir kurios šį mėnesį dar nebuvo pritaikytos. Kviečiama "lazy" būdu, kai
 * vartotojas užklausia savo išlaidas — nereikia atskiro cron proceso.
 */
export async function applyDueRecurring(userId: string): Promise<number> {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const due = await prisma.recurringExpense.findMany({
    where: {
      userId,
      active: true,
      dayOfMonth: { lte: now.getDate() },
      OR: [{ lastAppliedYm: null }, { lastAppliedYm: { not: ym } }],
    },
  });

  let created = 0;
  for (const rec of due) {
    // Atomiškai "užrakinam" įrašą šiam mėnesiui — apsauga nuo dublikatų,
    // jei tuo pačiu metu ateitų kelios užklausos
    const claimed = await prisma.recurringExpense.updateMany({
      where: { id: rec.id, OR: [{ lastAppliedYm: null }, { lastAppliedYm: { not: ym } }] },
      data: { lastAppliedYm: ym },
    });
    if (claimed.count === 0) continue;

    await prisma.expense.create({
      data: {
        userId,
        category: rec.category,
        amount: rec.amount,
        note: rec.note ? `${rec.note} ↻` : 'Recurring ↻',
        date: new Date(now.getFullYear(), now.getMonth(), rec.dayOfMonth, 12, 0, 0),
      },
    });
    created++;
  }

  return created;
}
