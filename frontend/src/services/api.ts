import axios from 'axios';
import type { AuthResponse, ExpensesResponse, Expense, ExpenseCategory, UserProfile } from '../types';

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
  }): Promise<Expense> => api.post('/expenses', data).then((r) => r.data),

  deleteExpense: (id: string): Promise<void> =>
    api.delete(`/expenses/${id}`).then((r) => r.data),
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

export default api;
