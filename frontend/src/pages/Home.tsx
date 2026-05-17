import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { expensesApi, profileApi } from '../services/api';
import type { ExpensesResponse, ExpenseCategory, UserProfile } from '../types';
import { CATEGORY_META } from '../types';
import { calculateFoodBudget, calcIncomeRatio } from '../utils/budgetUtils';
import type { FoodBudgetStatus } from '../utils/budgetUtils';
import ExpenseCard from '../components/ExpenseCard';
import Login from './Login';

const MONTHS_LT = [
  'Sausis', 'Vasaris', 'Kovas', 'Balandis', 'Gegužė', 'Birželis',
  'Liepa', 'Rugpjūtis', 'Rugsėjis', 'Spalis', 'Lapkritis', 'Gruodis',
];

const CATEGORIES: ExpenseCategory[] = ['MAISTAS', 'KURAS', 'RUBAI', 'NEBUTINOS', 'BOLT_WOLT', 'KITOS'];

// --- Collapsible section wrapper ---
function Section({
  title, subtitle, badge, collapsed, onToggle, children,
}: {
  id?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 group"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-bold text-stone-800 truncate">{title}</span>
          {badge}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {subtitle && collapsed && (
            <span className="text-xs text-stone-400 font-medium hidden sm:block">{subtitle}</span>
          )}
          <svg
            className={`w-5 h-5 text-stone-400 transition-transform duration-200 flex-shrink-0 ${collapsed ? '-rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {!collapsed && <div className="mt-4">{children}</div>}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [data, setData] = useState<ExpensesResponse | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<ExpenseCategory | 'ALL'>('ALL');
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  // Collapsible state — false = open, true = collapsed
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    budget: false,
    categories: false,
    list: false,
  });
  const toggle = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [result, prof] = await Promise.all([
        expensesApi.getExpenses(selectedMonth, selectedYear),
        profileApi.getProfile(),
      ]);
      setData(result);
      setProfile(prof);
    } catch {
      setError('Nepavyko užkrauti duomenų');
    } finally {
      setLoading(false);
    }
  }, [user, selectedMonth, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    await expensesApi.deleteExpense(id);
    fetchData();
  };

  const prevMonth = () => {
    setActiveFilter('ALL');
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (isCurrentMonth) return;
    setActiveFilter('ALL');
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  };

  const isCurrentMonth =
    selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();

  // ---- Jei neprisijungęs ----
  if (!user) {
    return (
      <div>
        <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 py-12 sm:py-16 lg:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-sm font-semibold px-4 py-2 rounded-full mb-5">
              <span>✨</span> Nemokama išlaidų sekimo sistema
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-stone-900 mb-4 leading-tight">
              Valdykite savo{' '}
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                išlaidas
              </span>{' '}
              paprastai
            </h1>
            <p className="text-stone-600 text-base sm:text-lg max-w-xl mx-auto mb-8">
              Sekite dienos išlaidas pagal kategorijas, analizuokite mėnesio statistiką ir valdykite biudžetą.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/login" className="btn-primary text-base px-8">Pradėti nemokamai →</Link>
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <span>✓</span> Nereikia kreditinės kortelės
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-12 text-left">
              {CATEGORIES.map((cat) => {
                const meta = CATEGORY_META[cat];
                return (
                  <div key={cat} className={`card ${meta.bg} border ${meta.border} text-center`}>
                    <div className="text-3xl mb-2">{meta.emoji}</div>
                    <p className={`text-sm font-semibold ${meta.color}`}>{meta.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <Login />
      </div>
    );
  }

  // ---- Skaičiavimai ----
  const filteredExpenses = data
    ? activeFilter === 'ALL' ? data.expenses : data.expenses.filter((e) => e.category === activeFilter)
    : [];

  const topCategory =
    data && data.total > 0
      ? CATEGORIES.reduce((a, b) => (data.byCategory[a] || 0) > (data.byCategory[b] || 0) ? a : b)
      : null;

  const budgetStatus: FoodBudgetStatus | null =
    data && profile && isCurrentMonth
      ? calculateFoodBudget(data.expenses, profile.foodDailyLimit, profile.foodMonthlyLimit, selectedMonth, selectedYear)
      : null;

  const incomeRatio =
    data && profile?.salary ? calcIncomeRatio(data.total, profile.salary) : null;

  const activeWarnings = budgetStatus?.warnings.filter((w) => !dismissedWarnings.has(w.message)) ?? [];

  // ---- Dashboard ----
  return (
    <div className="min-h-[calc(100vh-4rem)] py-6 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
              Sveiki, <span className="text-orange-500">{user.email.split('@')[0]}</span> 👋
            </h1>
            <p className="text-stone-500 text-sm mt-0.5">Čia jūsų mėnesio išlaidų suvestinė</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link to="/profile"
              className="bg-white border-2 border-stone-200 hover:border-orange-300 text-stone-500 hover:text-orange-600 p-2.5 rounded-xl transition-all"
              title="Profilis">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
            <Link to="/create" className="btn-primary flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Pridėti išlaidą
            </Link>
          </div>
        </div>

        {/* Month selector */}
        <div className="card mb-5">
          <div className="flex items-center justify-between">
            <button onClick={prevMonth}
              className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-orange-100 hover:text-orange-600 flex items-center justify-center transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900">
                {MONTHS_LT[selectedMonth - 1]} {selectedYear}
              </h2>
              {isCurrentMonth && (
                <span className="text-xs font-medium text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                  Šis mėnuo
                </span>
              )}
            </div>
            <button onClick={nextMonth} disabled={isCurrentMonth}
              className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-orange-100 hover:text-orange-600 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Loading / Error / Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mx-auto mb-3" />
              <p className="text-stone-500 text-sm">Kraunama...</p>
            </div>
          </div>
        ) : error ? (
          <div className="card text-center py-10">
            <p className="text-red-500 text-lg mb-2">⚠️ {error}</p>
            <button onClick={fetchData} className="btn-secondary text-sm">Bandyti dar kartą</button>
          </div>
        ) : data ? (
          <div className="space-y-4 animate-fade-in">

            {/* ── Įspėjimų baneriai ── */}
            {activeWarnings.length > 0 && (
              <div className="space-y-2">
                {activeWarnings.map((w) => (
                  <div key={w.message}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border animate-slide-up ${
                      w.level === 'danger' ? 'bg-red-50 border-red-200 text-red-800'
                      : w.level === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                    <p className="text-sm font-medium flex-1">{w.message}</p>
                    <button
                      onClick={() => setDismissedWarnings((s) => new Set([...s, w.message]))}
                      className="flex-shrink-0 opacity-50 hover:opacity-100 text-xl leading-none transition-opacity"
                      title="Uždaryti">×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Stats Grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Total */}
              <div className="card bg-gradient-to-br from-orange-500 to-amber-500 text-white">
                <p className="text-orange-100 text-sm font-medium mb-1">Viso išleista</p>
                <p className="text-3xl sm:text-4xl font-extrabold">{data.total.toFixed(2)} €</p>
                <p className="text-orange-100 text-xs mt-2">
                  {data.expenses.length} operacij{data.expenses.length === 1 ? 'a' : data.expenses.length < 10 ? 'os' : 'ų'}
                </p>
                {incomeRatio !== null && (
                  <div className="mt-3 pt-2.5 border-t border-orange-400">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-orange-100 text-xs">% nuo atlyginimo</span>
                      <span className={`text-xs font-bold ${incomeRatio > 80 ? 'text-red-200' : incomeRatio > 50 ? 'text-yellow-200' : 'text-green-200'}`}>
                        {incomeRatio.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-orange-400 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${incomeRatio > 80 ? 'bg-red-300' : incomeRatio > 50 ? 'bg-yellow-300' : 'bg-green-300'}`}
                        style={{ width: `${Math.min(100, incomeRatio)}%` }}
                      />
                    </div>
                    <p className="text-orange-100 text-xs mt-1">iš {profile!.salary!.toFixed(0)} € atlyginimo</p>
                  </div>
                )}
              </div>

              {/* Top Category */}
              {topCategory ? (
                <div className={`card border-2 ${CATEGORY_META[topCategory].border} ${CATEGORY_META[topCategory].bg}`}>
                  <p className="text-stone-500 text-sm font-medium mb-1">Daugiausiai</p>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{CATEGORY_META[topCategory].emoji}</span>
                    <p className={`text-lg font-bold ${CATEGORY_META[topCategory].color}`}>
                      {CATEGORY_META[topCategory].label}
                    </p>
                  </div>
                  <p className="text-xl font-extrabold text-stone-900">
                    {(data.byCategory[topCategory] || 0).toFixed(2)} €
                  </p>
                </div>
              ) : (
                <div className="card border-2 border-dashed border-stone-200 flex items-center justify-center">
                  <p className="text-stone-400 text-sm">Nėra duomenų</p>
                </div>
              )}

              {/* Daily avg */}
              <div className="card">
                <p className="text-stone-500 text-sm font-medium mb-1">Dienos vidurkis</p>
                <p className="text-3xl sm:text-4xl font-extrabold text-stone-900">
                  {data.expenses.length > 0
                    ? (data.total / new Date(selectedYear, selectedMonth, 0).getDate()).toFixed(2)
                    : '0.00'} €
                </p>
                <p className="text-stone-400 text-xs mt-2">
                  Per {new Date(selectedYear, selectedMonth, 0).getDate()} dienų
                </p>
              </div>
            </div>

            {/* ── Maisto biudžetas (collapsible) ── */}
            {budgetStatus && (
              <Section
                id="budget"
                title="🍽️ Maisto biudžetas"
                subtitle={`${budgetStatus.monthlyFoodSpent.toFixed(2)} € / ${budgetStatus.monthlyLimit} €`}
                badge={
                  budgetStatus.isMonthlyExceeded
                    ? <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">⛔ Viršytas</span>
                    : budgetStatus.isMonthlyNearLimit
                    ? <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">⚠️ Artėja</span>
                    : undefined
                }
                collapsed={collapsed.budget}
                onToggle={() => toggle('budget')}
              >
                <div className="flex justify-end mb-3 -mt-1">
                  <Link to="/profile" className="text-xs text-orange-500 hover:underline font-medium">
                    Keisti limitą →
                  </Link>
                </div>
                <div className="space-y-4">
                  {/* Mėnuo */}
                  {[
                    { label: 'Mėnuo', spent: budgetStatus.monthlyFoodSpent, limit: budgetStatus.monthlyLimit, pct: budgetStatus.monthlyUsedPct, remaining: budgetStatus.monthlyRemaining, exceeded: budgetStatus.isMonthlyExceeded, near: budgetStatus.isMonthlyNearLimit, bar: budgetStatus.isMonthlyExceeded ? 'bg-red-500' : budgetStatus.isMonthlyNearLimit ? 'bg-amber-500' : 'bg-red-400' },
                    { label: 'Ši savaitė', spent: budgetStatus.weeklyFoodSpent, limit: budgetStatus.currentWeekBudget, pct: budgetStatus.weeklyUsedPct, remaining: budgetStatus.weeklyRemaining, exceeded: budgetStatus.isWeeklyExceeded, near: budgetStatus.isWeeklyNearLimit, bar: budgetStatus.isWeeklyExceeded ? 'bg-red-500' : budgetStatus.isWeeklyNearLimit ? 'bg-amber-400' : 'bg-orange-400', extra: budgetStatus.isWeeklyExceeded ? '↓ kita savaitė bus mažesnė' : undefined },
                    { label: 'Šiandien', spent: budgetStatus.todayFoodSpent, limit: budgetStatus.dailyLimit, pct: budgetStatus.dailyUsedPct, remaining: budgetStatus.dailyRemaining, exceeded: budgetStatus.isDailyExceeded, near: budgetStatus.isDailyNearLimit, bar: budgetStatus.isDailyExceeded ? 'bg-red-500' : budgetStatus.isDailyNearLimit ? 'bg-amber-400' : 'bg-amber-300' },
                  ].map(({ label, spent, limit, pct, remaining, exceeded, bar, extra }) => (
                    <div key={label}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-semibold text-stone-600">
                          {label}
                          {extra && <span className="ml-2 text-red-500 font-normal">{extra}</span>}
                        </span>
                        <span className="text-xs text-stone-500">
                          <span className={`font-bold ${exceeded ? 'text-red-600' : 'text-stone-800'}`}>
                            {spent.toFixed(2)} €
                          </span>
                          {' / '}{limit.toFixed(2)} €
                        </span>
                      </div>
                      <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                        <div className={`h-full ${bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-stone-400 mt-1">
                        Likę: <span className={`font-semibold ${exceeded ? 'text-red-600' : 'text-stone-700'}`}>{remaining.toFixed(2)} €</span>
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-stone-500">
                    <span className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" /> Artėja limitas (&gt;85%)
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-stone-500">
                    <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" /> Viršytas
                  </div>
                </div>
              </Section>
            )}

            {/* Atlyginimo užuomina */}
            {isCurrentMonth && profile && !profile.salary && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
                <p className="text-sm text-amber-700">💡 Pridėkite atlyginimą ir matysite kiek % pajamų išleidžiate</p>
                <Link to="/profile" className="text-xs font-semibold text-orange-600 hover:underline ml-3 flex-shrink-0">
                  Nustatyti →
                </Link>
              </div>
            )}

            {/* ── Pagal kategorijas (collapsible) ── */}
            {data.total > 0 && (
              <Section
                id="categories"
                title="Pagal kategorijas"
                subtitle={`${CATEGORIES.filter((c) => (data.byCategory[c] || 0) > 0).length} kategorijos`}
                collapsed={collapsed.categories}
                onToggle={() => toggle('categories')}
              >
                <div className="space-y-3">
                  {CATEGORIES.filter((cat) => (data.byCategory[cat] || 0) > 0)
                    .sort((a, b) => (data.byCategory[b] || 0) - (data.byCategory[a] || 0))
                    .map((cat) => {
                      const meta = CATEGORY_META[cat];
                      const amount = data.byCategory[cat] || 0;
                      const pct = data.total > 0 ? (amount / data.total) * 100 : 0;
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span>{meta.emoji}</span>
                              <span className="text-sm font-semibold text-stone-700">{meta.label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-stone-400">{pct.toFixed(1)}%</span>
                              <span className="text-sm font-bold text-stone-900 w-20 text-right">{amount.toFixed(2)} €</span>
                            </div>
                          </div>
                          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                            <div className={`h-full ${meta.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </Section>
            )}

            {/* ── Išlaidų sąrašas (collapsible) ── */}
            <div className="card">
              {/* Antraštė + filtrai — visada matomi */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  onClick={() => toggle('list')}
                  className="flex items-center gap-2 text-left group"
                  aria-expanded={!collapsed.list}
                >
                  <span className="text-base font-bold text-stone-800">
                    Išlaidų sąrašas
                    {data.expenses.length > 0 && (
                      <span className="ml-2 text-sm font-normal text-stone-400">
                        ({filteredExpenses.length}/{data.expenses.length})
                      </span>
                    )}
                  </span>
                  <svg
                    className={`w-5 h-5 text-stone-400 flex-shrink-0 transition-transform duration-200 ${collapsed.list ? '-rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Filtrai — spustelėjus filtras atidaro sąrašą */}
                {data.expenses.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      onClick={() => { setActiveFilter('ALL'); setCollapsed((p) => ({ ...p, list: false })); }}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                        activeFilter === 'ALL' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      Visi
                    </button>
                    {CATEGORIES.filter((c) => (data.byCategory[c] || 0) > 0).map((cat) => {
                      const meta = CATEGORY_META[cat];
                      return (
                        <button
                          key={cat}
                          onClick={() => { setActiveFilter(cat); setCollapsed((p) => ({ ...p, list: false })); }}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                            activeFilter === cat ? `${meta.bg} ${meta.color} ${meta.border}` : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          {meta.emoji} {meta.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sąrašo turinys */}
              {!collapsed.list && (
                <div className="mt-4">
                  {filteredExpenses.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-3xl">📭</span>
                      </div>
                      <p className="text-stone-500 font-medium">
                        {data.expenses.length === 0 ? 'Šį mėnesį išlaidų nėra' : 'Nėra išlaidų šioje kategorijoje'}
                      </p>
                      {data.expenses.length === 0 && (
                        <Link to="/create" className="btn-primary text-sm mt-4 inline-block">
                          Pridėti pirmą išlaidą
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredExpenses.map((expense) => (
                        <ExpenseCard key={expense.id} expense={expense} onDelete={handleDelete} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        ) : null}
      </div>

      {/* FAB – mobiliesiems */}
      <Link
        to="/create"
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full shadow-warm-lg flex items-center justify-center text-white hover:shadow-xl transition-all hover:-translate-y-1 md:hidden z-50"
        title="Pridėti išlaidą"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </Link>
    </div>
  );
}
