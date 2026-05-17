import type { Expense } from '../types';

export interface BudgetWarning {
  level: 'info' | 'warning' | 'danger';
  message: string;
}

export interface FoodBudgetStatus {
  // Nustatymai
  dailyLimit: number;
  monthlyLimit: number;

  // Mėnuo
  monthlyFoodSpent: number;
  monthlyRemaining: number;
  monthlyUsedPct: number;
  isMonthlyExceeded: boolean;
  isMonthlyNearLimit: boolean; // >= 85% panaudota

  // Savaitė (dinaminis rolling budget)
  currentWeekBudget: number;
  weeklyFoodSpent: number;
  weeklyRemaining: number;
  weeklyUsedPct: number;
  isWeeklyExceeded: boolean;
  isWeeklyNearLimit: boolean; // >= 85% panaudota

  // Diena
  todayFoodSpent: number;
  dailyRemaining: number;
  dailyUsedPct: number;
  isDailyExceeded: boolean;
  isDailyNearLimit: boolean; // >= 85% panaudota

  // Bendras statusas
  canAddFood: boolean; // false kai mėnesinis limitas viršytas
  warnings: BudgetWarning[];
}

/**
 * Skaičiuoja savaitinį maisto biudžetą su rolling mechanizmu:
 * jei praėjusios savaitės viršijo savo dalį — kitos savaitės biudžetas mažėja automatiškai.
 *
 * Formulė: currentWeekBudget = (monthlyLimit - previousWeeksSpent) / remainingWeeks
 */
