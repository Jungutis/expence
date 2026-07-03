export interface User {
  id: string;
  email: string;
}

// Kategorijos dabar dinaminės (vartotojas gali kurti savas) — kodas yra string.
// Numatytieji kodai: MAISTAS, KURAS, RUBAI, NEBUTINOS, BOLT_WOLT, KITOS.
export type ExpenseCategory = string;

export interface CategoryDef {
  id: string;
  code: string;
  label: string;
  emoji: string;
  color: string; // pagrindinė (dot/bar)
  soft: string;  // šviesus fonas
  isDefault: boolean;
  archived: boolean;
  sortOrder: number;
}

export interface Expense {
  id: string;
  userId: string;
  category: ExpenseCategory;
  amount: number;
  note?: string | null;
  date: string;
  createdAt: string;
}

export interface ExpensesResponse {
  expenses: Expense[];
  total: number;
  byCategory: Record<ExpenseCategory, number>;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface UserProfile {
  id: string;
  email: string;
  salary: number | null;
  savings: number | null;
  foodDailyLimit: number;
  foodMonthlyLimit: number;
  createdAt: string;
}

export type BudgetKey = ExpenseCategory | 'TOTAL';

export interface Budget {
  category: BudgetKey;
  amount: number;
  rollover?: boolean;
  effective?: number; // amount + vokelių carry-over iš praėjusių mėnesių
}

export interface RecurringExpense {
  id: string;
  userId: string;
  category: ExpenseCategory;
  amount: number;
  note?: string | null;
  dayOfMonth: number;
  active: boolean;
  lastAppliedYm?: string | null;
  createdAt: string;
}

export interface MonthStat {
  ym: string;
  year: number;
  month: number;
  total: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
}

export interface CategoryMeta {
  label: string;
  emoji: string;
  color: string;
  bg: string;
  border: string;
  bar: string;
}

// Fallback meta žinomiems default kodams (naudojama kol kraunasi/nepasiekiamos DB kategorijos)
export const CATEGORY_META: Record<string, CategoryMeta> = {
  MAISTAS: {
    label: 'Maistas',
    emoji: '🍽️',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    bar: 'bg-red-400',
  },
  KURAS: {
    label: 'Kuras',
    emoji: '⛽',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    bar: 'bg-amber-400',
  },
  RUBAI: {
    label: 'Rūbai',
    emoji: '👗',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    bar: 'bg-purple-400',
  },
  NEBUTINOS: {
    label: 'Nebūtinos',
    emoji: '🛍️',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    bar: 'bg-rose-400',
  },
  BOLT_WOLT: {
    label: 'Bolt / Wolt',
    emoji: '🛵',
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    bar: 'bg-teal-400',
  },
  KITOS: {
    label: 'Kitos',
    emoji: '📦',
    color: 'text-stone-700',
    bg: 'bg-stone-100',
    border: 'border-stone-200',
    bar: 'bg-stone-400',
  },
};
