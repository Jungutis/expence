import webpush from 'web-push';
import { prisma } from './prisma';

/** Suformuoja vartotojo savaitės suvestinės tekstą (paskutinės 7 dienos) */
export async function buildWeeklyDigest(userId: string): Promise<{ title: string; body: string } | null> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const [expenses, user, budgets] = await Promise.all([
    prisma.expense.findMany({
      where: { userId, date: { gte: weekAgo } },
      select: { category: true, amount: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { salary: true } }),
    prisma.budget.findMany({ where: { userId }, select: { category: true, amount: true } }),
  ]);

  const spent = expenses.reduce((s, e) => s + e.amount, 0);

  // Top kategorija
  const byCat: Record<string, number> = {};
  for (const e of expenses) byCat[e.category] = (byCat[e.category] || 0) + e.amount;
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const cat = top
    ? await prisma.category.findUnique({ where: { userId_code: { userId, code: top[0] } } })
    : null;

  // Savaitės biudžetas (rolling): bendras limitas arba alga
  const total = budgets.find(b => b.category === 'TOTAL')?.amount ?? user?.salary ?? 0;
  let budgetLine = '';
  if (total > 0) {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const weekIdx = Math.floor((now.getDate() - 1) / 7);
    const remainingWeeks = Math.ceil(daysInMonth / 7) - weekIdx;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthAgg = await prisma.expense.aggregate({
      where: { userId, date: { gte: monthStart } },
      _sum: { amount: true },
    });
    const monthSpent = monthAgg._sum.amount ?? 0;
    const weekBudget = remainingWeeks > 0 ? Math.max(0, total - (monthSpent - spent)) / remainingWeeks : 0;
    if (weekBudget > 0) {
      const pct = Math.round((spent / weekBudget) * 100);
      budgetLine = ` · ${pct}% savaitės biudžeto`;
    }
  }

  const topLine = top && cat ? ` · Top: ${cat.emoji} ${cat.label} ${top[1].toFixed(0)} €` : '';

  return {
    title: '📊 Savaitės suvestinė',
    body: `Išleista ${spent.toFixed(2)} €${budgetLine}${topLine}`,
  };
}

/** Išsiunčia digest'ą į visus vartotojo įrenginius. Grąžina kiek išsiųsta. */
export async function sendDigestToUser(userId: string): Promise<number> {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const digest = await buildWeeklyDigest(userId);
  if (!digest) return 0;

  const payload = JSON.stringify(digest);
  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      ).catch(async (err: { statusCode?: number }) => {
        if (err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
        }
        throw err;
      }),
    ),
  );
  return results.filter(r => r.status === 'fulfilled').length;
}
