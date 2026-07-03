import axios from 'axios';
import type {
  AuthResponse, ExpensesResponse, Expense, ExpenseCategory, UserProfile,
  Budget, BudgetKey, RecurringExpense, MonthStat, CategoryDef,
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 - auto logout TIK kai yra tokenas (pasibaigusi sesija),
// bet NE kai prisijungimo bandymas nepavyksta (tokeno dar nėra)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const hadToken = !!localStorage.getItem('token');
      if (hadToken) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (email: string, password: string): Promise<AuthResponse> =>
    api.post('/auth/register', { email, password }).then((r) => r.data),

  login: (email: string, password: string): Promise<AuthResponse> =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
};

export const expensesApi = {
  getExpenses: (month?: number, year?: number): Promise<ExpensesResponse> =>
    api.get('/expenses', { params: { month, year } }).then((r) => r.data),

  createExpense: (data: {
    category: ExpenseCategory;
    amount: number;
    note?: string;
    date?: string; // YYYY-MM-DD, praleista = šiandien
  }): Promise<Expense> => api.post('/expenses', data).then((r) => r.data),

  deleteExpense: (id: string): Promise<void> =>
    api.delete(`/expenses/${id}`).then((r) => r.data),

  getStats: (months = 6): Promise<{ months: MonthStat[]; timeHeatmap: number[][] }> =>
    api.get('/expenses/stats', { params: { months } }).then((r) => r.data),

  suggestCategory: (note: string): Promise<{ category: string | null }> =>
    api.get('/expenses/suggest', { params: { note } }).then((r) => r.data),

  bulkImport: (items: { category: string; amount: number; note?: string; date: string }[]): Promise<{ created: number }> =>
    api.post('/expenses/bulk', { items }).then((r) => r.data),

  getSubscriptions: (): Promise<{ subscriptions: { note: string; category: string; monthlyCost: number; months: number; yearlyCost: number }[] }> =>
    api.get('/expenses/subscriptions').then((r) => r.data),

  // Atsisiunčia CSV ir paleidžia naršyklės download
  exportCsv: async (from?: string, to?: string): Promise<void> => {
    const response = await api.get('/expenses/export', {
      params: { from, to },
      responseType: 'blob',
    });
    const disposition: string = response.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^";]+)"?/);
    const filename = match?.[1] || 'expenses.csv';
    const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export const budgetsApi = {
  list: (): Promise<{ budgets: Budget[] }> =>
    api.get('/budgets').then((r) => r.data),

  upsert: (category: BudgetKey, amount: number | null): Promise<Budget> =>
    api.put('/budgets', { category, amount: amount ?? 0 }).then((r) => r.data),
};

export const categoriesApi = {
  list: (): Promise<{ categories: CategoryDef[] }> =>
    api.get('/categories').then((r) => r.data),

  create: (data: { label: string; emoji: string; color: string; soft: string }): Promise<CategoryDef> =>
    api.post('/categories', data).then((r) => r.data),

  update: (id: string, data: { label: string; emoji: string; color: string; soft: string }): Promise<CategoryDef> =>
    api.put(`/categories/${id}`, data).then((r) => r.data),

  remove: (id: string): Promise<{ deleted?: boolean; archived?: boolean }> =>
    api.delete(`/categories/${id}`).then((r) => r.data),
};

export interface Debt {
  id: string;
  name: string;
  type: 'BORROWED' | 'LENT';
  principal: number;
  remaining: number;
  note?: string | null;
  createdAt: string;
  closedAt?: string | null;
}

export const debtsApi = {
  list: (): Promise<{ debts: Debt[] }> =>
    api.get('/debts').then((r) => r.data),

  create: (data: { name: string; type: 'BORROWED' | 'LENT'; principal: number; note?: string }): Promise<Debt> =>
    api.post('/debts', data).then((r) => r.data),

  pay: (id: string, amount: number): Promise<Debt> =>
    api.post(`/debts/${id}/payment`, { amount }).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/debts/${id}`).then((r) => r.data),
};

export const recurringApi = {
  list: (): Promise<{ recurring: RecurringExpense[] }> =>
    api.get('/recurring').then((r) => r.data),

  create: (data: {
    category: ExpenseCategory;
    amount: number;
    note?: string;
    dayOfMonth: number;
  }): Promise<RecurringExpense> => api.post('/recurring', data).then((r) => r.data),

  setActive: (id: string, active: boolean): Promise<RecurringExpense> =>
    api.put(`/recurring/${id}`, { active }).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/recurring/${id}`).then((r) => r.data),
};

export const profileApi = {
  getProfile: (): Promise<UserProfile> =>
    api.get('/profile').then((r) => r.data),

  updateProfile: (data: {
    salary?: number | null;
    foodDailyLimit?: number;
    foodMonthlyLimit?: number;
  }): Promise<UserProfile> => api.put('/profile', data).then((r) => r.data),
};

export const pushApi = {
  subscribe: (subscription: PushSubscriptionJSON): Promise<void> =>
    api.post('/push/subscribe', subscription).then(() => undefined),

  getShortcutToken: (): Promise<{ token: string }> =>
    api.post('/push/shortcut-token').then((r) => r.data),

  test: (): Promise<{ ok: boolean; sent: number }> =>
    api.post('/push/test').then((r) => r.data),
};

export default api;