export function calculateFoodBudget(
  expenses: Expense[],
  dailyLimit: number,
  monthlyLimit: number,
  month: number,
  year: number
): FoodBudgetStatus {
  const now = new Date();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayDay = month === now.getMonth() + 1 && year === now.getFullYear()
    ? now.getDate()
    : daysInMonth;

  // Savaitės indeksas (0 = 1-7 d., 1 = 8-14 d., ...)
  const currentWeekIdx = Math.floor((todayDay - 1) / 7);
  const totalWeeks = Math.ceil(daysInMonth / 7);
  const remainingWeeks = totalWeeks - currentWeekIdx;

  // Šios savaitės pradžia ir pabaiga
  const weekStartDay = currentWeekIdx * 7 + 1;
  const weekEndDay = Math.min((currentWeekIdx + 1) * 7, daysInMonth);
  const weekStart = new Date(year, month - 1, weekStartDay, 0, 0, 0);
  const weekEnd = new Date(year, month - 1, weekEndDay, 23, 59, 59, 999);

  // Šiandienos ribos
  const todayStart = new Date(year, month - 1, todayDay, 0, 0, 0);
  const todayEnd = new Date(year, month - 1, todayDay, 23, 59, 59, 999);

  const foodExpenses = expenses.filter((e) => e.category === 'MAISTAS');

  // Mėnesio suma
  const monthlyFoodSpent = foodExpenses.reduce((s, e) => s + e.amount, 0);

  // Praėjusių savaičių suma (iki šios savaitės pradžios)
  const previousWeeksSpent = foodExpenses
    .filter((e) => new Date(e.date) < weekStart)
    .reduce((s, e) => s + e.amount, 0);

  // Šios savaitės suma
  const weeklyFoodSpent = foodExpenses
    .filter((e) => {
      const d = new Date(e.date);
      return d >= weekStart && d <= weekEnd;
    })
    .reduce((s, e) => s + e.amount, 0);

  // Šiandienos suma
  const todayFoodSpent = foodExpenses
    .filter((e) => {
      const d = new Date(e.date);
      return d >= todayStart && d <= todayEnd;
    })
    .reduce((s, e) => s + e.amount, 0);

  // Rolling savaitės biudžetas
  const remainingMonthlyBudget = Math.max(0, monthlyLimit - previousWeeksSpent);
  const currentWeekBudget = remainingWeeks > 0
    ? remainingMonthlyBudget / remainingWeeks
    : 0;

  // --- Mėnuo ---
  const monthlyRemaining = Math.max(0, monthlyLimit - monthlyFoodSpent);
  const monthlyUsedPct = monthlyLimit > 0
    ? Math.min(100, (monthlyFoodSpent / monthlyLimit) * 100)
    : 0;
  const isMonthlyExceeded = monthlyFoodSpent >= monthlyLimit;
  const isMonthlyNearLimit = !isMonthlyExceeded && monthlyUsedPct >= 85;

  // --- Savaitė ---
  const weeklyRemaining = Math.max(0, currentWeekBudget - weeklyFoodSpent);
  const weeklyUsedPct = currentWeekBudget > 0
    ? Math.min(100, (weeklyFoodSpent / currentWeekBudget) * 100)
    : 0;
  const isWeeklyExceeded = weeklyFoodSpent >= currentWeekBudget;
  const isWeeklyNearLimit = !isWeeklyExceeded && weeklyUsedPct >= 85;

  // --- Diena ---
  const dailyRemaining = Math.max(0, dailyLimit - todayFoodSpent);
  const dailyUsedPct = dailyLimit > 0
    ? Math.min(100, (todayFoodSpent / dailyLimit) * 100)
    : 0;
  const isDailyExceeded = todayFoodSpent >= dailyLimit;
  const isDailyNearLimit = !isDailyExceeded && dailyUsedPct >= 85;

  // --- Įspėjimai ---
  const warnings: BudgetWarning[] = [];

  if (isMonthlyExceeded) {
    warnings.push({
      level: 'danger',
      message: `⛔ Mėnesinis maisto limitas viršytas! Išleista ${monthlyFoodSpent.toFixed(2)} € iš ${monthlyLimit} €. Maisto išlaidų įvesti nebegalima.`,
    });
  } else if (isMonthlyNearLimit) {
    warnings.push({
      level: 'danger',
      message: `🚨 Mėnesio maisto biudžetas beveik baigtas — likę tik ${monthlyRemaining.toFixed(2)} € iš ${monthlyLimit} €!`,
    });
  }

  if (!isMonthlyExceeded) {
    if (isWeeklyExceeded) {
      warnings.push({
        level: 'danger',
        message: `🔴 Šios savaitės maisto biudžetas viršytas (${weeklyFoodSpent.toFixed(2)} € / ${currentWeekBudget.toFixed(2)} €). Kitos savaitės biudžetas automatiškai sumažintas.`,
      });
    } else if (isWeeklyNearLimit) {
      warnings.push({
        level: 'warning',
        message: `⚠️ Savaitės maisto biudžetas beveik baigtas — likę ${weeklyRemaining.toFixed(2)} € iš ${currentWeekBudget.toFixed(2)} €.`,
      });
    }

    if (isDailyExceeded) {
      warnings.push({
        level: 'warning',
        message: `🍽️ Šiandieninis maisto limitas viršytas (${todayFoodSpent.toFixed(2)} € / ${dailyLimit} €).`,
      });
    } else if (isDailyNearLimit) {
      warnings.push({
        level: 'info',
        message: `🍽️ Šiandien maistui likę tik ${dailyRemaining.toFixed(2)} € iš ${dailyLimit} €.`,
      });
    }
  }

  return {
    dailyLimit,
    monthlyLimit,
    monthlyFoodSpent,
    monthlyRemaining,
    monthlyUsedPct,
    isMonthlyExceeded,
    isMonthlyNearLimit,
    currentWeekBudget,
    weeklyFoodSpent,
    weeklyRemaining,
    weeklyUsedPct,
    isWeeklyExceeded,
    isWeeklyNearLimit,
    todayFoodSpent,
    dailyRemaining,
    dailyUsedPct,
    isDailyExceeded,
    isDailyNearLimit,
    canAddFood: !isMonthlyExceeded,
    warnings,
  };
}

/** Grąžina kiek % pajamų sudarė mėnesio išlaidos */
export function calcIncomeRatio(total: number, salary: number): number {
  if (salary <= 0) return 0;
  return Math.min(999, (total / salary) * 100);
}
