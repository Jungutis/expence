import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { expensesApi, profileApi } from '../services/api';
import type { ExpenseCategory } from '../types';
import { CATEGORY_META } from '../types';
import { calculateFoodBudget } from '../utils/budgetUtils';
import type { FoodBudgetStatus } from '../utils/budgetUtils';
import axios from 'axios';

const CATEGORIES: ExpenseCategory[] = ['MAISTAS', 'KURAS', 'RUBAI', 'NEBUTINOS', 'BOLT_WOLT', 'KITOS'];

export default function CreateRecord() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [budgetStatus, setBudgetStatus] = useState<FoodBudgetStatus | null>(null);

  const now = new Date();

  // Užkrauti maisto biudžeto statusą
  useEffect(() => {
    const load = async () => {
      try {
        const [expenses, profile] = await Promise.all([
          expensesApi.getExpenses(now.getMonth() + 1, now.getFullYear()),
          profileApi.getProfile(),
        ]);
        const status = calculateFoodBudget(
          expenses.expenses,
          profile.foodDailyLimit,
          profile.foodMonthlyLimit,
          now.getMonth() + 1,
          now.getFullYear()
        );
        setBudgetStatus(status);
      } catch {
        // silent — biudžeto info neprivaloma
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!category) {
      setError('Pasirinkite išlaidų kategoriją');
      return;
    }

    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Įveskite teisingą sumą');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await expensesApi.createExpense({
        category,
        amount: parsedAmount,
        note: note.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Klaida. Bandykite dar kartą.');
      } else {
        setError('Netikėta klaida. Bandykite dar kartą.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="text-center animate-slide-up">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">Išlaida įrašyta!</h2>
          <p className="text-stone-500">Nukreipiama į pradžią...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8 px-4">
      <div className="max-w-xl mx-auto animate-slide-up">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-stone-500 hover:text-stone-700 text-sm font-medium mb-4 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Grįžti atgal
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">Nauja išlaida</h1>
          <p className="text-stone-500 mt-1 text-sm sm:text-base">
            Įrašykite šiandienos išlaidą — data bus nustatyta automatiškai
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Category Selection */}
          <div className="card">
            <h2 className="text-base font-bold text-stone-800 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center text-sm">1</span>
              Pasirinkite kategoriją
            </h2>

            {/* Maisto biudžeto įspėjimas virš kortelių */}
            {budgetStatus && category === 'MAISTAS' && budgetStatus.isWeeklyNearLimit && !budgetStatus.isMonthlyExceeded && (
              <div className="mb-3 bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2 animate-fade-in">
                <span className="flex-shrink-0">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Savaitės maisto biudžetas beveik baigtas!</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Likę {budgetStatus.weeklyRemaining.toFixed(2)} € iš {budgetStatus.currentWeekBudget.toFixed(2)} €.
                    Perkūrus šią ribą, kitos savaitės biudžetas sumažės.
                  </p>
                </div>
              </div>
            )}
            {budgetStatus && budgetStatus.isWeeklyExceeded && !budgetStatus.isMonthlyExceeded && (category === 'MAISTAS' || category === null) && (
              <div className="mb-3 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 animate-fade-in">
                <span className="flex-shrink-0">🔴</span>
                <p className="text-sm font-medium text-red-700">
                  Savaitės maisto biudžetas viršytas. Kitos savaitės limitas jau sumažintas.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {CATEGORIES.map((cat) => {
                const meta = CATEGORY_META[cat];
                const selected = category === cat;
                const isBlocked = cat === 'MAISTAS' && budgetStatus?.isMonthlyExceeded;

                return (
                  <button
                    key={cat}
                    type="button"
                    disabled={isBlocked}
                    onClick={() => { if (!isBlocked) { setCategory(cat); setError(''); } }}
                    title={isBlocked ? 'Mėnesinis maisto limitas viršytas' : undefined}
                    className={`relative flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200
                      ${isBlocked
                        ? 'bg-stone-50 border-stone-100 opacity-50 cursor-not-allowed'
                        : selected
                        ? `${meta.bg} ${meta.border} shadow-sm scale-[1.02]`
                        : 'bg-white border-stone-100 hover:border-stone-200 hover:bg-stone-50'
                      }`}
                  >
                    {isBlocked && (
                      <span className="absolute top-1.5 right-1.5 text-base">🔒</span>
                    )}
                    {selected && !isBlocked && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                    <span className="text-2xl sm:text-3xl">{meta.emoji}</span>
                    <span className={`text-xs sm:text-sm font-semibold ${isBlocked ? 'text-stone-400' : selected ? meta.color : 'text-stone-600'}`}>
                      {meta.label}
                    </span>
                    {isBlocked && (
                      <span className="text-xs text-red-400 font-medium">Limitas viršytas</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Blokavimo paaiškinimas */}
            {budgetStatus?.isMonthlyExceeded && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                  ⛔ Mėnesinis maisto limitas viršytas
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Išleista {budgetStatus.monthlyFoodSpent.toFixed(2)} € iš {budgetStatus.monthlyLimit} €.
                  Galite keisti limitą profilio skiltyje (tik pirmą mėnesio savaitę).
                </p>
                <Link to="/profile" className="inline-block mt-1.5 text-xs font-semibold text-orange-600 hover:underline">
                  Eiti į profilį →
                </Link>
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="card">
            <h2 className="text-base font-bold text-stone-800 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center text-sm">2</span>
              Suma (€)
            </h2>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-lg pointer-events-none">
                €
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(''); }}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                className="input-field pl-9 text-xl font-bold text-stone-900"
                required
              />
            </div>
            {/* Quick amounts */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {[5, 10, 20, 50, 100].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className={`text-sm font-semibold px-3 py-1.5 rounded-lg border transition-all
                    ${amount === String(q)
                      ? 'bg-orange-100 text-orange-700 border-orange-200'
                      : 'bg-stone-50 text-stone-600 border-stone-100 hover:bg-stone-100'
                    }`}
                >
                  {q} €
                </button>
              ))}
            </div>
          </div>

          {/* Note (optional) */}
          <div className="card">
            <h2 className="text-base font-bold text-stone-800 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center text-sm">3</span>
              Pastaba
              <span className="text-xs font-normal text-stone-400 ml-1">(neprivaloma)</span>
            </h2>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Pvz.: Lidl pirkiniai, benzinas BMW..."
              maxLength={200}
              rows={2}
              className="input-field resize-none"
            />
            <p className="text-xs text-stone-400 text-right mt-1">{note.length}/200</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 animate-fade-in">
              <span>⚠️</span>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Summary before submit */}
          {category && amount && parseFloat(amount) > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 animate-fade-in">
              <p className="text-sm font-semibold text-amber-800 mb-1">Įrašo santrauka:</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-600">
                  {CATEGORY_META[category].emoji} {CATEGORY_META[category].label}
                  {note && ` · ${note}`}
                </span>
                <span className="font-bold text-stone-900 text-lg">
                  {parseFloat(amount.replace(',', '.')).toFixed(2)} €
                </span>
              </div>
              <p className="text-xs text-amber-600 mt-1">
                📅 Data bus nustatyta automatiškai ({new Date().toLocaleDateString('lt-LT')})
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !category || !amount}
            className="btn-primary w-full text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Išsaugoma...
              </span>
            ) : (
              '💾 Išsaugoti išlaidą'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
